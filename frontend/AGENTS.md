# Frontend guidance

Applies to work under `frontend/` in addition to the root guide.

- Read `docs/context/CONTRACTS.md` before changing API calls or Supabase queries.
- Keep authentication state in `useAuth`; protected pages must remain behind `ProtectedRoute`.
- Preserve the ownership split: browser code may use the anon client only for user-owned/RLS-protected data. Service-role credentials are backend-only.
- Reuse `getApiUrl`-style base URL handling and send the Supabase bearer token to authenticated backend endpoints.
- `src/runtime/tracer.py` is the single canonical tracer. User execution and complexity counts run only in the Pyodide worker; preserve deadlines, safe builtins, step caps, and Trace Protocol v1. Runtime failure offers Retry, with no backend execution path.
- Keep UI copy in the locale dictionary when the surrounding feature is localized.
- Add or update Vitest/Testing Library coverage for route, hook, and interaction changes.
- Validate frontend changes with `npm run lint`, `npm run test`, and `npm run build` from this directory, or run `make check` at the repository root.
