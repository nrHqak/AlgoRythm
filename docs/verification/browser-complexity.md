# Explicit browser complexity and trace payload verification

> Historical migration evidence. Prompt 7 removed the backend executor, execution routes, runtime selector, and live two-engine harness. Old commands below describe that phase and are no longer runnable. Current verification: `make check` and `/dev/browser-verification.html`; see [browser-only cleanup](browser-only-cleanup.md).

Measured locally on 2026-10-05, macOS arm64, headless Chromium 154.0.0.0,
Pyodide 314.0.7. The optimized worker asset was `python.worker-CtNL8MZO.js`.
The temporary verification entry mounted the actual Playground components/hooks,
with synthetic auth, profile, Supabase, session, classifier and mentor responses.
Before migration, `/complexity` used the real local backend, with its existing
sandbox, full-trace implementation, input generation and estimator. A temporary
wrapper measured the five calls without importing the FastAPI application in
spawned children. No live account, database or deployment was involved.

## Measurements

The default five-element Bubble Sort example was used throughout. Runtime prewarm
was completed before measurement and is excluded. Normal Run latency ends at
worker trace arrival; classification and persistence are outside that metric.
Complexity latency covers the actual hook promise (sampling, fit and cache lookup)
invoked by the UI action. Warm/cache values average five calls, retaining all
samples. These local observations are not production latency guarantees.

| Metric | Time | Python executions |
| --- | ---: | ---: |
| Before: Run → automatic complexity completion | 6248.50 ms | 6 (1 main + 5 full traces) |
| Before: Run → visible trace | 34.30 ms | 1 main; complexity then runs separately |
| Before: automatic complexity request | 6212.70 ms | 5 full traces |
| After: first ready Run → trace | 5.80 ms | 1 main |
| After: warm Run → trace, mean of 5 | 1.70 ms | 1 main per Run |
| Explicit uncached complexity | 12.10 ms | 5 count requests |
| Explicit cached complexity, mean of 5 | 0.36 ms | 0 |

Raw warm Run timings: `[2.6,1.7,1.2,1.3,1.7]` ms. Corresponding dispatch → trace
arrival timings: `[1.7,1.5,0.9,1.0,1.5]` ms. Raw cache timings:
`[0.3,0.5,0.4,0.3,0.3]` ms. Browser polling did not define the complexity timing;
the temporary hook wrapper recorded actual promise start/end timestamps.

The old backend samples returned `[41,156,0,0,0]`: input sizes 20,40,80 reached
the legacy two-second timeout and produced an insufficient-data result. Browser
count mode completed `[41,156,611,2421,9641]` for `[5,10,20,40,80]`, fitting
`O(n²)` with the existing estimator. Each count response contained only
`count,error,truncated`, with no visualization steps or snapshots. The legacy
NumPy fit agrees, and shared fixtures verify all six retained profiles.

## Product and network verification

- Every normal Run dispatched one `trace` request, no `count` requests, and no
  `/complexity` or `/analyze` requests. Classification/session flow remains separate.
- Analyze Complexity produced five sequential count requests on the prewarmed
  product worker. Repeated requests produced zero Python dispatches.
- The visible playback position and editor contents remained unchanged through
  analysis/cache hits. Code and array-variable changes select different keys;
  successful cache entries remain reusable when returning to the original source.
- A real `while True: pass` count request timed out after 2002.8 ms. The UI had
  127 main-thread heartbeat ticks, preserved its previous trace, displayed a
  secondary localized error, and reloaded a fresh worker in 1025.9 ms.
- Starting Run while a count sample hung retired that worker before any new trace
  dispatch. After fresh readiness, the user's valid program produced a three-step
  trace. There was no simultaneous browser/server or count/trace execution.
- Component tests verify pending-sample cancellation on Run, code/array edits and
  teardown, cache misses/hits, capped-sample errors, timeout recovery, and trace,
  playback, editor, error, sound and mentor-context preservation.
- All 15 production-worker/browser versus server parity fixtures passed, including
  five algorithms, Python errors, timeout/recovery, truncation, tuples/locals,
  caught exceptions, final-line mutation, empty/missing arrays and restricted import.
- All five actual Playground examples rendered bars and their expected event sets:
  Selection 46 steps, Insertion 42, Binary 18, Linear 11 and Bubble 38, each with
  Trace Protocol v1 and no selected-array duplication in locals.

## Snapshot behavior

The selected array remains in `step.array` and is omitted from `step.locals` only
when it is a list/tuple represented there. Other useful locals remain. Numeric,
string, boolean and null array items use an independent outer-list copy; nested
mutable containers retain deep snapshots. This also fixes nested tuple arrays
sharing old mutable values. The existing source-line event heuristic is computed
once per line rather than rerun on every snapshot. Proactive mentor context reads
`step.array` explicitly to retain the selected array after locals deduplication.
Trace version, step ordering, pre-line timing, errors, sounds and highlights remain v1.

## Boundaries and validation

The estimator retains first-list-literal replacement, descending generated input,
sizes 5–80, six profiles, no-intercept least squares, minimum SSE and rounded R².
As before, it is educational guidance, not a complexity proof. The concrete
censoring bug is handled by rejecting step-capped samples instead of fitting them
as genuine measurements. Requests retain 25,000 eligible-step and two-second caps.

The cache is mount-scoped frontend memory, bounded to 20 immutable successful
entries, with deterministic version/source/array/sizes/cap keys. No backend,
Supabase or external cache was introduced. Failed/cancelled analyses are not cached.
Normal Run can interrupt analysis and awaits worker recovery before dispatching.

`/analyze`, `/complexity`, ServerEngine, process sandbox and backend estimator remain
for rollback/legacy use and later cleanup. Browser complexity never uses server
fallback. Initialization failure leaves its action unavailable until the browser
runtime is usable. Existing browser memory/security and asset-loading boundaries
are unchanged.

Final `make check` passed: 90 frontend tests, 55 backend tests, six context
tests, Ruff, ESLint (zero errors; nine existing dependency warnings), Python
compilation, optimized Vite build and context drift check. The production build
emitted the tested `python.worker-CtNL8MZO.js` asset. `git diff --check` and
`make context-strict` also passed. Validation uses Node 24, `PYTHON_DOTENV_DISABLED=1`, and Vite's test-mode env
directory to avoid real local `.env` files while building optimized production
assets. The temporary verification entry and local servers are removed afterward.
