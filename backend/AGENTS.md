# Backend guidance

Applies to work under `backend/` in addition to the root guide.

- The service starts with `backend/` as its working directory because imports are intentionally flat.
- Read `docs/context/CONTRACTS.md` before changing Pydantic models, routes, response shapes, or environment variables.
- The backend must never execute user Python source or import browser tracing/execution modules. Classification reads AST features only; session persistence stores submitted trace data. Demo seeding uses saved example traces.
- Privileged persistence requires a verified Supabase bearer token. Never trust a user id supplied in a request body.
- External Gemini and Supabase calls must be mocked in tests. CI must not require credentials or network services.
- Keep production dependencies in `requirements.txt` and development-only tools in `requirements-dev.txt`.
- Validate backend changes with `ruff check .` and `pytest`, or run `make check` at the repository root.
