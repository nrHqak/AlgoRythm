# Local verification of a staging bootstrap

This directory is **not** a CLI migration directory or an authorized hosted
initializer. Existing recovery evidence and migrations remain unchanged.

`final-schema.expected.json` is a **locally derived golden reference**, not
production metadata. It records candidate → reward migration → explicit
service-grant normalization on disposable PostgreSQL 17.11, using minimal Auth
shims and broad future-object grants. It contains schema metadata only: 12
application tables (11 public, one private), 97 columns, 40 constraints, 21
indexes, 18 policies, column/table privileges and the RPC definition digest.
The bootstrap journal is deliberately outside that application inventory.

The offline composer pins this reference and all five original source artifacts
by SHA-256. It compares the baseline with the recovered snapshot and the final
state with this reference inside the respective transactions. Tests reproduce
the final reference from the unchanged inputs; they never regenerate or accept
a changed reference automatically. Reference changes require evidence review
and a corresponding explicit hash review in the composer.

```bash
python scripts/staging_bootstrap.py --check
python scripts/staging_bootstrap.py --emit-local /tmp/algorythm-bootstrap-review
```

The output directory must not already exist. These commands use no network,
connection string, environment file or credentials. Generated SQL additionally
refuses hosted/listening servers, non-owned database names and identities other
than the local audit harness. There is no remote execution switch. The project
ref setting is an intended-target check, not proof of transport identity or
authorization.

See the [staging bootstrap runbook](../../docs/verification/staging-bootstrap.md)
for the transaction sequence, actual CLI tests, unresolved hosted blockers and
separate authorization gates. Never run the recovery candidate by itself, replay
represented increments, reset a project or edit managed history with ad hoc SQL.
