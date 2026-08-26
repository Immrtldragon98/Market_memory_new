# Market Memory Backend

FastAPI backend for the clean v1 rebuild.

Setup:

```bash
python -m venv .venv
# activate the virtual environment
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

Run `migrations/001_core_market_memory.sql` in Supabase before using the core features.
