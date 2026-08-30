# Architecture

## System purpose

AlgoRythm is an algorithm-learning platform. A learner submits Python code, receives an execution trace and visualization, asks a Socratic AI mentor for help, and persists learning progress and gamification state.

## Runtime topology

```text
Browser (React/Vite on Vercel)
  |-- public and compute requests --> FastAPI on Render
  |                                    |-- child process --> user-code tracer
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

The frontend talks to both FastAPI and Supabase. This is intentional: compute, mentor, demo login, and privileged session persistence go through FastAPI; user-owned state protected by RLS is accessed through the Supabase anon client.

## Backend

`backend/main.py` defines the FastAPI application, request models, rate limits, authentication verification, complexity fitting, achievement evaluation, and persistence orchestration.

Analysis flow:

1. `/analyze` accepts source code and the array variable name.
2. `sandbox.execute_code` starts a separate `multiprocessing.Process`.
3. The child applies Linux address-space limits, compiles the code, installs `sys.settrace`, and executes with a small safe-builtin set.
4. The parent terminates the child after the timeout and returns a structured result.
5. The classifier extracts AST features and adds algorithm type/confidence.

The tracer records only `<user_code>` frames, snapshots selected state, infers visualization events, and enforces a step cap. Complexity analysis runs the tracer over generated input sizes and fits candidate growth profiles.

The mentor builds context in `backend/mentor.py`, calls Gemini when configured, and returns deterministic fallback guidance when the provider fails.

## Data flow and ownership

- Supabase Auth owns user identity and browser sessions.
- Browser writes to `profiles`, `task_progress`, `mentor_messages`, `pet_profiles`, and `quiz_attempts` are constrained by RLS.
- Browser reads user-owned `sessions` and `user_achievements`; those rows are written by the backend service role.
- `/session/save` derives the user id from a verified bearer token, inserts the session, evaluates achievements, and updates XP/level/streak.
- `tasks` and `achievements` are authenticated read-only catalogs.

The repository contains policies and incremental migrations, but not a complete reproducible baseline for every core table. Treat live schema shape as external state until that gap is closed.
