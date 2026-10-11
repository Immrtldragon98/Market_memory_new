# Market Memory Strategy Agents — Implementation Plan

## Product direction

Market Memory should grow from a personal decision-memory system into a user-specific strategy discovery and monitoring workspace. It should use the user's own journal, observations, snapshots, alerts, recorded prices, and later validated historical market data to discover repeatable conditions, test hypotheses, and alert the user when those conditions recur.

The product is not allowed to turn an LLM's intuition into a fabricated win probability. LLMs interpret journal language and propose hypotheses; deterministic code and historical data evaluate them.

## Existing foundation verified in the repository

- `app/modules/assistant/service.py`: Groq/OpenRouter reflection, owner-filtered journal evidence, provider fallback, audit records.
- `app/api/journal.py`: journal capture, scheduled reviews, completed review outcomes, linked entry price samples.
- `app/api/memory.py`: observations and immutable snapshots.
- `app/api/alerts.py`: user-defined price alerts with a manual check endpoint.
- `app/modules/timeseries/service.py`: canonical assets and deduplicated price samples.
- `app/mcp_server.py`: authenticated, read-only MCP tools for recent journal entries and due reviews.
- `PRODUCT_AUDIT.md` and `AI_ARCHITECTURE.md`: existing product constraints and security risks.

## Proposed agent workflow

### 1. Memory Interpreter Agent
Read a bounded, authenticated user's own journal entries, observations, snapshots, alert history, and completed review lessons. Extract structured facts such as:
- asset and timeframe;
- context/regime the user described;
- setup conditions and evidence;
- intended action and invalidation condition;
- expected outcome, confidence, emotion, and review outcome;
- source IDs and explicit unknowns.

All extracted claims must cite source record IDs. Journal text is untrusted data, not instructions. Never mix data between users.

### 2. Pattern Discovery Agent
Cluster similar historical situations and suggest a small number of candidate hypotheses. Every hypothesis must be falsifiable and include explicit entry conditions, exit/invalidation conditions, timeframe, required data, and a reason it might fail. Keep user-described patterns separate from objectively measured market features.

### 3. Strategy Formalizer Agent
Convert a candidate hypothesis into a versioned, machine-checkable rule specification. Reject vague rules such as “buy when sentiment is good.” A strategy cannot be evaluated until all required conditions, timing, exits, and costs are specified.

### 4. Backtest & Validation Engine (deterministic, not LLM)
Run rules against timestamped OHLCV/price data with no look-ahead. Include fees, slippage assumptions, missing-data handling, and corporate actions where relevant. Use chronological train/validation/test windows or walk-forward evaluation. Track the number of strategies/parameter variants tried to expose selection bias. Report sample count, win rate, average return, expectancy, drawdown, and uncertainty intervals. Never silently treat sparse app-open price samples as complete historical candles.

### 5. Skeptic / Risk Reviewer Agent
Challenge the candidate and its evidence: small sample size, regime concentration, survivorship/look-ahead bias, leakage, costs, fragile parameters, conflicting examples, and poor out-of-sample performance. It can veto promotion but cannot rewrite measured results.

### 6. Calibration & Promotion Gate (deterministic)
A displayed “70%” must be explicitly defined. Prefer a calibrated estimate of the probability that a signal meets a stated outcome definition over a fixed horizon, based on untouched out-of-sample observations. It is not the same as a backtest win rate or a guarantee of profit.

A strategy must not be labeled “70%+” just because the LLM says so. Require:
- an explicit outcome definition and horizon;
- sufficient independent observations;
- chronological out-of-sample evaluation;
- fees/slippage included;
- calibration and uncertainty reported;
- stability checks across time/regimes;
- clear strategy/version and data provenance.

If there is insufficient data, return **Not enough evidence**, not a percentage. The sample-size threshold should be configurable and empirically justified; don't claim that an arbitrary threshold proves reliability.

### 7. Scenario Monitor & Notification Agent
Re-evaluate only approved, versioned strategies against fresh market data. Notify the user when the conditions match, include the exact matching conditions, timestamp, strategy version, evidence summary, and measured validation metrics. Deduplicate repeated alerts and make stale/missing market data visible. Alerts must not imply certainty.

### 8. Execution Agent — paper trading first
First release supports notifications and simulated/paper orders only. Require explicit user approval before a strategy is activated for monitoring. No live brokerage order may be sent by the LLM or from a pattern match alone. Live trading, if ever added, requires separate broker authorization, explicit opt-in per strategy, order-size and loss limits, idempotency, a kill switch, audit logs, and a final user-confirmation policy. The system must never silently place real trades.

## Important product distinction

“Success probability” must be measured, not generated. Show separate fields:
- historical win rate;
- out-of-sample win rate;
- calibrated probability (only when calibration data supports it);
- sample count and date range;
- expected return after costs and maximum drawdown;
- confidence/uncertainty interval;
- data coverage and validation status.

A strategy can have a 75% historical win rate and still lose money if losses are much larger than wins. Do not use win rate alone as a profitability metric.

## Implementation phases

### Phase 0 — prerequisites and audit
- Verify end-to-end journal, observation, snapshot, alert, and price-history flows.
- Fix user scoping: all AI reads use the authenticated user's request-scoped RLS client.
- Inventory price data sources and clearly document historical coverage and cadence.
- Add tests for cross-user access, prompt injection, provider outage, stale quotes, and missing data.

### Phase 1 — structured memory and hypotheses
- Add typed extraction schema and source-record references.
- Create strategy-hypothesis storage with draft/rejected/needs-data states.
- Add a “Discover patterns” workflow that produces explainable hypotheses, not trade signals.
- Persist provider/model, prompt version, source IDs, timestamps, and review decisions.

### Phase 2 — validation engine
- Integrate a permitted historical market-data source with known OHLCV coverage.
- Implement deterministic backtesting and chronological out-of-sample evaluation.
- Build fixtures with known outcomes and tests for look-ahead leakage, transaction costs, and missing bars.
- Display “not enough evidence” until data and validation gates pass.

### Phase 3 — monitoring and notifications
- Add scheduled server-side evaluation; do not rely on the app being open.
- Add durable notification delivery, deduplication, retries, and monitoring.
- Require user approval to enable each strategy for monitoring.

### Phase 4 — paper execution
- Simulate orders and portfolio effects; track fills, fees, slippage, drawdown, and strategy version.
- Compare paper results with backtest results before considering any live execution.

## Security and reliability gates

- Every strategy, hypothesis, signal, notification, and paper order is tenant-scoped by authenticated user ID and protected by RLS.
- The model never receives database credentials or broker secrets.
- Retrieved journal text is treated as untrusted data and cannot authorize tools.
- Every result includes provenance: source record IDs, market-data source, data timestamps, strategy version, and model metadata.
- User deletion must also remove associated hypotheses, embeddings (if later added), alerts, and paper-trading records according to the retention policy.
- No production automation until CI, database migration smoke tests, authorization tests, and failure-mode tests pass.

## Initial acceptance criteria

1. The user can ask the assistant to analyze completed journal reviews and receive source-linked patterns.
2. The assistant can propose a candidate strategy with explicit, testable conditions and source IDs.
3. The UI clearly labels candidates as unvalidated until the deterministic engine tests them.
4. No probability is shown when sample size, data quality, or out-of-sample evidence is inadequate.
5. No real orders can be placed in this phase.
6. The user can approve or reject a hypothesis and see its version/history.
