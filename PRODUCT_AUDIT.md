# Market Memory — Product and Architecture Audit

## Product truth

Market Memory is not a stock-picking app. Its useful job is to preserve a person's market reasoning before hindsight changes it, then bring that reasoning back for review.

The primary loop is:

1. **Capture** an observation or decision against an asset.
2. **Remember** the price, confidence, evidence and invalidation condition at that moment.
3. **Review** the original thought on a chosen date against later evidence and recorded prices.
4. **Reflect** across completed reviews to identify repeated reasoning patterns.

Anything that does not strengthen that loop is secondary.

## What was built well

- User-owned journal, observations, snapshots, watchlists and alerts with RLS.
- Immutable original thought plus a separate review/lesson flow.
- Price samples linked to assets and journal entries without inventing missing prices.
- AI reflection limited to the authenticated user's journal and framed as reflection, not advice.
- Lightweight FastAPI, Supabase and Expo stack that can run on free tiers.

## Why the product felt broken

| Area | Failure | Correction |
|---|---|---|
| Authentication | Protected screens rendered before session state settled; signup confirmation was unclear. | Gate the entire workspace behind resolved authentication, show persistent feedback, resend confirmation and complete password recovery. |
| Search | Two external providers were a single point of failure; search code was duplicated and errors used mobile alerts on web. | Shared debounced search component, inline states and a small provider-independent core catalog. |
| Navigation | Feature names described database objects rather than the user's workflow. | Rename the visible flow to Today, Capture, Review and Reflect. Keep utilities secondary. |
| Capture | Observations, snapshots and journal thoughts overlap without a clear choice. | Capture is for fast evidence; Review is for explicit decisions/theses and scheduled learning. |
| Price memory | Samples occur only during app use, so history is intentionally sparse. | Label it honestly as recorded samples. Scheduled sampling is a later opt-in feature, not implied market data. |
| Alerts | Checks are manual; they are not real background notifications. | Keep them as remembered levels until a scheduled worker and notification channel are added. |
| AI | Reflection exists, but value is low until users complete several reviews. | Make review completion the main habit; AI summarizes patterns only when evidence exists. |
| Deployment | Backend and frontend deployment are disconnected from a reliable main-branch release path. | Restore automatic production deployment and verify the actual browser bundle after every release. |

## V2 information architecture

- **Today** — reviews due, recent thoughts, saved assets and one clear next action.
- **Capture** — resilient asset search, quote, quick observation, snapshot, watchlist and remembered price level.
- **Review** — record a decision/observation, schedule it, compare original versus later evidence, save the lesson.
- **Reflect** — question patterns in the user's own completed journal history.
- **Account** — authentication, recovery, data summary and sign out.

## Release definition of done

- New user can create, confirm and sign into an account.
- Signed-out users never enter a broken protected workspace.
- Search returns common assets even if one or both live search providers are unavailable.
- Every async action has visible loading, empty, success and error states on web and mobile.
- A user can capture a thought, schedule it, review it and save a lesson.
- RLS and API ownership tests pass.
- Frontend typecheck/export and backend test suite pass.
- Production bundle contains the merged release and uses the intended Render and Supabase endpoints.
