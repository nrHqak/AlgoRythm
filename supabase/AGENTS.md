# Supabase guidance

Applies to work under `supabase/` in addition to the root guide.

- Treat timestamped migrations as immutable once committed. Create a new migration for every forward change.
- Every user-owned table must have RLS enabled and policies bound to `auth.uid()`.
- Catalog tables may be readable by authenticated users but must not gain browser write access without an explicit design decision.
- Backend-only tables and writes must remain inaccessible to anon/authenticated roles unless a documented use case requires otherwise.
- Do not claim the SQL directory is a complete schema baseline; see `docs/context/KNOWN_ISSUES.md`.
- Review grants, policies, foreign-key ownership, and rollback/forward-fix behavior for every migration.
