# Contracts

This document records integration boundaries, not every internal helper. Update it whenever a route, payload, ownership rule, or environment-variable name changes.

## HTTP API

| Method and path | Authentication | Request | Response responsibility |
| --- | --- | --- | --- |
| `GET /` | none | none | Health payload `{status: "ok"}` |
| `GET /curriculum` | none at FastAPI layer | none | `{tasks}` loaded with the service client |
| `POST /classify` | none; 20/minute | `ClassifyRequest` | `{algorithm_type, algorithm_confidence}` from the existing classifier; never executes source |
| `POST /mentor` | none | `MentorRequest` | Mentor message or deterministic fallback |
| `POST /session/save` | Supabase bearer token | `SessionSaveRequest` | Atomic activity receipt, session id and provisional practice state |
| `POST /auth/demo-login` | none; IP-limited | none | Supabase access/refresh tokens when demo mode is enabled |

The canonical execution shape and existing snapshot/error semantics are defined in
[Trace Protocol v1](TRACE_PROTOCOL.md). Every execution result includes
`trace_version: 1`. Classifier enrichment remains outside that protocol. The backend never executes
user source; classification and mentor receive it as context, while session
persistence stores it with browser-generated traces.

### Request models

- `ClassifyRequest`: non-empty `code`. A missing model returns `unknown` with confidence `0.0`; syntax errors retain the existing zero-feature model input. HTTP/network failures are handled as unknown by the browser.
- `MentorRequest`: code/error/error line, compressed trace context, optional question/history, and a mode defaulting to `free_chat`.
- `SessionSaveRequest`: required UUID `idempotency_key` and source `code`; `array_var`, browser `trace`, `error`, `total_steps`, `algorithm_type`, `execution_succeeded`, optional UUID `task_id`. These are history/practice annotations, not proof of execution or a solution. Source is limited to 200,000 characters, trace to 300 entries, steps to 0–300, array/algorithm names to 128 characters, and serialized payload to 2 MB.
- Deprecated `xp_earned`, `solved`, `task_completed`, `task_attempts`, `mentor_messages_count`, supplied user ids and all other extra fields are **rejected with 422**, not silently interpreted. Frontend/backend/migration must roll out together.
- The API verifies the Supabase bearer user and makes exactly one service-role `settle_activity_session` RPC. It has no separate-write fallback.
- Response: `session_id`, `xp_awarded`, `reward_status` (`awarded`, `daily_limit`, `balance_limit`), `replayed`, `completion_verified: false`, `achievements_earned: []`, nullable `practice_progress`, and a `profile` reward snapshot. The frontend refreshes current global state separately; a replayed receipt can predate newer saves.
- A repeated owner/key with identical normalized payload returns the original receipt with `replayed: true`. Its `xp_awarded` describes the original award, not another increment. Different data under that key returns 409. At 100 new saves per owner/UTC day, saving returns 429. Database settlement failure returns 503 and must be retried with the same key.

Demo login uses a separate non-persistent, non-refreshing auth client so sign-in
cannot replace the shared backend service principal. Its public response is unchanged.

The generated repository map lists exact Pydantic field names. Source models remain the executable source of truth.

## Frontend integration boundaries

- `VITE_API_URL` is normalized before relative API paths are appended.
- `/session/save` receives `Authorization: Bearer <Supabase access token>`.
- Supabase browser operations use the anon key and rely on RLS. No service-role credential may appear in `frontend/`.
- API errors are represented separately from successful trace results so stale data is cleared after request failure.

## Browser worker boundary

[Browser Python runtime](PYTHON_RUNTIME.md) defines the request-ID-based worker
protocol and lifecycle API. BrowserEngine is the only execution adapter and
produces Trace Protocol v1.
Run is blocked while loading/running/restarting/error. Initialization or recovery failure exposes runtime unavailable with Retry. Retry
reuses the manager and coalesces repeated initialization calls. Python errors,
truncation, timeout, and enrichment failure never select another engine.
Browser timeout rejection carries a canonical `error.trace`, normalized before
visualization. A React effect starts `/classify` only after the trace is committed.
Execution resolves without awaiting classification. Metadata updates the current
trace and is awaited separately by session saving; only algorithm_type is in the
existing session request contract. Confidence remains in trace state. Enrichment
is aborted on reset/unmount/new execution, bounded to ten seconds, and uses
unknown/0 on failure. Run IDs prevent late results overwriting newer metadata.

Post-run persistence starts from a React effect after trace commit. Run resolves
without waiting for classification, persistence, profile, Mentor or optional
audio readiness. A UUID is captured once for that Run; the source, array variable,
task and bearer token are captured with the Run as well. Session saving waits for
bounded classification enrichment in the background. It submits no XP, bonus,
attempt, hint-count or verified-completion claims. A page-local session tail keeps
feedback ordered; database locks/uniqueness provide cross-client correctness.
The UI displays only `xp_awarded` from the receipt, distinguishes saved/no eligible
reward/failure, and never labels browser success as verified completion.

Historical saves can complete, but `useTracer.captureExecution()` reuses the
existing run generation and engine identity to suppress stale save/error/loading,
XP, achievement, mentor and profile UI changes after Run/reset/unmount. Profile
refresh also guards its own overlapping reads and auth lifetime. Each successful
save performs one final refresh of cumulative global XP, guarded by the generation
current when that fresh read starts and the provider's latest read. This also reflects historical XP when a newer save fails. Existing post-run
behavior already had one refresh per save, so no speculative caching is added.
Persistence failures preserve trace/error/playback and use separate localized feedback. Reactive help uses the
committed Run's source/error immediately. Mentor answer loading ends independently
of conversation storage; inserts await the matching historical session ID, using
null if session persistence fails, never the newer Run's session. Mentor request
and conversation storage failures have distinct secondary feedback.

## Complexity and payload boundaries

- Normal Run dispatches exactly one main execution, with no automatic complexity
  requests or samples. No backend complexity route exists.
- Analyze Complexity uses BrowserEngine `count()` on the same prewarmed manager.
  Internal worker requests add `mode: "count"`, capped at 25,000 eligible steps,
  and return `{count, error, truncated}` without visualization snapshots. Normal
  requests default to `mode: "trace"`, retain cap 300 and Trace Protocol v1.
- Samples remain `[5,10,20,40,80]`, using the legacy first-list-literal replacement,
  descending arrays, six profiles, no-intercept least squares, minimum SSE and
  rounded/clamped R² confidence. Capped measurements fail secondary analysis
  instead of treating censored data as a valid growth curve.
- Cache keys deterministically serialize estimator version, source, array variable,
  sizes and step cap. Up to 20 successful immutable results live in mount-scoped
  browser memory; errors are not cached. No database/backend cache is involved.
- A new Run aborts active sampling and awaits worker recovery before executing.
  Code/array/example/task changes and unmount cancel old samples. In-flight
  cancellation and timeout retire/reload the worker; stale results cannot update
  secondary state. Complexity failures never overwrite visible trace/error/player.
- `step.locals` omits the selected list/tuple already represented in `step.array`.
  Other locals remain. Safe historical snapshots and pre-line events are unchanged.
  Proactive mentor context now reads the array explicitly from `step.array`.

## Supabase ownership

| Table | Browser access | Privileged/backend access |
| --- | --- | --- |
| `tasks`, `achievements` | authenticated select | catalog administration/seeding |
| `profiles` | owner select; insert only `id,username`; update only `username` | compatibility reward mirror; no balance is imported as authority |
| `reward_accounts` | owner select only | authoritative activity XP/level/streak and daily accepted-save counter |
| `practice_progress` | owner select only | provisional reported completion, server-counted accepted attempts, reported best steps |
| `task_progress` | owner select only; legacy unverified history | admin workflows only; never reward eligibility |
| `mentor_messages` | owner select/insert/update with session ownership check | seed/admin workflows |
| `pet_profiles` | owner select/insert/update | cosmetic user-owned state, never authoritative XP/eligibility |
| `quiz_attempts` | owner select; insert only practice fields, excluding XP | no client-evaluated quiz XP or verified achievement |
| `sessions`, `user_achievements` | owner select only | transactional session insert; no automatic achievement grants under current policy |
| `reward_private.session_settlements` | no schema/table access | service-only immutable idempotency receipts; no external schema exposure |

### Reward policy and database settlement

Browser traces, classifications, successful execution flags, task identifiers,
step counts, attempt/hint counts and operation UUIDs are all forgeable. A UUID
prevents duplicate settlement; it does not establish activity legitimacy.
`activity-v1` rewards the server-observed acceptance of an authenticated session
save: **5 XP once per UTC day per account**, even for reported errors. Fresh
identifiers cannot bypass that cap or the 100-save/day database limit. UTC dates
come from the database clock after acquiring the per-owner lock. No success,
solution, first-solve, no-hint, fast-solve, algorithm or completion achievements
are issued. All tasks are available for practice independently of completions.

`reward_accounts` starts at zero and is the authority. Old `profiles` balances
are archived in `legacy_reward_snapshot`, never imported. The RPC mirrors current
account values back to profiles for compatibility. Existing sessions default to
`reward_policy=legacy_unverified`; new sessions store `solved` only as a reported
execution outcome and set `completion_verified=false`. Existing achievement grants
are marked `verified=false` and remain historical, not certified benefits.

The forward-only reward migration adds a service-only **security invoker** RPC
with empty `search_path`, fully qualified relations, explicit service principal
check and grants only to `service_role`. It locks the owner's account, checks an
owner/key primary key plus exact payload equality, then inserts the session,
updates provisional practice, account and profile mirror, and records the receipt
in one transaction. A partial unique owner/day index independently prevents two
positive daily awards; account locking prevents lost updates and counter races.
Achievement owner/id uniqueness is enforced even though no new grants are issued.
All numeric counters saturate or reject before database overflow.

Migration grants remove both table and previous column privileges from PUBLIC,
anon and authenticated, replace permissive policies with owner policies, and use
safe profile defaults. It is validated against an explicit disposable fixture,
**not a claimed production schema baseline**. Existing schema types, constraints,
triggers, role inheritance, views and executable RPCs must be reviewed before
staging/application. No live migration is authorized by these code changes.

## Environment variables

Only names and responsibilities belong in documentation. Values live in ignored local files or deployment secrets.

### Backend

- `GEMINI_API_KEY`, optional `GEMINI_MODEL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `ALLOWED_ORIGINS`
- `DEMO_EMAIL`, `DEMO_PASSWORD`
- `SEED_USER_PASSWORD` for synthetic seed users
- provider-injected `PORT` at deployment

### Frontend

- `VITE_API_URL`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- optional `VITE_DEMO_EMAIL`

Use `backend/.env.example` and `frontend/.env.example` as templates. Never inspect or copy real `.env` values into issues, logs, tests, or generated context.
