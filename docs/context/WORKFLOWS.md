# Workflows

## First setup

Requirements are Python 3.14.7, Node.js 24 LTS, npm, and Make.

```bash
make setup
```

This creates `.venv`, installs backend production and development dependencies, and runs `npm ci` in `frontend/`. Copy `.env.example` files manually when local integrations are needed; setup never creates or reads secret files.

## Local development

Run services in separate terminals:

```bash
make dev-backend
make dev-frontend
```

FastAPI runs from `backend/` on port 8000. Vite uses its standard local port. The frontend needs `VITE_API_URL=http://localhost:8000` and Supabase public configuration for authenticated product flows.

## Validation

```bash
make lint       # Ruff and ESLint
make test       # backend, browser runtime, frontend, and context tests
make build      # Python compilation and Vite production build
make check      # complete local CI-equivalent validation
```

Tests mock Supabase and Gemini. No check may require live credentials.

## Browser verification

Start `make dev-frontend`, then open
`http://localhost:5173/dev/browser-verification.html` and click Verify browser.
The development-only helper compares 15 frozen Trace Protocol v1 fixtures with
real Pyodide worker results, including timeout and recovery. No backend or cloud
credentials are required. `tests/fixtures/browser_traces.json` preserves the
migration baseline; the helper is excluded from the production build.

Normal Run executes solely in the browser. Initialization/recovery failure shows
Retry and disables Run until ready. Classification failure leaves the trace playable.
Slow/failed session, progress, profile and mentor requests must leave Run, playback and editor usable;
verify this with delayed responses and consecutive Runs. Classification and
persistence start after trace commit. Measure Run → committed visualization DOM
separately from classification, saving and profile completion; worker arrival
alone is not the perceived-latency metric. Complexity is explicit:
click Analyze Complexity to sample in-browser, repeat to check cache reuse, and
confirm no `/complexity` request or automatic count dispatch after Run. See [Browser Python runtime](PYTHON_RUNTIME.md)
for lifecycle, comparison fields, and the timeout rejection adapter.

## Context maintenance

Run `make context` after changing structure, routes, request models, frontend exports/routes, migrations, environment names, or commands.

- `make context-check` prints drift and exits successfully.
- `make context-strict` exits non-zero on drift.
- Curated documents are reviewed manually when behavior or design changes.

The generator reads the Git index plus non-ignored working-tree files. It does not read ignored `.env` files, dependency directories, build output, caches, or binary models.

## Changing an HTTP contract

1. Update the backend Pydantic model/route.
2. Update every frontend caller and error/state normalization.
3. Add backend and frontend regression tests.
4. Update `CONTRACTS.md` and run `make context`.
5. Run `make check`.

## Changing Supabase

1. Read `supabase/AGENTS.md` and the ownership table in `CONTRACTS.md`.
2. Add a new timestamped migration; never rewrite an applied migration.
3. Include grants, RLS enablement, policies, and verification for new user-owned data.
4. Update affected code/tests and document any ownership change.
5. Validate against a disposable Supabase environment before production application. Repository CI does not connect to the live project.

## Deployment

Provider-specific steps remain in `DEPLOY.md`. Before deployment, run `make check`, apply required migrations in order, verify deployment secrets, and smoke-test health, authentication, browser tracing/classify, runtime Retry, mentor fallback, and session saving.
