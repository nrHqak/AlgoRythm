# Migration handoff

Verified checkpoint: **2026-10-21**, branch
`recovery/pyodide-migration-checkpoint`, migration commit
`8dc4679a2e882ae4a4a5808bd9d390a077dd380c`.
Review: [PR #2](https://github.com/nrHqak/AlgoRythm/pull/2), targeting `main`.
The migration commit was pushed and independently matched against the remote ref
before this handoff was written. No merge is authorized by this checkpoint.

## Current architecture, verified from source

```text
React/Vite Playground → BrowserEngine → module Web Worker → Pyodide
                                                     → Trace Protocol v1
                                                     → visualization/playback
Secondary work: classification, task progress, session/XP/achievements,
profile refresh, mentor, and explicit browser complexity analysis.
```

Python execution, tracing, and complexity counts run in the worker, never in
FastAPI. BrowserEngine is the only execution engine. Initialization/recovery
failure shows unavailable status and Retry. Execution timeout retires the worker
and starts recovery. The backend retains AST/model classification, mentor,
authenticated privileged persistence, curriculum, health, and demo login.
Source still reaches classification, mentor context, and stored session history;
this is not a source-code privacy/offline guarantee.

## Migration phases present in the published code

| Prompt | Current evidence and historical boundary |
| --- | --- |
| 1 — instrumentation / protocol | Trace Protocol v1 and regression fixtures remain. Server timing instrumentation/benchmarks were intentionally removed in Prompt 7; results survive in verification reports. |
| 2 — browser runtime | Pinned Pyodide loader, module worker, prewarm, request IDs, initialization deadline, execution timeout, restart and teardown. |
| 3 — parity | Frozen 15-case v1 traces and runnable browser verification preserve the comparison baseline. Live ServerEngine parity is historical, since that engine was removed. |
| 4 — cutover | `useTracer` constructs BrowserEngine directly; normal Run has no backend execution request. |
| 5 — browser complexity | Lightweight count mode, five input sizes, six fitting profiles, bounded cache, cancellation and failure isolation. |
| 6 — secondary lifecycle | Classification and post-run work start after trace commit; ordered progress/session promises and generation guards protect newer UI state. |
| 7 — cleanup | No backend executor, sandbox, execution routes, server engine selector or fallback. Demo seeding reads saved traces. |

These are verified final artifacts, not seven separate historical commits. The
previous local work was uncommitted and is preserved together in the migration
checkpoint. Historical parity/performance claims remain explicitly historical.

## Relevant modules and contracts

| Area | Files and boundary |
| --- | --- |
| Execution | `frontend/src/hooks/useTracer.js`, `execution/browserEngine.js`, `hooks/usePythonRuntimePrewarm.js` |
| Worker lifecycle | `frontend/src/runtime/pythonWorkerManager.js`, `python.worker.js`; one active request, UUID correlation, 60 s initialization and 2 s execution deadlines |
| Canonical Python semantics | `frontend/src/runtime/tracer.py`, `browser_trace.py`; one tracer implementation and fresh user globals per request |
| Trace | `frontend/src/execution/traceProtocol.js`; `{trace_version:1,steps,error,total_steps,truncated}`, trace cap 300; [full v1 semantics](TRACE_PROTOCOL.md) |
| Classification | `frontend/src/execution/classifyCode.js`, `backend/classifier.py`, `POST /classify {code}` → `{algorithm_type,algorithm_confidence}`; AST/model only, no source execution |
| Enrichment | Post-commit request, 10 s bound, unknown/0 on transport failure/deadline; separate promise for session metadata and stale-result protection |
| Complexity | `frontend/src/execution/complexity.js`, `hooks/useComplexity.js`; explicit count mode returns `{count,error,truncated}`, cap 25,000, sizes 5/10/20/40/80; at most 20 immutable successful cached results |
| Persistence / mentor | `frontend/src/pages/PlaygroundPage.jsx`, `hooks/useProfile.jsx`, `backend/main.py`, `backend/mentor.py` |
| Cloud ownership | `/session/save` verifies Supabase bearer identity and stores browser trace/source, rewards XP/achievements; browser task progress and mentor-message writes remain under existing RLS |
| Regression coverage | `frontend/src/**/__tests__/`, `backend/tests/`, `tests/browser_runtime/`, `tests/fixtures/` |
| Real-worker comparison | `frontend/dev/browser-verification.html`, `execution/dev/browserVerification.js`; development only, no backend dependency |

Run does not await classification, cloud saves, profile reads, mentor, or audio
readiness. Normal Run dispatches one trace and no complexity samples. Session
saving awaits classification and task progress in background work; mount-local
tails serialize progress and session updates. Historical saves may finish, but
execution generations guard visible feedback. Profile reads additionally guard
auth lifetime and overlapping reads. Mentor storage awaits the matching session
ID, or null on save failure. See [Contracts](CONTRACTS.md) and
[Browser runtime](PYTHON_RUNTIME.md) for the detailed boundaries.

## Validation performed for this checkpoint

- `make check`: **passed**, 64 Python tests, 110 frontend tests, six context tests,
  Ruff, ESLint, Python compilation, and optimized Vite build.
- `make context-check`, `make context-strict`, and staged `git diff --check`:
  passed. Staging exposed two new-file trailing blank lines; only those EOF
  formatting issues were corrected before the migration commit.
- Actual `python -m uvicorn main:app` startup from `backend/`: passed; health 200,
  real Bubble Sort classification with confidence 1.0, `/analyze` and `/complexity`
  absent from OpenAPI and returning 404. The temporary server was stopped.
- Staged file/path and credential-pattern review: passed; real `.env` files,
  dependencies, builds, environments and caches were excluded.

Local validation used Node 24 and Python 3.14.3; documentation/CI request Python
3.14.7. `PYTHON_DOTENV_DISABLED=1` and blank integration configuration prevented
backend secret-file access. A temporary npm shim added `--mode test` only to the
optimized frontend build, using the existing secret-free Vite env directory.
No application behavior or dependency versions were changed for this checkpoint.
Cloud tests mock Supabase/Gemini. Live cloud data, auth, deployed CSP/CDN policy,
and cross-browser behavior were not revalidated. GitHub CI status is tracked on
the PR separately; the migration commit `8dc4679` passed all three GitHub CI
jobs (backend, frontend, context). A later handoff commit requires its own checks;
local results must not be reported as remote CI results.

## Historical measurements, not rerun here

[Prompt 7 verification](../verification/browser-only-cleanup.md) records a warm
Run click → newly committed visualization DOM mean of **6.27 ms**, ten five-item
Bubble Sort runs, versus **6.06 ms** in Prompt 6 using the same boundary. The
optimized local browser harness used synthetic delayed cloud responses and
excluded initialization. These are recorded local measurements, not production
latency, current checkpoint timings, or worker-message-only timings. The report
also records real Pyodide passes for all 15 cases; this checkpoint reran unit and
build checks rather than that browser harness. Earlier reports remain in
`docs/verification/` with their historical-architecture notices.

## Confirmed limitations and technical debt

- Initial Pyodide load requires pinned jsDelivr assets; offline/self-hosting is
  not configured. There is no browser memory quota or hardened hostile-code
  isolation guarantee; suspended-tab scheduling can delay deadline enforcement.
- Classifier artifact: scikit-learn 1.6.1 serialization versus runtime 1.9.0;
  current classification tests pass, but the library emits compatibility warnings.
  NumPy, joblib and scikit-learn remain necessary for the current classifier.
- Gemini uses the deprecated `google-generativeai` SDK. Current tests use mocks.
- Persistence ordering is local to a mounted Playground; backend reward updates
  are read/modify/write, without a cross-tab transaction/idempotency guarantee.
- The full canonical baseline for core Supabase tables is missing. Live schema
  cannot be inferred safely from the incremental migrations.
- Nine existing hook-dependency lint warnings remain. CI's Ruff command currently
  omits browser-runtime Python, which `make lint` includes.
- `DEPLOY.md` retains legacy environment/path instructions (for example
  `VITE_DEMO_PASSWORD` and `venv/`) that differ from Contracts/current setup; use
  Contracts and Workflows as the verified setup references pending doc cleanup.

## Recommended Prompt 8 — production-readiness verification

Add repeatable real-worker browser tests for supported algorithms, errors,
truncation, initialization Retry, timeout/recovery, explicit complexity/cache,
and delayed/failing secondary requests. Then verify staging CDN/CSP behavior and
authorized cloud integrations without exposing credentials. Address classifier
artifact compatibility, Gemini SDK migration, CI parity and setup-document drift
as focused follow-ups, with their own regression checks. Do not implement new
visualizers or change the architecture as part of this verification phase.

Preserve BrowserEngine/worker ownership, the canonical tracer, v1 snapshot/error
semantics, deadlines/builtin policy/caps, explicit complexity/cache behavior,
asynchronous lifecycle guards, and existing auth/RLS/service-role boundaries.
Do not reintroduce backend execution, duplicate the tracer, change to Trace v2,
rewrite the classifier or frameworks, or replace the working persistence flow
without a separately scoped requirement and tests.
