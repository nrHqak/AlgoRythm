# AlgoRythm agent guide

This file is the small, always-on instruction layer. Do not read the entire repository before starting work. Open [AI_CONTEXT.md](AI_CONTEXT.md), then load only the documents and source files named for the task.

## Repository map

- `frontend/`: React 18 + Vite client. Browser auth and low-risk user-owned data access use Supabase directly.
- `backend/`: FastAPI service for AST classification, mentor integration, and privileged persistence; never executes user Python source.
- `supabase/`: append-only migrations and legacy/manual schema SQL.
- `docs/context/`: architecture, contracts, workflows, decisions, known issues, and the generated repository map.

## Read only what the task needs

| Task | Required context |
| --- | --- |
| UI, route, hook, browser runtime, or tracer behavior | `frontend/AGENTS.md`, `docs/context/ARCHITECTURE.md`, relevant frontend files |
| API, classifier, or mentor | `backend/AGENTS.md`, `docs/context/CONTRACTS.md`, relevant backend files |
| Database, RLS, or migration | `supabase/AGENTS.md`, `docs/context/CONTRACTS.md`, relevant migrations |
| Local setup, CI, deploy, or release | `docs/context/WORKFLOWS.md`, `DEPLOY.md` |
| Cross-system design | `docs/context/ARCHITECTURE.md`, `docs/context/DECISIONS.md` |
| Quick symbol or integration lookup | `docs/context/REPOSITORY_MAP.md` |

## Invariants

- Do not change HTTP or database contracts on only one side of an integration.
- Never move the Supabase service-role key into browser code.
- The backend must never execute user Python source. Browser execution belongs to the Pyodide worker; preserve its deadlines, builtin policy, and step caps with regression tests.
- Treat existing Supabase migrations as applied. Add a new migration instead of rewriting history.
- Do not infer the live Supabase schema from partial repository SQL; the missing baseline is documented in `KNOWN_ISSUES.md`.
- Never read, print, commit, or copy real `.env` values. Use only `.env.example` files and environment-variable names.
- Keep generated files deterministic. Update `REPOSITORY_MAP.md` with `make context`, never by hand.

## Commands and completion

- Setup: `make setup`
- Full validation: `make check`
- Refresh generated context: `make context`
- Non-blocking drift check: `make context-check`

Work is done when the narrow relevant tests pass, `make check` passes before handoff, public contract changes are documented, and the diff contains no secrets or unrelated rewrites. Update durable guidance only for stable rules, not one-off task details.

## Code review rules

- Flag unauthenticated privileged writes, service-role exposure, weakened RLS ownership checks, and backend user-code execution or weakened browser execution safeguards as high priority.
- Require regression tests for behavior changes.
- Require context or contract updates when routes, payloads, environment variables, ownership boundaries, or operational commands change.
