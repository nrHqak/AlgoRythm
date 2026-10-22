# Production-readiness audit — 2026-10-22

## Assessment

**Browser migration verified; production release blocked by reward integrity.**
No P0 defect was found in the audited paths. The browser execution, playback,
recovery and explicit complexity flows pass. One confirmed P1 trust-boundary
issue remains: authenticated callers control persisted XP and completion claims.
No production deployment or merge was performed. Live cloud acceptance is also
outstanding; local mocks do not establish live authentication, RLS or durability.

Baseline: clean `recovery/pyodide-migration-checkpoint` at `943a5ed`, containing
migration `8dc4679a2e882ae4a4a5808bd9d390a077dd380c`. Work branched directly to
`audit/production-readiness`. PR #2 was inspected and remains a draft targeting
`main`; its branch was not rewritten.

## Verified architecture and environment

Playground → BrowserEngine → module Web Worker → pinned Pyodide → Trace Protocol
v1 → visualization/playback remains the sole execution path. Classification and
post-run work begin after trace commit; persistence awaits classification and
task progress in background work. Complexity is explicit browser count mode.
There is no backend executor, ServerEngine, `/analyze`, or `/complexity` route.
Source still reaches classification, stored sessions and Mentor context.

Environment: macOS 26.6.1, arm64 Apple M1, 8 GiB RAM, Node 24.19.0,
Python 3.14.3, Playwright 1.62.1, installed headless Google Chrome
155.0.8059.85. Vite 5.4.21 development helper at port 5173; optimized Vite build
served by preview at 4173; actual Uvicorn at 8000. Backend dotenv loading was
disabled, integration variables blank, and Vite used its secret-free test envDir.
Production optimization and emitted module workers were exercised. This is not a
hosted production deployment or a production latency claim. CI requests Python
3.14.7; that patch version was not available locally.

No disposable staging account/environment was supplied or identified as
authorized for writes. No live Supabase or Gemini operation was performed.
Browser auth/profile/task/session/Mentor fixtures are synthetic and confined to
local interception. Actual Python execution and jsDelivr downloads are real.

## Real-worker results

The existing helper passes all 15 frozen canonical fixtures. Comparison includes
every v1 field, step count, final array, line, event, highlight, local snapshot,
error and truncation flag; no mocked Pyodide is involved.

| Fixture | Steps | Error / truncation | Result |
| --- | ---: | --- | --- |
| Bubble Sort | 38 | none | PASS |
| Selection Sort | 47 | none | PASS |
| Insertion Sort | 40 | none | PASS |
| Binary Search | 15 | none | PASS |
| Linear Search | 13 | none | PASS |
| SyntaxError | 0 | SyntaxError | PASS |
| IndexError | 2 | IndexError | PASS |
| Timeout | 0 | timeout | PASS |
| Truncation | 4 | truncated | PASS |
| Tuple / locals / highlights | 4 | none | PASS |
| Caught exception | 6 | IndexError | PASS |
| Final-line mutation | 1 | none | PASS |
| Empty array | 1 | none | PASS |
| Missing array | 0 | none | PASS |
| Safe builtins | 2 | ImportError | PASS |

Extra real-worker checks cover ZeroDivisionError, nonexistent imports,
immutable old traces after later executions, five sequential count samples,
cache identity, source/array-variable cache misses, count timeout, cancellation,
and successful tracing after both recovery paths. The manager keeps its existing
2,000 ms execution and 60,000 ms initialization deadlines. The timeout test
observed 2001.600 ms and 100 main-thread 20 ms heartbeat callbacks;
this establishes responsiveness during that run, not a real-time scheduling
guarantee. Runtime initialization coalescing, request-ID mismatches, retired
worker messages, initialization deadline, transport failures, abort cleanup and
unmount settlement additionally pass deterministic mocked-Worker unit tests.
Those tests are lifecycle evidence, separate from real-worker results.

## Actual Playground integration

The optimized emitted worker reproduces the exact frozen traces for all five
algorithms, then StepPlayer reaches each final array. Each algorithm resets to
step one on a repeated equal-length Run. Highlighted SVG bars match the fixture
highlights. CodeEditor edits, example selection/reset, task starter loading,
Run readiness, Next/Prev, Play/Pause and rendering pass through the real page.
Web Audio oscillator scheduling and mute/unmute pass; audible output was not
assessed because headless Chrome mutes the audio device.

One normal Run dispatches exactly one trace request and zero count requests.
Prewarm creates one product worker. Navigation away terminates it; navigation
back initializes a new runtime and executes successfully. A normal infinite-loop
Run displays timeout, reloads the worker and permits the next valid Run.
SyntaxError now appears directly even with no visualization or available Mentor.
Initialization failure disables Run and exposes Retry. Blocking jsDelivr for a
fresh runtime, restoring it and clicking Retry loads a fresh real runtime, after
which Run succeeds.

Explicit uncached Bubble Sort analysis sends five count requests; the result is
O(n²) with counts [42, 157, 612, 2422, 9642]. Repeating it sends no additional requests.
Source/array-variable edits miss the appropriate cache key. Cancellation and
timeout in the actual UI preserve the visible trace and playback; recovery
permits subsequent work. Failure remains secondary. No estimator, sample sizes,
cache semantics, trace format or execution architecture was changed.

## Integration and network

| Boundary | Evidence | Status |
| --- | --- | --- |
| Classification | Actual local model, source-only regression, browser CORS and 10 measured requests; result Bubble Sort / confidence 1.0 | PASS locally |
| Slow/failed/stale classification | Actual page with synthetic responses plus deterministic tests ignoring cancellation | PASS; newer trace/metadata preserved |
| Session/progress/XP/achievements/profile | Mock-cloud page and unit tests: delayed writes, failures, ordering, attempts, first-solve rewards, stale feedback and profile reads | PASS with mocks only |
| Bearer verification | Missing/malformed/rejected identity produces 401; valid token passed to mocked `auth.get_user`; saved owner taken from verified identity | PASS with mocks; live auth NOT VERIFIED |
| Mentor | Actual local endpoint returns deterministic fallback without an API key; page/units cover failed and stale replies, separate storage, matching session IDs | PASS locally/mocked; Gemini NOT VERIFIED |
| Live Supabase schema, RLS, auth refresh/revocation, stored sessions/rewards/task progress/profile | No authorized staging fixture | NOT VERIFIED |
| Hosted CSP/CDN policy and deployed CORS | No deployment tested | NOT VERIFIED |
| Additional browser engines | Chrome only; no Firefox/WebKit run performed | NOT VERIFIED |

Actual Uvicorn health returns 200; OpenAPI excludes both removed execution
routes and includes `/classify`. Missing-bearer `/session/save` returns 401.
The source/import regression rejects backend user-code execution. The frontend
contains no service-role credential reference; service configuration remains
backend-only. These checks do not certify the unknown live RLS baseline.

Actual browser requests from `http://localhost:5173` reach local `/classify` with
JSON preflight; the default policy rejects `http://127.0.0.1:5173`. The preview UI
uses mocked cloud responses, so its origin is not evidence of deployed CORS.
Configure `ALLOWED_ORIGINS` for the exact frontend origin before release.
Repository Vercel configuration has SPA rewrites and no CSP header. A hosted CSP
was not inspected. Real CDN/JS asset response statuses and browser checks are in
the raw result artifact. Expected console failures from deliberately injected
503 responses are separate from uncaught JavaScript errors; no uncaught product
page errors occurred.

Pyodide uses version-matched jsDelivr assets, including WASM/standard library.
First-use readiness therefore depends on external network/CDN availability.
A blocked CDN produces the observed unavailable/Retry flow. This audit injects
network failures; it does not establish a fully offline app shell or self-hosted
runtime. No automatic backend execution fallback exists. Backend requests after
Run are classification, authenticated saving, and error-triggered Mentor only;
no backend execution or automatic complexity request was observed.

## Measured performance

All values are milliseconds from this audit run. Raw observations are retained
in `production-readiness-results.json`; earlier Prompt 6/7 measurements were not
reused or compared as current results.

| Boundary | n | Average ms | Median ms |
| --- | ---: | ---: | ---: |
| Playground navigation → ready (real CDN) | 1 | 3157.500 | 3157.500 |
| Helper initialization (cached assets) | 1 | 970.100 | 970.100 |
| Bubble Sort first execution after readiness | 1 | 1.800 | 1.800 |
| Bubble Sort warm execution | 10 | 0.560 | 0.550 |
| Binary Search first execution after readiness | 1 | 3.100 | 3.100 |
| Binary Search warm execution | 10 | 0.690 | 0.600 |
| Bubble Sort Run click → committed visualization | 10 | 1.600 | 1.500 |
| Binary Search Run click → committed visualization | 10 | 1.800 | 1.550 |
| Explicit uncached complexity | 1 | 10.100 | 10.100 |
| Identical cached complexity | 10 | 0.010 | 0.000 |
| Actual local classification (including first load) | 10 | 124.160 | 14.450 |
| Synthetic classification response body | 12 | 59.942 | 83.600 |
| Synthetic session response body | 37 | 123.835 | 123.700 |

Execution measurements surround `engine.execute()` after readiness and exclude
initialization, classification and DOM commit. Each algorithm's first sample
follows a fresh initialized worker; warm samples follow on that worker. These use
five-item frozen algorithm fixtures. DOM measurements start in a capturing click
listener and end in a MutationObserver when the uniquely changed first bar is
committed and the runtime is ready. Bubble uses five items; Binary Search uses
six ascending values and an adjusted target. Ten programmatic clicks follow
native-pointer priming. This is DOM commit, not a painted-frame measurement.

Entry→ready uses the navigation time origin through observed readiness, including
local browser-driver observation overhead, in a fresh isolated browser context;
n=1 is descriptive. The separate helper initialization reuses cached CDN assets
and is not a cold-start claim. Single-sample rows have identical mean/median.
Cached analysis values at zero reflect browser timer resolution, not literally
zero work.

Local classification measures request dispatch through parsed JSON over browser
CORS to the actual local model, including its first lazy-load cost. Synthetic
classification/session rows measure fetch dispatch through response-body
completion, including configured 20–300 ms classification and 120 ms save delays
and local scheduling. Only successful responses are included in those aggregates;
raw failures remain in the artifact. Mock persistence completion cannot establish
real database durability. Profile completion and actual live-cloud session latency
are NOT VERIFIED; they are not folded into execution or DOM timings.

## Findings and fixes

| Priority | Confirmed finding | Disposition |
| --- | --- | --- |
| P1 | Authenticated callers control `xp_earned`, `solved`, task-completion and hint/attempt claims; `save_session` applies supplied XP using the service client. Browser profile ownership also permits owner updates by the documented contract. | RELEASE BLOCKER documented; separate trusted reward/authorization design required. |
| P1 | Python errors other than timeout were absent from direct Playground feedback, leaving diagnosis dependent on Mentor. | Fixed in `PlaygroundPage.jsx`; real SyntaxError and regression test pass. |
| P2 | Equal-length replacement traces retained old playback position/play state. | Fixed by resetting on steps-array identity; classification metadata does not reset it. Regression failed before fix and passes after. |
| P2 | CI Ruff omitted canonical browser Python files covered locally. | Added `frontend/src/runtime` to CI lint command. |
| P2 | Session insertion, achievement writes and profile XP updates are separate operations; mount-local ordering cannot make them atomic or cross-tab idempotent. | Existing unresolved persistence limitation; no schema change authorized here. |
| P2 | CDN-dependent first use, no memory quota, and suspended-tab deadline scheduling limits. | Confirmed runtime boundaries; recovery verified, no isolation redesign. |
| P2 | Classifier pickle/library skew (1.6.1 → 1.9.0) and deprecated Gemini SDK. | Warnings reproduced; model/SDK migration deferred as requested. |
| P3 | Nine hook-dependency warnings and legacy deploy-document setup drift. | Existing debt; no broad hook/dependency rewrite. |

The XP issue was reproduced entirely in memory using FastAPI TestClient,
a simulated verified owner and a mock Supabase client: submitting `code: "pass"`
with `xp_earned: 1000000000` returned 200 and wrote 1,000,000,000 to the mock
profile. No external account/data was used. Bounding one numeric field would not
solve forged completion/achievement claims, editable owner reward fields or
replayed requests. Fixing that larger trust boundary requires server-authoritative
reward rules and an ownership/idempotency review while preserving browser-only
execution. No backend execution or schema modification was introduced to mask it.

## Validation and coverage limits

- Supported-environment baseline: `make check` passed 64 Python, 110 frontend and
  six context tests, lint, compilation and optimized Vite build.
- Final `make check`: 66 Python, 112 frontend and six context tests pass; nine
  existing ESLint warnings, no lint errors. Builds retain Vite's Pyodide `node:url`
  browser-external warning; the emitted worker is verified in Chrome.
- `make context-check`, `make context-strict`, `git diff --check`: pass.
- Actual Uvicorn startup/health, local classification, CORS and Mentor fallback:
  pass without integration configuration.
- Optional real-browser audit: 49 named checks plus 15 exact fixture
  comparisons and extended real-worker checks pass. Not part of credential-free CI.
- Initial host Node 25.8.2 attempt: 29 frontend tests failed because its
  `localStorage` object did not match jsdom expectations. The project declares
  Node 24; rerunning there passed. This failure was not suppressed or hidden.

Unit suites intentionally mock Worker/Pyodide and cloud services. They establish
stale-message, delayed-operation, auth ownership and lifecycle determinism, not
live provider success. Actual browser cases separately establish worker execution
and UI integration. No live cloud, hosted deployment, cross-engine, audible-device,
long-duration memory stress or suspended-tab acceptance result is claimed.

## Reproduce safely

Use Node 24, the repository `.venv`, installed Chrome and optional Playwright
1.62.1. Playwright can be installed outside the repository with
`npm install --prefix /tmp/algorythm-audit-tools playwright@1.62.1`; set
`PLAYWRIGHT_MODULE=/tmp/algorythm-audit-tools/node_modules/playwright/index.mjs`.
No project dependency or lockfile change is required.

In separate terminals from the repository root:

```bash
VITE_API_URL=http://127.0.0.1:8000 VITE_SUPABASE_URL=https://audit.invalid \
VITE_SUPABASE_ANON_KEY=synthetic-anon npm --prefix frontend run dev -- --mode test --host 127.0.0.1

VITE_API_URL=http://127.0.0.1:8000 VITE_SUPABASE_URL=https://audit.invalid \
VITE_SUPABASE_ANON_KEY=synthetic-anon npm --prefix frontend run build -- --mode test
npm --prefix frontend run preview -- --host 127.0.0.1

cd backend
PYTHON_DOTENV_DISABLED=1 SUPABASE_URL= SUPABASE_SERVICE_KEY= GEMINI_API_KEY= \
../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Restart that local backend before repeated audit invocations: `/classify` retains
its real 20/minute rate limit. Then run `node scripts/browser_audit.mjs` with
Playwright resolvable as above. It writes `/tmp/algorythm-browser-audit.json` by
default, exits nonzero on failure and closes its browser. Synthetic build settings
must be used; do not point this script at a real cloud/deployment account.

For final validation, `make check` used Node 24 on PATH and an external temporary
npm shim appending `--mode test` only to its frontend build command. Backend
integration names were blank with `PYTHON_DOTENV_DISABLED=1`. This avoids loading
real ignored `.env` files without changing application build configuration.

## Recommended next phase

Resolve the authenticated reward trust boundary and persistence atomicity in a
separately scoped security phase; export/review the missing canonical database
baseline rather than inferring live RLS. Then perform disposable staging acceptance
for auth, rewards, persistence, task progress, profile, Gemini, exact deployed CORS
and CDN/CSP policy. Review classifier artifact and SDK compatibility separately.
Do not treat this local audit as approval to merge or deploy.
