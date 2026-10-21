# Browser Python tracing and execution

The browser runtime is prewarmed when `PlaygroundPage` mounts. BrowserEngine is
the only execution adapter, with `execute({code,arrayVar,maxSteps})`. Python
execution and complexity counts run inside its Pyodide Web Worker; the backend
never executes user source. Normal Run performs no complexity work. The worker
returns [Trace Protocol v1](TRACE_PROTOCOL.md), with enrichment outside the core.

After React commits the browser trace, `useTracer` starts `POST /classify` in an
effect. The execution promise resolves independently; visualization, playback,
and audio can operate while detection is pending. The pending banner is replaced
by existing algorithm labels after enrichment. `algorithm_type` and
`algorithm_confidence` retain their names and values in trace state; confidence
has no existing Playground display. `waitForClassification(result)` is used only
by session saving, preserving its existing algorithm-type field without extending
the database contract. Failure or a ten-second enrichment deadline supplies
`unknown` / `0`; no execution retry occurs. New runs, resets, and unmount abort
old requests and settle their session metadata as unknown. Run IDs reject stale
results even if a server ignores cancellation.

Initialization/recovery failure exposes runtime unavailable and a localized Retry
button. Retry invokes the existing manager's `initialize()`, creating a fresh
worker; repeated clicks coalesce. Loading/running/restarting/error disable Run.
SyntaxError, runtime exceptions, bad logic, truncation, timeout, and classifier
failure never become initialization failures or trigger another execution path.

## Runtime and ownership

- `src/runtime/python.worker.js` is the only application module importing Pyodide.
  It uses the pinned official `pyodide` npm loader and version-matched jsDelivr
  assets via `indexURL`, following the [official bundler guide](https://pyodide.org/en/stable/usage/working-with-bundlers.html).
- Workers are modules, as required by the [official worker guide](https://pyodide.org/en/stable/usage/webworker.html).
  Vite excludes Pyodide from dependency prebundling and emits ES-module workers.
  Python execution never runs on the UI thread.
- The worker bundles `src/runtime/tracer.py` as raw Python source and loads its
  `AlgorithmTracer` into Pyodide. There is one canonical implementation of event
  detection, snapshots, highlights, exception recording, and truncation.
  `browser_trace.py` supplies the Pyodide compile/exec runner and serializes the
  result to JSON. No Python user source is interpolated into wrapper code.
- `PythonWorkerManager` owns worker creation, message correlation, timers,
  termination, recovery, and pending promises. Components do not handle messages.
- `usePythonRuntimePrewarm` creates a manager for each Playground mount and
  terminates it on unmount/navigation. React StrictMode's effect replay tears down
  the earlier worker before creating the replacement. Prewarm failure is caught
  and exposed through runtime status. BrowserEngine
  reuses this manager through the returned ref; no second worker is created.
  `useTracer` retires its engine/requests on teardown. Manager termination is
  idempotent when both lifecycle owners clean up. Status subscriptions drive the
  minimal localized runtime banner and Run readiness.

## Manager API

```javascript
const manager = new PythonWorkerManager();
await manager.initialize();
await manager.execute({ code: "assert 1 + 1 == 2", arrayVar: "arr", maxSteps: 300 });
await manager.restart();
manager.getStatus();
manager.terminate();
```

`initialize()` is idempotent while loading and reuses a ready/running worker.
`execute()` waits for initialization, generates a unique UUID request ID, and
allows only one active execution; simultaneous submissions reject with
`WorkerUnavailable`. Requests waiting for a retired initialization never dispatch
into a replacement worker.

`restart()` rejects pending work with `WorkerRestarted`, replaces the worker, and
returns its readiness promise. `terminate()` rejects pending work with
`WorkerTerminated`, clears timers/listeners, and returns to `idle`. Repeated
termination is safe; later initialization creates a fresh worker.

| State | Meaning |
| --- | --- |
| `idle` | No worker; initial or explicitly terminated state. |
| `loading` | First initialization in progress. |
| `ready` | Runtime loaded, no active execution. |
| `running` | One request awaiting a matching response. |
| `restarting` | Replacement worker loading after restart or timeout. |
| `error` | Worker creation, initialization, native worker, or message transport failure; worker retired. Explicit initialization may retry. |

The default execution deadline is **2,000 ms**, starting when execution is posted
(after initialization). On timeout the
manager terminates the worker, rejects the request with error name `timeout`,
creates a fresh worker, and reloads Pyodide. Automatic recovery failure leaves
`error` without an unhandled promise rejection. A separate **60,000 ms** startup
deadline prevents downloads or initialization from leaving promises pending
forever. Timeouts are configurable constructor options, expressed in milliseconds.
Browser timer scheduling can delay enforcement when the main thread/tab is
suspended; deadlines are not a real-time guarantee.

## Worker message contract

Main thread → worker:

```json
{"type":"execute","requestId":"unique-uuid","code":"assert 1 + 1 == 2","arrayVar":"arr","maxSteps":300}
```

Worker → main thread:

```json
{"type":"ready"}
{"type":"result","requestId":"unique-uuid","result":{"trace_version":1,"steps":[],"error":null,"total_steps":0,"truncated":false}}
{"type":"error","requestId":"unique-uuid","error":{"type":"RuntimeError","message":"Bridge failure"}}
```

Initialization failure uses `type: "error"`, `requestId: null`, and error type
`InitializationError`; it is not an execution response. Native worker failures
reject pending work with `WorkerError`; startup deadlines use
`InitializationTimeout`. The manager ignores unmatched request IDs, duplicate
readiness messages, and all messages from retired worker instances.

Python compile/runtime errors are returned in canonical result envelopes; error
messages are not wrapped in a Pyodide-specific stack. Infrastructure failures use
the `error` envelope. The worker runs Python synchronously **inside the worker**,
with fresh user globals per request. It installs `sys.settrace` only for user-code
execution and always removes it before returning. Bootstrap dictionary proxies
are released; the executor proxy lives for the worker lifetime.

The browser runner owns its builtin allowlist and permitted helper modules;
regression tests guard the policy. `arrayVar` and `maxSteps` control tracing.
BrowserEngine validates caps from 1 to 300. Python stdout/stderr are discarded
rather than forwarded to the browser console.

A browser timeout rejects the current request and restarts its worker.
BrowserEngine attaches an empty canonical timeout result as `error.trace`.
`executeTrace`, used by `useTracer` and browser verification, converts this
particular rejection to trace data. Other failures remain request errors.

## Current boundaries and verification

The worker isolates Python from the main UI thread and offers no direct DOM
access. The allowlist, step cap, and worker timeout are useful safeguards, not a
hardened container/VM boundary. There is no browser memory cap; builtin filtering
is not proof against all Python escapes or worker JavaScript/network access.
Fresh globals do not reset permitted module state (for example random seed) or
the filesystem. Worker termination keeps ordinary infinite loops off the UI
thread. No backend execution path exists.

Initial loading requires network access to jsDelivr; offline/self-hosted assets
are not configured. Ordinary unit tests mock Worker and Pyodide and never download
or boot the full runtime. Frontend tests cover manager lifecycle, request IDs,
timeouts, late messages, worker error envelopes, proxy cleanup, and prewarm
teardown. Production builds must emit a separate `python.worker-*.js` asset.

## Development browser check

Start Vite with `make dev-frontend`, then open
`http://localhost:5173/dev/browser-verification.html` and click Verify browser.
This harness is excluded from the production build. It imports frozen
`tests/fixtures/browser_traces.json`; `execution/dev/browserVerification.js`
compares every canonical field against real Pyodide output. It needs no backend
or cloud credentials and makes no backend execution requests.

The 15 fixtures cover all five supported algorithms, SyntaxError, IndexError,
timeout/recovery, a lower step cap, tuple/locals/highlights, caught exceptions,
final-line mutations, empty/missing arrays, and restricted imports. Python unit
tests for browser semantics live in `tests/browser_runtime`; JS lifecycle tests
mock Worker/Pyodide. Real worker verification also checks the emitted asset.
Migration timing evidence remains in `docs/verification/` as historical results.

## Explicit complexity analysis

`useComplexity` owns secondary analysis state and a mount-scoped cache, without
writing to `useTracer` or the player/editor. Its BrowserEngine wrapper reuses
`usePythonRuntimePrewarm`'s manager, never creating a second product worker.
`BrowserEngine.count({code,arrayVar,maxSteps,signal})` posts an internal `count`
request through that manager. The same Python compile/exec policy runs with
CountTracer: eligible-line/error/count semantics match AlgorithmTracer, but it
creates no arrays, locals, highlights, static event metadata or trace steps.
Results are only `{count,error,truncated}`. Mode is internal, not Trace Protocol v2.

Five sequential samples use sizes 5,10,20,40,80 and the legacy 25,000 step cap.
Each request retains the two-second execution deadline. Timeout stops the
remaining samples and reloads the worker. Capped samples are rejected as censored
data; ordinary Python-error samples contribute zero as in the legacy estimator.
At least three successful nonzero measurements are needed for fitting. All six
existing feature profiles, descending first-list replacement, least-squares scale,
SSE selection and R² confidence remain unchanged. Shared regression fixtures
compare the JavaScript fit against the legacy NumPy results.

Successful results are frozen and cached under a deterministic JSON tuple of
version/source/arrayVar/sizes/maxSteps. The cache retains at most 20 entries (oldest
insertion evicted), survives edits and Run within the same mount, and is discarded
on navigation. Returning to identical source uses its cached result with no
Python dispatch. Failed/cancelled analyses are not cached.

AbortSignal support in the manager terminates an active request, removes its
listener/timer, and starts background recovery. Cancellation between requests
just prevents further dispatch. A new Run cancels analysis and awaits recovery;
Run remains available to interrupt a count request, then is disabled while the
replacement loads. Code/array/example/task changes and teardown also cancel.
Secondary errors are localized and preserve the current trace, runtime error,
playback position, visualization and editor. Browser complexity has no backend
execution path; its action stays unavailable
until the browser is ready.

Measurements and product checks for count mode are in
[Browser complexity verification](../verification/browser-complexity.md).
