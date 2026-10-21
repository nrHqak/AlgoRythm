# Contracts

This document records integration boundaries, not every internal helper. Update it whenever a route, payload, ownership rule, or environment-variable name changes.

## HTTP API

| Method and path | Authentication | Request | Response responsibility |
| --- | --- | --- | --- |
| `GET /` | none | none | Health payload `{status: "ok"}` |
| `GET /curriculum` | none at FastAPI layer | none | `{tasks}` loaded with the service client |
| `POST /classify` | none; 20/minute | `ClassifyRequest` | `{algorithm_type, algorithm_confidence}` from the existing classifier; never executes source |
| `POST /mentor` | none | `MentorRequest` | Mentor message or deterministic fallback |
| `POST /session/save` | Supabase bearer token | `SessionSaveRequest` | Session id and newly earned achievements |
| `POST /auth/demo-login` | none; IP-limited | none | Supabase access/refresh tokens when demo mode is enabled |

The canonical execution shape and existing snapshot/error semantics are defined in
[Trace Protocol v1](TRACE_PROTOCOL.md). Every execution result includes
`trace_version: 1`. Classifier enrichment remains outside that protocol. The backend never executes
user source; classification and mentor receive it as context, while session
persistence stores it with browser-generated traces.

### Request models

- `ClassifyRequest`: non-empty `code`. A missing model returns `unknown` with confidence `0.0`; syntax errors retain the existing zero-feature model input. HTTP/network failures are handled as unknown by the browser.
- `MentorRequest`: code/error/error line, compressed trace context, optional question/history, and a mode defaulting to `free_chat`.
- `SessionSaveRequest`: source, trace result, algorithm metadata, solve/task state, XP, attempts, and mentor-message count. The authenticated user id is never accepted from the body.

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
without awaiting optional audio readiness, task progress, session saving, profile
or mentor work. Audio failure is intentionally silent and cannot prevent tracing;
delayed sounds are checked against the same execution generation. The Run
captures source, array variable, task, bearer token, mentor count and trace;
later editor changes do not change historical save payloads. Independent task
progress advances alongside classification; `/session/save` waits for both in
background work. Its existing algorithm_type field is preserved; confidence
remains frontend-only. Local progress/session promise tails preserve attempts,
first-solve rewards and XP ordering for consecutive Runs on this mounted page.
This does not provide a database transaction or cross-tab concurrency guarantee.

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
| `profiles` | owner select/insert/update | session reward updates |
| `task_progress` | owner select/insert/update | seed/admin workflows |
| `mentor_messages` | owner select/insert/update with session ownership check | seed/admin workflows |
| `pet_profiles`, `quiz_attempts` | owner select/insert/update | seed/admin workflows |
| `sessions`, `user_achievements` | owner select | service-role insert |

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
