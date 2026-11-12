# Post-execution lifecycle verification

> Historical migration evidence. Prompt 7 removed the backend executor, execution routes, runtime selector, and live two-engine harness. Old commands below describe that phase and are no longer runnable. Current verification: `make check` and `/dev/browser-verification.html`; see [browser-only cleanup](browser-only-cleanup.md).

Verified locally on 2026-10-05, macOS arm64, headless Chromium 154.0.0.0,
Pyodide 314.0.7. The production worker asset remains `python.worker-CtNL8MZO.js`.
The temporary optimized entry mounted the actual Playground/hooks/components,
using synthetic auth, Supabase, classification, session and profile responses.
No live account, database or deployment was used.

## Dependency audit

The previous Run handler awaited optional audio, then executed Python. The hook
published its trace without awaiting classification, but the handler could start
progress queries before React committed it. It then awaited progress, classifier
metadata, session saving, profile refresh and reactive mentor serially. A failure
in that chain prevented mentor help; reactive context could read the prior render's
error. Save/mentor/profile completions lacked a shared execution guard.

`/session/save` stores algorithm_type, source, array variable, trace/error, total
steps, solved state, attempts and XP under verified bearer ownership. Its request
also carries task/achievement inputs and mentor count; algorithm_confidence remains
frontend trace metadata. Backend saving updates achievements, cumulative XP,
level and streak. Existing timestamps and database contracts are retained.
Task progress uses RLS-protected owner/task queries, attempt and best-step updates,
first-solve rewards, completion timestamps and next-task unlocking.

The original handler had exactly one profile refresh; `useAchievements` only
creates toast state and introduces no duplicate refresh. No speculative caching
or schema/auth changes were needed.

## Final dependency flow

```text
Run gesture → optional audio starts independently
           → cancel count sampling / await worker recovery when necessary
           → BrowserEngine trace → React commits visualization/error
                                → classification (bounded 10 s; unknown on failure)
                                → independent task progress
                                → reactive mentor immediately for a Python error
classification + progress → background session save → XP/achievement feedback
                                                   → one fresh global profile read
mentor answer → visible immediately → message inserts await matching session ID
```

Runtime readiness, execution, classification, persistence, mentor and complexity
have independent status. Audio readiness is optional and cannot prevent dispatch;
late sounds are checked against the same execution generation. Slow/failed
secondary work preserves trace, error, editor, playback and Run availability.
Analyze Complexity remains explicit and can be interrupted by Run as before.

## Ordering and stale protection

`captureExecution()` reuses `useTracer.runId` and engine identity without adding
fields to Trace Protocol v1. Run/reset/unmount invalidate old classifier, save,
mentor and execution-specific feedback. The page snapshots each Run's source,
array variable, task, token, mentor count and result before background work.

Two local promise tails preserve progress read/modify/write attempts/rewards and
session XP write order for historical Runs on this mount. Failed middle work
cannot let Run C bypass Run A's pending save. These queues are local; they do not
replace database transactions or solve cross-tab/backend concurrency.

Historical saves still complete. Their XP must appear in cumulative global profile
state even if the newest save fails, so each successful save starts one fresh
profile read guarded by the generation current at read dispatch. ProfileProvider
also rejects older overlapping reads and auth/unmount results. Run-specific save
feedback, earned-XP notices and achievement toasts remain guarded by their own Run.

Mentor requests use the exact committed source/error, with abort and generation
checks for replies/loading/errors. Answers do not await storage; conversation
inserts await their matching historical session promise, resolving to null after
save failure. A stale answer cannot attach to a newer session. Request/storage
failures use separate mentor feedback and never mutate the execution result.
All background promises have explicit success/failure handling; optional audio
failure deliberately disables that sound rather than preventing tracing.

## Measurements

Primary metric: Run click event → MutationObserver sees the new committed trace
DOM with a ready runtime. Alternating first values 5/6 ensure the observer cannot
mistake a previous identical trace for the new result. The five-element Bubble
Sort example produces 38 steps in both variants. Python prewarm is excluded.
A pointer click primes audio; ten subsequent programmatic button clicks measure
warm DOM latency in the same browser and optimized bundle. The prior handler's
serial dependency chain, captured in the audit, was reconstructed in the same
entry for a matched comparison. Classifier/session/profile delays were deliberately
200/500/200 ms; their observed timings are not live service latency measurements.

| Metric | Prior orchestration | Final orchestration |
| --- | ---: | ---: |
| Warm Run → trace DOM, mean of 10 | 6.25 ms | 6.06 ms |
| Run → classification complete, synthetic | 211.55 ms | 211.49 ms |
| Run → session save complete, synthetic | 714.64 ms | 716.40 ms |
| Run → profile refresh complete, synthetic | 920.50 ms | 919.68 ms |

Raw prior warm DOM timings: `[4.3, 8.7, 7.1, 6.3, 4.4, 6.7, 6.5, 5.1, 5.6, 7.8]` ms.
Raw final warm DOM timings: `[2.7, 5.8, 6.8, 6.6, 6.7, 8.4, 5.5, 5.8, 5.7, 6.6]` ms.
These overlapping small samples show no material DOM-latency regression, and do
not establish a performance improvement. Initial ready pointer observations were
131.20 ms before and
16.40 ms after; device/runtime warming
also affects these sequential single observations. Tests separately establish
that a pending or failed audio resume cannot delay Python dispatch.

Each variant had 11 main trace dispatches (one prime + ten measured Runs), zero
count dispatches, 11 classification and 11 session requests. Every secondary
request started with trace DOM already present. Normal Run made no `/analyze`
or `/complexity` request. Task Runs may also read/upsert progress, query/unlock
the next task and refresh the owner profile. Mentor/chat requests and conversation
inserts are optional secondary work. Server-side achievement/profile updates remain
inside the existing authenticated save endpoint.

## Browser and regression verification

- All 15 production-worker/browser versus real local server parity fixtures passed
  with exact v1 steps, snapshots, highlights, events, locals, errors and truncation.
- The real product worker's IndexError was highlighted at line 2 before its mentor
  request began, while classifier/save requests were held and Run remained enabled.
  A later valid Run ignored the old mentor answer and classifier metadata.
- Browser checks reported no page errors or unhandled rejections. Screenshots showed
  the real editor, bars, trace readouts and playback controls.
- Component/hook tests cover trace commit before queries, slow classifier/save/
  profile/audio, persistence/classifier/mentor/message-storage failures, stale
  completion and pending profile reads, current/historical XP, achievements,
  ordered task attempts/rewards, next-task ownership/unlock, save payload snapshots,
  matching mentor session IDs, failed middle jobs, and independent controls.
- Existing complexity interruption/cache/cancellation/recovery, initialization-only
  fallback, worker lifecycle and exact tracer/count contract tests remain green.

## Validation

Final validation uses Node 24, `PYTHON_DOTENV_DISABLED=1`, and an npm wrapper that
passes `-- --mode test` only to the Vite production build. This still creates
optimized production assets while avoiding actual local `.env` values.

```bash
npx --yes --package=node@24 -c 'PATH=/tmp/algorythm-phase6-validation:$PATH PYTHON_DOTENV_DISABLED=1 make check'
make context
make context-strict
git diff --check
```

Final `make check` passed: 113 frontend tests, 55 backend tests, six context tests;
Ruff, ESLint (zero errors; nine existing dependency warnings), Python compilation
and the optimized build. The temporary entry, local servers and browser session
are removed after verification. `/analyze`, `/complexity`, ServerEngine and backend
process sandbox/legacy complexity fitting remain for Prompt 7.
