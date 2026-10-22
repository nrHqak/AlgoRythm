# Recovered application schema candidate

**Source-verified, not release-approved. Never initialize a remote database from
this directory without separate review and explicit authorization.** These files
are outside the CLI migration directory and are not automatically applied.

- `application-schema.snapshot.json`: screened application-only metadata from
  the separately authorized AlgoRythm production project, captured 2026-10-22.
  Platform dependencies are observations, never instructions to recreate them.
- `application-schema.candidate.sql`: deterministic representation of nine source
  application tables and their actual constraints, indexes, policies and grants.
  Contains no user data. It deliberately preserves the legacy permission model
  for review and must not be activated alone.
- [Recovery report](../../docs/verification/canonical-schema-recovery.md):
  provenance, represented migration versions, security/compatibility limits and
  the approval gates before future staging initialization.

The snapshot already represents `20260808183440` and `20260808213028`, including
task pattern and the old RLS policies. The reward-integrity migration is pending.
Do not replay represented migrations or copy production migration-history rows.
The future approved bootstrap/history-reconciliation procedure must account for
those versions before applying reward integrity.

Offline generation/checking contacts no database:

```bash
python scripts/schema_recovery.py --check
python scripts/schema_recovery.py --write
```

The renderer fails on withheld or unsupported metadata instead of inventing DDL.
Review changes to the snapshot before regenerating. SQL requires an explicit
`algorythm.schema_recovery=local-review` session setting as an accidental-use
guard; this is not a security boundary or remote-write authorization.

`tests/database/test_recovered_schema.py` builds a private local database with
explicit minimal Auth/role shims, restores this candidate and tests the pending
reward migration. It does not restore managed Supabase Auth/Storage/Realtime/Vault
objects or create real Auth accounts. Set REWARD_DATABASE_REQUIRED=1 and select
local PostgreSQL 17 binaries with REWARD_POSTGRES_BIN for the complete native
privilege comparison, including MAINTAIN. PostgreSQL 16 checks omit that
17-specific privilege and cannot establish Supabase-managed behavior.
