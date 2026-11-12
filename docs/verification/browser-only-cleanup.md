# Browser-only execution cleanup (Prompt 7)

The backend does not execute user Python source. BrowserEngine → Pyodide Web
Worker → Trace Protocol v1 → committed visualization is the only execution path.
Complexity counts and fitting also run in the browser. `/classify` still receives
source for AST/model classification; mentor and session requests may also carry
source as context or stored history. This is an execution boundary, not a claim
that source never reaches the backend.

## Dependency audit before deletion

| Former component / callers | Final disposition |
| --- | --- |
| ServerEngine, engine factory, environment selector | Deleted; `useTracer` constructs BrowserEngine directly |
| Initialization fallback in `useTracer` | Deleted; unavailable status and localized Retry use the existing manager |
| `/analyze`, AnalyzeRequest, trace/classifier timing wrapper | Deleted; no replacement execution endpoint |
| `/complexity`, ComplexityRequest, generated-input execution and NumPy fitting | Deleted; existing browser count/cache/fitting retained |
| `sandbox.py`, process/queue transport, child timeout/termination and Linux memory limit | Deleted; no remaining backend caller |
| `backend/tracer.py`, worker raw-source import | Canonical implementation moved to `frontend/src/runtime/tracer.py`; obsolete sandbox helper removed |
| Demo seed executor call | Replaced with six source-matched saved example traces; no execution during seeding |
| Server benchmark and live two-engine harness | Removed; historical measurements preserved; runnable browser verification compares frozen v1 traces |
| Executor-specific tests | Removed; browser semantics moved to `tests/browser_runtime`; runtime Retry, route absence, source-only classification and session storage covered |

The 15 expected regression traces were frozen from the verified migration
baseline before deletion. They preserve every v1 field without enrichment or
timing diagnostics. Runtime hard deadlines remain owned by the worker manager,
not the Python runner. No backend execution module is retained for rollback.
The catalog seed's local syntax check compiles fixed starter templates but never
executes them; classification only extracts AST features.

No production requirement became unused: NumPy supplies classifier vectors,
joblib loads the fixed model artifact, and scikit-learn supplies its estimators
and label encoder. FastAPI/Uvicorn/Pydantic, dotenv, SlowAPI, Supabase/HTTPX, and
the Gemini SDK still support the remaining service. Executor-only `re`, `time`,
NumPy imports in `main.py`, and the stdlib process infrastructure were removed.
The classifier implementation and dependency versions were not rewritten.

## Verification

- All 15 cases pass against the real Pyodide worker, both through the optimized
  emitted worker and the runnable `/dev/browser-verification.html` harness:
  five supported algorithms, SyntaxError, IndexError, timeout/recovery,
  truncation, tuple/locals/highlights, caught exception, final-line mutation,
  empty/missing arrays, and restricted imports.
- A deliberately failed worker constructor produces unavailable status, disabled
  Run, Retry, zero backend requests and zero unhandled rejections. Retry boots the
  real Pyodide worker; the subsequent Run commits 38 steps and makes only the
  expected classification/session secondary requests. Synchronous prewarm
  failure cannot silently start a second initialization.
- Real UI timeout shows the canonical empty timeout result and automatically
  recreates the worker. The next valid Run commits 38 steps and clears the old
  timeout; Python errors/timeouts do not expose initialization Retry.
- Manual uncached Bubble Sort complexity dispatches five count requests with
  counts `[41,156,611,2421,9641]`, producing O(n²), fit 100%. Repeating dispatches
  zero additional counts. Invalid Python produces an isolated insufficient-data
  error, preserving the visible 38-step trace and editor. No backend complexity
  requests occur.
- Frontend lifecycle regressions cover classification failure/deadline/staleness,
  progress, attempts, first-solve XP, achievements, ordered session writes,
  profile refresh, mentor storage/replies, audio, reset, and teardown.
- Backend source/import guards exclude user-code execution and runtime imports;
  real classification receives a side-effecting source string without executing
  it. Session regression stores supplied source/trace with the verified owner,
  awards XP/achievement rewards, and never executes that source.
- Actual Uvicorn startup succeeds with integrations disabled and dotenv disabled.
  Health returns 200; OpenAPI contains `/`, `/curriculum`, `/classify`, `/mentor`,
  `/session/save`, `/auth/demo-login`. Both retired execution routes return 404.
  A real model classification returns Bubble Sort with confidence 1.0.

Cloud requests in browser smoke/performance runs use synthetic responses; unit
tests mock Supabase and Gemini. No live schema, auth, provider, or deployment
changes were made. Existing classifier cross-version and Gemini SDK warnings
remain documented in Known Issues.

## Warm Run → trace committed measurement

The boundary is identical to Prompt 6: a capturing Run click listener starts the
clock; a MutationObserver stops it only when the new input's first bar is present
in committed visualization DOM and the runtime is ready. Worker message arrival
alone is not the stop boundary. Alternating first array values 5/6 avoids matching
the old chart. Ten warm five-element Bubble Sort Runs follow one native pointer
priming Run; samples then use `button.click()` after 30 ms editor commit settling.
Initialization is excluded. Optional audio is already primed. The optimized Vite
bundle runs in HeadlessChrome 154 on the same local machine; secondary responses
are synthetic and delayed (classification 200 ms, save 500 ms, profile 200 ms).

| Metric | Prompt 6 | Prompt 7 |
| --- | ---: | ---: |
| Mean warm Run → committed trace DOM (10 Runs) | 6.06 ms | 6.27 ms |
| Warm sample range | 2.7–8.4 ms | 3.5–8.6 ms |

Prompt 7 raw samples in ms:
`[3.5,6.6,5.7,6.2,5.1,7.8,6.5,6.3,8.6,6.4]`.
The 0.21 ms difference is within the observed sample variation; this cleanup
shows no material regression and makes no additional optimization claim.
Across prime plus ten samples: 11 trace dispatches, zero count dispatches,
11 classification requests, 11 session requests, all secondary starts after
visualization exists, and zero browser errors/unhandled rejections.

The temporary synthetic preview/measurement harness was removed after checking;
it was never a product route or analytics feature. Current reusable verification
is `make check` and the browser-only dev harness described in Workflows.

## Final standard checks

`make check` passed under Node 24 with dotenv disabled. The validation wrapper
adds `--mode test` to the optimized Vite build so local real `.env` files are
never loaded; it does not change production source or build optimization.

- Ruff: passed; ESLint: zero errors, nine existing hook-dependency warnings.
- Vitest: 110 passed across 13 files.
- Pytest: 64 passed (19 backend/cloud/security, 45 browser-runtime semantics).
- Context unit tests: six passed.
- Python compilation and optimized frontend build: passed. The emitted worker
  is `python.worker-BTCyUxHW.js`, identical to the worker used by the production
  preview checks. Production output excludes the development harness.
- `make context`, `make context-strict`, and `git diff --check`: passed.
