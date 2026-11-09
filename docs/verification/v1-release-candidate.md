# AlgoRythm v1.0 release candidate — 2026-11-09

**Release is blocked.** Supabase reports `AlgoRythm-staging`
(`aexhskdofnpqqraapigk`, ap-northeast-1) as `INACTIVE`. A bounded read-only
connection probe returned “Database is possibly not accessible at the moment.”
The October 22 catalogue is historical evidence, not a current schema check.
No staging write, Auth user, production access, merge or deployment was performed.

The candidate `codex/algorythm-v1.0-rc` starts at
`database/staging-bootstrap` (`5019c3b`). Each of the actual GitHub head refs
for PRs #2–#8 is an ancestor. No cherry-picks or duplicate commits were needed.
Application source, historical migrations and recovery/bootstrap SQL are unchanged.
The release branch suppresses automatic Vercel Git deployment.

## Integrated product evidence

The optimized Vite bundle ran in Chrome 156 with real Pyodide 314.0.7 assets
from jsDelivr. The existing browser harness passed 50 assertions, including
15 canonical fixtures. Its cloud responses were synthetic. A second run sent
real Playground requests to the local FastAPI server, with synthetic browser
identity and no Supabase or Gemini credentials. These runs cover the product UI
and local APIs; neither is hosted acceptance.

| User flow | Status | Evidence boundary |
| --- | --- | --- |
| Landing, Auth forms, protected route | PASS | Optimized bundle loaded; signed-out Playground redirected to Auth. |
| Signup, login, logout, durable Auth session | NOT VERIFIED | No working hosted Auth target; a synthetic local session is not proof. |
| Playground initialization and five algorithms | PASS | Bubble, selection, insertion, binary and linear traces matched v1 fixtures. |
| VisualCanvas, StepPlayer, editor and examples | PASS | Highlighting, stepping, play/pause, final arrays, edits and example reset. |
| Complexity | PASS | Bubble Sort O(n²), cached repeat, cancellation and timeout preserve playback. |
| Classification and Mentor | PASS | Actual FastAPI Bubble Sort result and credential-free fallback appeared in the UI. Live Gemini was not tested. |
| Python errors, infinite loops, restart and Retry | PASS | Syntax/index errors, timeouts, recovered Run and deliberate CDN failure/Retry. |
| Refresh and navigation | PASS | Worker retired on navigation and ran again after navigation and refresh with a synthetic local session. No uncaught page errors. |
| Session save/history and profile refresh | NOT VERIFIED | Fixture receipts and save-failure handling exercised only; hosted persistence unavailable. |
| Task catalogue and provisional progress | NOT VERIFIED | Fixture task starter opened and executed; hosted catalogue and progress unavailable. |
| Authoritative XP and streak | NOT VERIFIED | Synthetic receipt display is not hosted reward acceptance. |
| Daily Quiz and Algorithm Pet | NOT VERIFIED | Hosted data and ownership behavior unavailable. |

No runtime P0/P1 failure reproduced in the flows that ran. The deployment
guide no longer directs operators to apply the legacy Pet/Quiz SQL on its own.
The historical browser reward grants must remain inaccessible during bootstrap.

## Intentional limits and backlog

Task progress and Quiz correctness are practice, not proof of a correct solution.
XP and streak come from server-settled activity, with 5 XP at most per UTC day
per account. Verified-solution rewards and completion-based unlocks are unavailable.
Algorithm Pet is cosmetic. Keep the existing Gemini SDK deprecation, classifier
artifact version warning and hook lint warnings in the noncritical backlog;
the browser worker and fallback worked in this run.

## Release gate

Restore the [exact staging project](https://supabase.com/dashboard/project/aexhskdofnpqqraapigk)
to active. Then resume the read-only checks in the
[existing bootstrap runbook](staging-bootstrap.md). Any hosted bootstrap and
synthetic acceptance need separate approval. Release approval, merge, coordinated
production rollout and smoke testing remain gated by staging acceptance.
