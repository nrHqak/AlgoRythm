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
late sounds use the same execution generation. Session saving starts after trace
commit and waits for classification in background work. A stable operation UUID
and the verified bearer principal reach one transactional database RPC. The
service defines bounded activity rewards independently of every browser success
claim. The response supplies actual awarded XP; the frontend never calculates
confirmed bonuses. Profile refresh reads `reward_accounts`, rather than trusting
legacy profile balances. Cross-tab correctness comes from database locks and
uniqueness, with generation guards still protecting current UI feedback.
Task progress is provisional practice, recorded in the same transaction; all
practice tasks are available without completion-based unlocks. Quiz answers and
pet state are user-owned practice/cosmetics and cannot authorize XP or verified
achievements. No trusted solution verifier exists, so solution-dependent rewards
are unavailable. Reactive Mentor still starts directly from committed errors;
storage waits for the matching session or null. Execution, classification,
persistence, Mentor and explicit complexity retain independent status. Normal
Run performs one browser execution and no automatic complexity sampling.
The worker emits Trace Protocol v1, using the single canonical
`frontend/src/runtime/tracer.py` AlgorithmTracer source. A reusable manager
owns lifecycle and hard timeout recovery; navigation away terminates the worker. See [Browser Python runtime](PYTHON_RUNTIME.md)
for the message contract and current limitations.

## Backend

`backend/main.py` defines the FastAPI application, request models, rate limits, authentication verification and a single transactional persistence RPC.

**The backend does not execute user Python code.** `/classify` receives source,
extracts AST features, and uses the existing model for algorithm type/confidence.
Mentor requests receive source as context. `/session/save` receives source and
browser-generated trace data for privileged authenticated persistence; it does
not regenerate the trace. Demo seeding reads saved example traces. Execution,
tracing, and complexity counting/fitting belong to the browser system.

The mentor builds context in `backend/mentor.py`, calls Gemini when configured, and returns deterministic fallback guidance when the provider fails.

## Data flow and ownership

- Supabase Auth owns user identity and browser sessions.
- Browser profile creation/editing is limited to safe identity/username fields.
- `reward_accounts` is authoritative for XP/level/streak; browsers can only read their own rows.
- `/session/save` verifies identity, then invokes one service-only database transaction for history, bounded activity rewards, provisional practice and idempotency.
- Browser claims cannot authorize verified solutions, achievements or reward bonuses.
- Browser-owned quiz/pet/Mentor state remains constrained by ownership RLS; quiz correctness and pet evolution do not grant authoritative XP.
- `tasks` and `achievements` remain read-only catalogs. Legacy reward/task/session/achievement data is explicitly unverified.

The repository contains policies and incremental migrations, but not a complete reproducible baseline for every core table. Treat live schema shape as external state until that gap is closed.
