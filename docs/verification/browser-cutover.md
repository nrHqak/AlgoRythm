# BrowserEngine production cutover verification

> Historical migration evidence. Prompt 7 removed the backend executor, execution routes, runtime selector, and live two-engine harness. Old commands below describe that phase and are no longer runnable. Current verification: `make check` and `/dev/browser-verification.html`; see [browser-only cleanup](browser-only-cleanup.md).

Measured locally on 2026-10-05, macOS arm64, headless Chromium 154.0.0.0,
Pyodide 314.0.7. The optimized bundle emitted `python.worker-CpaGhqTM.js`,
the same worker asset as the normal production build. A temporary isolated entry
mounted the actual PlaygroundPage, CodeEditor, VisualCanvas, StepPlayer, locale,
tracing, playback, and audio hooks. Auth/profile, Supabase, session writes,
mentor, and complexity responses were synthetic; no live account or database
was used. Classification used the real local FastAPI endpoint and existing model.
The temporary entry/config were removed afterward.

## Measurements

Initialization is worker construction → ready message, separate from execution.
Execution is dispatch → worker trace result. Click → trace includes the actual
Run handler, audio unlock, and dispatch, ending before classification. First
execution used a fresh ready runtime for each program. Warm results are arithmetic
means of five subsequent runs, without dropping outliers. Programs exactly match
the Prompt 1 benchmark/shared parity fixtures. These are local observations,
not network-inclusive production guarantees.

| Metric | Milliseconds |
| --- | ---: |
| Initial prewarm (first page visit) | 3108.50 |
| Cached prewarm, fresh Bubble worker | 1021.10 |
| Cached prewarm, fresh Binary worker | 1239.30 |
| Bubble, first ready execution | 11.50 |
| Bubble, warm execution mean (5) | 7.40 |
| Bubble, first click → trace | 15.40 |
| Bubble, warm click → trace mean (5) | 11.08 |
| Bubble, first click → committed DOM trace | 16.80 |
| Binary, first ready execution | 53.40 |
| Binary, warm execution mean (5) | 3.70 |
| Binary, first click → trace | 62.10 |
| Binary, warm click → trace mean (5) | 4.04 |
| Binary, first click → committed DOM trace | 65.80 |

Raw warm dispatch → result measurements:
Bubble `[30.9, 1.4, 1.4, 1.6, 1.7]` ms;
Binary `[10.5, 2.7, 1.0, 1.0, 3.3]` ms.
Raw warm click → trace measurements:
Bubble `[48.3, 1.8, 1.7, 1.7, 1.9]` ms;
Binary `[11.4, 2.9, 1.2, 1.3, 3.4]` ms.

Prompt 1's same-machine Python 3.14.3/spawn warm baseline was Bubble sandbox
138.554 ms, classifier 16.720 ms, total 155.274 ms; Binary sandbox 211.392 ms,
classifier 16.016 ms, total 227.407 ms. Comparing execution alone, these observed
browser warm means are about 18.7× and 57.1× faster respectively. Both baseline
and browser measurements exclude HTTP transport. Initialization is paid on entry
and again after timeout; it is excluded from ready execution latency.

## Network and product evidence

- Normal Run: local dispatch → trace commit → `/classify`; zero `/analyze`
  calls. `/complexity` and `/session/save` retain their existing boundaries.
- A deliberate 1500 ms classifier delay left the trace and player usable.
  The first observed trace DOM committed before classification started, and the
  request observed `STEP / 001 / 038`. Real labels included Bubble Sort and
  Binary Search. Session payloads received the corresponding algorithm type.
- A synthetic classifier HTTP 503 retained the successful 38-step trace and
  saved unknown metadata, with no execution retry or `/analyze` request.
- Real SyntaxError produced the canonical line-1 error/highlight, no server
  execution, and no worker replacement.
- A synthetic Worker-construction failure selected initialization fallback:
  zero browser dispatches/workers; one `/analyze` request, no `/classify` request,
  and a successful enriched server trace.
- Full component tests cover editor, visual bars/highlights, stepping, event
  sound generation/muting, session payload, task starter code, example
  selection/reset, and error highlighting. Hook tests verify confidence.
  Confidence remains in trace state; Playground has no existing confidence display.

## Timeout recovery

`while True: pass` with no selected array reached the hard timeout rather than
step truncation. The first dispatch → termination interval was 2001.8 ms;
128 main-thread 16 ms heartbeat ticks occurred while execution timed out. Run was
unavailable in `restarting`, the canonical `Execution exceeded 2 seconds.` error
was visible, and a second worker became ready in 996.6 ms. Bubble Sort then
produced 38 steps successfully; zero `/analyze` calls throughout.

After the final hook update, the optimized bundle was tested again: one retired
worker, a new worker ready after 939.7 ms, timeout displayed, then a valid program
executed successfully. Dispatch → termination was 2008.3 ms. Timer scheduling
explains small deviations from the nominal 2000 ms deadline.

## Validation

Final `make check` passed: 70 frontend tests, 34 backend tests, six context
tests, Ruff, ESLint (zero errors; nine existing warnings), Python compilation,
optimized Vite build, and context drift check. `make context-strict` and
`git diff --check` also passed. Validation uses Node 24,
`PYTHON_DOTENV_DISABLED=1`, and Vite's test-mode env directory to avoid reading
real local `.env` files while producing an optimized production build. Existing
ESLint dependency warnings and upstream loader/deprecation warnings remain.

For a manual product check, enter Playground, wait for Python ready, run an
example, inspect Network for `/classify` after trace availability and absence of
`/analyze`, then run the infinite loop and a valid example after recovery. For
rollback, rebuild with `VITE_EXECUTION_ENGINE=server`. Deploy `/classify` before
or alongside the frontend bundle. No live deployment was performed in this phase.
