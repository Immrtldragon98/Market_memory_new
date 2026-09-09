import asyncio
from datetime import date
import os
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault('SUPABASE_URL', 'https://example.supabase.co')
os.environ.setdefault('SUPABASE_ANON_KEY', 'test-key')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

from app.modules.market import service as market
from app.modules.timeseries import service as timeseries
from app.api import journal
from app.schemas.journal import JournalCreate, JournalReviewCreate, JournalSchedule
from fastapi import HTTPException

ASSET = {'symbol': 'TCS.NS', 'name': 'TCS', 'asset_type': 'stock', 'backend_id': 'TCS.NS'}

class Database:
    """Thread-safe contract fake; real Postgres constraints have a separate CI smoke test."""
    def __init__(self):
        self.rows = {}
        self.lock = threading.Lock()
    def table(self, name):
        return Query(self, name)

class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.row, self.operation = [], None, 'select'
        self.nulls = []
        self.cutoff = None
        self.bounds = None
        self.sorts = []
        self.negate = False
    def select(self, *args, **kwargs): return self
    def eq(self, key, value):
        self.filters.append((key, value)); return self
    @property
    def not_(self):
        self.negate = True; return self
    def is_(self, key, value):
        self.nulls.append((key, self.negate)); self.negate = False; return self
    def lte(self, key, value):
        self.cutoff = (key, value); return self
    def order(self, key, desc=False):
        self.sorts.append((key, desc)); return self
    def range(self, first, last):
        self.bounds = (first, last); return self
    def update(self, row):
        self.row, self.operation = row, 'update'; return self
    def matches(self, row):
        return (all(row.get(k) == v for k,v in self.filters)
                and all((row.get(k) is not None) if neg else (row.get(k) is None) for k,neg in self.nulls)
                and (self.cutoff is None or (row.get(self.cutoff[0]) is not None and row[self.cutoff[0]] <= self.cutoff[1])))
    def limit(self, *args): return self
    def insert(self, row):
        self.row, self.operation = row, 'insert'; return self
    def upsert(self, row, *, on_conflict, ignore_duplicates):
        assert on_conflict == 'asset_type,backend_id' and ignore_duplicates
        self.row, self.operation = row, 'upsert'; return self
    def execute(self):
        with self.db.lock:
            rows = self.db.rows.setdefault(self.table, [])
            if self.operation == 'update':
                updated = []
                for row in rows:
                    if self.matches(row): row.update(self.row); updated.append(row.copy())
                return SimpleNamespace(data=updated)
            if self.row is not None:
                keys = {'market_assets': ('asset_type', 'backend_id'), 'market_price_samples': ('asset_id', 'bucket_at')}.get(self.table)
                duplicate = next((r for r in rows if keys and all(r[k] == self.row[k] for k in keys)), None)
                if duplicate and self.operation != 'upsert': raise RuntimeError('unique violation')
                if duplicate: return SimpleNamespace(data=[])
                row = {'id': len(rows) + 1, **self.row}
                rows.append(row)
                return SimpleNamespace(data=[row])
            result = [r.copy() for r in rows if self.matches(r)]
            for key, desc in reversed(self.sorts): result.sort(key=lambda r: r.get(key, ''), reverse=desc)
            if self.bounds: result = result[self.bounds[0]:self.bounds[1]+1]
            return SimpleNamespace(data=result)

class ReliabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_capture_deduplicates_asset_and_sample(self):
        db = Database()
        with patch.object(timeseries, 'supabase', db), patch.object(timeseries, 'get_quote', AsyncMock(return_value={'price': 100, 'currency': 'INR', 'source': 'test'})):
            results = await asyncio.gather(*(timeseries.sample_asset(ASSET, 'user', 'manual') for _ in range(30)))
        self.assertEqual(len(db.rows['market_assets']), 1)
        self.assertEqual(len(db.rows['market_price_samples']), 1)
        self.assertEqual(len(results), 30)

    async def test_quote_outage_preserves_journal_asset_link(self):
        db = Database()
        with patch.object(journal, 'supabase', db), patch.object(journal, 'ensure_asset', return_value={'id': 42}), patch.object(journal, 'sample_asset', AsyncMock(side_effect=TimeoutError)), self.assertLogs('app.api.journal', level='ERROR'):
            result = await journal.create_entry(JournalCreate(**ASSET, title='Thesis', note='Evidence'), SimpleNamespace(id='owner'))
        self.assertEqual(result['asset_id'], 42)
        self.assertNotIn('entry_price_sample_id', result)
        self.assertEqual(result['user_id'], 'owner')

    async def test_canonical_labels_are_not_overwritten(self):
        db = Database()
        with patch.object(timeseries, 'supabase', db):
            first = timeseries.ensure_asset(ASSET)
            second = timeseries.ensure_asset({**ASSET, 'name': 'untrusted replacement'})
        self.assertEqual(first, second)

    async def test_search_retains_provider_order_within_rank(self):
        assets = [{**ASSET, 'symbol': 'AZ'}, {**ASSET, 'symbol': 'AA'}]
        self.assertEqual(sorted(assets, key=lambda item: market._score(item, 'A')), assets)
        self.assertLess(market._score(ASSET, 'TCS'), market._score({**ASSET, 'symbol': 'TCSX', 'name': 'Other company'}, 'TCS'))

    async def test_search_outage_is_not_empty_success(self):
        market._search_cache.clear()
        with patch.object(market, '_search_stocks', AsyncMock(side_effect=TimeoutError)), patch.object(market, '_search_crypto', AsyncMock(side_effect=TimeoutError)):
            with self.assertRaises(LookupError): await market.search_assets('BTC')

    async def test_partial_search_survives_and_is_not_cached(self):
        market._search_cache.clear()
        with patch.object(market, '_search_stocks', AsyncMock(return_value=[ASSET])), patch.object(market, '_search_crypto', AsyncMock(side_effect=TimeoutError)):
            self.assertEqual(await market.search_assets('TCS'), [ASSET])
        self.assertEqual(len(market._search_cache), 0)

    async def test_cache_has_fixed_bound(self):
        market._search_cache.clear()
        for i in range(1000): market._cache_put(market._search_cache, str(i), [])
        self.assertEqual(len(market._search_cache), 512)

    async def test_other_users_review_is_not_readable(self):
        db = Database()
        db.rows['journal_entries'] = [{'id': 1, 'user_id': 'someone-else', 'asset_id': 2}]
        with patch.object(journal, 'supabase', db):
            with self.assertRaises(HTTPException) as error:
                journal.review_entry(1, '7d', SimpleNamespace(id='owner'))
        self.assertEqual(error.exception.status_code, 404)

    async def test_missing_original_price_stays_null(self):
        db = Database()
        db.rows['journal_entries'] = [{'id': 1, 'user_id': 'owner', 'asset_id': None}]
        with patch.object(journal, 'supabase', db):
            result = journal.review_entry(1, '7d', SimpleNamespace(id='owner'))
        self.assertIsNone(result['entry_price'])
        self.assertIsNone(result['latest_price'])

class ReviewLoopTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.db.rows['journal_entries'] = [
            {'id': 1, 'user_id': 'owner', 'title': 'Original title', 'note': 'Original thesis', 'review_due_on': '2026-09-08', 'reviewed_at': None},
            {'id': 2, 'user_id': 'other', 'review_due_on': '2026-09-08', 'reviewed_at': None},
            {'id': 3, 'user_id': 'owner', 'review_due_on': '2026-09-10', 'reviewed_at': None},
            {'id': 4, 'user_id': 'owner', 'review_due_on': '2026-09-08', 'reviewed_at': '2026-09-08T00:00:00Z'},
        ]
        self.user = SimpleNamespace(id='owner')
    def test_due_filter_ownership_date_and_pagination(self):
        with patch.object(journal, 'supabase', self.db):
            rows = journal.list_entries(view='due', as_of=date(2026,9,9), limit=50, offset=0, user=self.user)
            self.assertEqual([r['id'] for r in rows], [1])
            self.assertEqual(journal.list_entries(view='due', as_of=date(2026,9,9), limit=1, offset=1, user=self.user), [])
    def test_complete_preserves_original_and_retry_is_idempotent(self):
        with patch.object(journal, 'supabase', self.db):
            result = journal.complete_review(1, JournalReviewCreate(lesson='New evidence'), self.user)
            again = journal.complete_review(1, JournalReviewCreate(lesson='New evidence'), self.user)
            self.assertEqual(result, again)
            self.assertEqual(result['note'], 'Original thesis')
            self.assertEqual(result['title'], 'Original title')
            self.assertTrue(result['reviewed_at'])
            with self.assertRaises(HTTPException) as error:
                journal.complete_review(1, JournalReviewCreate(lesson='Overwrite'), self.user)
            self.assertEqual(error.exception.status_code, 409)
    def test_other_users_cannot_complete_or_schedule(self):
        with patch.object(journal, 'supabase', self.db):
            for fn,payload in [(journal.complete_review, JournalReviewCreate(lesson='x')), (journal.schedule_review, JournalSchedule(review_due_on=None))]:
                with self.assertRaises(HTTPException) as error: fn(2, payload, self.user)
                self.assertEqual(error.exception.status_code, 404)
    def test_schedule_clear_and_completed_guard(self):
        with patch.object(journal, 'supabase', self.db):
            result = journal.schedule_review(1, JournalSchedule(review_due_on=None), self.user)
            self.assertIsNone(result['review_due_on'])
            with self.assertRaises(HTTPException) as error:
                journal.schedule_review(4, JournalSchedule(review_due_on=date(2026,10,1)), self.user)
            self.assertEqual(error.exception.status_code, 409)
    def test_validation_rejects_blank_lesson_and_original_edits(self):
        from pydantic import ValidationError
        for payload in [{'lesson':'   '}, {'lesson':'ok','note':'rewrite'}]:
            with self.assertRaises(ValidationError): JournalReviewCreate(**payload)
        with self.assertRaises(ValidationError): JournalSchedule(review_due_on='2026-02-30')

if __name__ == '__main__': unittest.main()
