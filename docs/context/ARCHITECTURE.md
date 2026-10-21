# Architecture

## System purpose

AlgoRythm is an algorithm-learning platform. A learner submits Python code, receives an execution trace and visualization, asks a Socratic AI mentor for help, and persists learning progress and gamification state.

## Runtime topology

```text
Browser (React/Vite on Vercel)
  |-- Web Worker / Pyodide --> normal trace + explicit complexity counts
  |-- public/enrichment requests --> FastAPI on Render
  |                                    |-- AST features/model --> classification
  |                                    |-- Gemini API --> mentor response
  |                                    `-- service role --> Supabase
  `-- authenticated anon client -------------------------> Supabase Auth/Postgres
```

The three deployment units are independent:

- Vercel serves the single-page frontend and rewrites routes to `index.html`.
- Render starts FastAPI from `backend/` so flat Python imports resolve.
- Supabase provides Auth, PostgreSQL, row-level security, and REST access.

## Frontend

`frontend/src/main.jsx` mounts `App` under `BrowserRouter`. `App.jsx` composes auth, locale, and profile providers and protects learning, playground, mentor, and profile routes.

State is organized by focused hooks:

- authentication and session lifecycle: `useAuth`;
- profile and level state: `useProfile`;
- trace requests and normalized response state: `useTracer`;
- playback: `usePlayer`;
- persistence-backed pet, quiz, DNA, and achievement features: their corresponding hooks.

The frontend talks to both FastAPI and Supabase. Classification, mentor, demo login, and privileged session persistence go through FastAPI; user-owned state protected by RLS uses the Supabase anon client. Normal tracing and explicit complexity sampling run in the browser worker.

A browser Python runtime is also prewarmed on Playground mount using a module
Web Worker and Pyodide. BrowserEngine is the only execution engine. Runtime initialization failure
leaves Run unavailable and shows Retry, which initializes a fresh worker through
the existing manager. No backend execution fallback exists. A committed browser trace
starts asynchronous `/classify` enrichment, independent of visualization and
playback. Optional audio starts under the Run gesture without awaiting readiness;
late sounds use the same execution generation. Post-run progress and classification
start after the trace commit, independently of execution/playback. Session saving awaits enrichment (bounded to ten seconds,
then unknown) and task progress inside background work. Mount-local promise tails
serialize progress read/modify/write and session XP updates across rapid Runs;
failed jobs release their slots without bypassing an older save. A successful
current save publishes Run-specific XP/achievements. Each successful historical
or current save performs one fresh global profile read, guarded by the execution
generation current when that read starts and the provider's latest-read identity.
There were no duplicate post-run profile reads to remove. Historical saves may finish,
but the same `useTracer` generation guards save feedback, XP, achievements,
mentor replies and profile commits. Reactive mentor requests start directly from
the committed error, independent of saving; conversation inserts await that Run's
session ID (or null on save failure). Runtime, execution, classification,
persistence, mentor and explicit complexity each have independent status.
Normal Run performs one main Python execution and no complexity work. Analyze
Complexity is explicit, reuses the prewarmed worker in count mode, and caches up
to 20 results by code/array variable/sampling parameters. Cancellation, failure,
and recovery leave visible trace/player/editor state intact.
The worker emits Trace Protocol v1, using the single canonical
`frontend/src/runtime/tracer.py` AlgorithmTracer source. A reusable manager
owns lifecycle and hard timeout recovery; navigation away terminates the worker. See [Browser Python runtime](PYTHON_RUNTIME.md)
for the message contract and current limitations.

## Backend

`backend/main.py` defines the FastAPI application, request models, rate limits, authentication verification, achievement evaluation, and persistence orchestration.

**The backend does not execute user Python code.** `/classify` receives source,
extracts AST features, and uses the existing model for algorithm type/confidence.
Mentor requests receive source as context. `/session/save` receives source and
browser-generated trace data for privileged authenticated persistence; it does
not regenerate the trace. Demo seeding reads saved example traces. Execution,
tracing, and complexity counting/fitting belong to the browser system.

The mentor builds context in `backend/mentor.py`, calls Gemini when configured, and returns deterministic fallback guidance when the provider fails.

## Data flow and ownership

- Supabase Auth owns user identity and browser sessions.
- Browser writes to `profiles`, `task_progress`, `mentor_messages`, `pet_profiles`, and `quiz_attempts` are constrained by RLS.
- Browser reads user-owned `sessions` and `user_achievements`; those rows are written by the backend service role.
- `/session/save` derives the user id from a verified bearer token, inserts the session, evaluates achievements, and updates XP/level/streak.
- `tasks` and `achievements` are authenticated read-only catalogs.

The repository contains policies and incremental migrations, but not a complete reproducible baseline for every core table. Treat live schema shape as external state until that gap is closed.
