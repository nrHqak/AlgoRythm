# Fail-closed staging bootstrap preparation — 2026-11-03

## Status and authorization

Target for a **future** initialization: **AlgoRythm-staging /
aexhskdofnpqqraapigk**, ap-northeast-1. The last verified project/database metadata
is from 2026-10-22, not a fresh observation on this report date. No Supabase
project SQL, metadata refresh, writes, Auth operations or deployment commands
were performed in Prompt 13. Production is outside this procedure.

**The local design is implemented and verified. Hosted initialization is
BLOCKED, not authorized or accepted.** The staging `ensure_rls` handler body,
managed DDL side effects and current platform/default-grant state have not been
verified. This is an explicit hosted blocker, not an assumed exposure window.
The shipped generator and its SQL have no hosted execution mode. Removing its
local-only guard requires a future reviewed change, fresh metadata review and
explicit staging-write authorization. Do not remove a failed check to proceed.

Read with [schema recovery](canonical-schema-recovery.md),
[staging discovery](staging-discovery.md), [reward integrity](reward-integrity.md)
and [contracts](../context/CONTRACTS.md). The recovered candidate remains
source-verified and release-unapproved; this preparation does not approve it.

## Verified artifacts and transaction boundaries

All original artifacts are unchanged. The offline composer verifies these exact
SHA-256 hashes before producing any SQL:

| Artifact | SHA-256 |
| --- | --- |
| `supabase/recovery/application-schema.candidate.sql` | `e1c73eac2942be1d25d56f19afa4f1a1cb82c13b9304e55269dc5156e3abc668` |
| `supabase/recovery/application-schema.snapshot.json` | `90b78c5e233db3136853d4dd2fb72d9741432c3be03bc88241a3547812307d3f` |
| `20260808183440_add_task_pattern.sql` | `8e63c0f2cebcd8193fb08fbed04de42d7b3d7e2fd24920deb7088d2a6302ba42` |
| `20260808213028_secure_public_tables_with_rls.sql` | `0110251c69bd53c9f73a747c59180dcfb020acb506db379b5e45ecad813f439f` |
| `20261022113757_reward_integrity.sql` | `f0705538d81ea953ba34270d9b4bb0b8c551fcd914814970412c4b475c84a27d` |
| `supabase/bootstrap/final-schema.expected.json` | `934b29a236b72c2f0caa71fa78f55b676560f5a6806bec5b61d66d567780295d` |

The candidate starts its transaction at line 13 and commits at line 314. The
reward migration starts at line 3 and commits at line 193. PostgreSQL does not
provide nested transactions through repeated BEGIN/COMMIT. Simply concatenating
these files inside BEGIN would allow an early COMMIT before final assertions.

The composer checks the pinned bytes and omits only each file's one exact
outer `begin;`/`commit;` line. It preserves their SQL bodies, dollar-quoted
PL/pgSQL blocks, role setting, grants and recovery opt-in. The immutable files
are never edited or replaced. Only these two pinned files enter this composition;
the represented earlier migrations are never executed. Each derived phase has
one real outer transaction, with all assertions before its COMMIT. An altered
artifact/boundary is a hard failure. This is not a generic SQL parser.

Local review commands, safe to execute without any database connection:

```bash
python scripts/schema_recovery.py --check
python scripts/staging_bootstrap.py --check
python scripts/staging_bootstrap.py --emit-local /tmp/algorythm-bootstrap-review
```

The output directory must be new. It contains exactly three SQL files described
below. The composer has no DSN, credential, SQL-execution, CLI-execution or remote
argument. Generated SQL additionally requires a socket-only server with no TCP
listener, session user `audit_admin`, SQL role `postgres`, an owned
`bootstrap_<32 hex digits>` fixture database and the exact intended project-ref
setting. Thus these files cannot initialize hosted staging as shipped.
The ref setting is a routing assertion, not independent identity evidence.

## Initialization sequence and access containment

| Boundary | Transaction contents / supported external action | State after success |
| --- | --- | --- |
| T1: `10-baseline-quarantined.sql` | Validate identity, PG17, empty application namespace, Auth/role/grant prerequisites and empty CLI history. Revoke public-schema access from PUBLIC and all four API roles. Create the private bootstrap journal and unchanged baseline body. Compare every captured column/default, FK/constraint, index, policy, table/column grant and RLS owner flag with recovery evidence. Revoke API table privileges before COMMIT. | Nine source application tables, **client access closed**, history empty. |
| H1: CLI history repair | Mark only `20260808183440` and `20260808213028` represented. Verify the exact two-version set and unchanged application metadata. | Baseline remains quarantined; reward remains pending. |
| T2: `20-reward-quarantined.sql` | Recheck containment, principals, pinned journal, platform inventory and exact two-version history. Restore source table grants and assert the source state inside the transaction. Execute only the reward migration body. Normalize service privileges on the three new reward relations, assert the complete final reference, revoke private-schema access for API roles and COMMIT. | Reward schema installed; public/private client access still closed; reward version still pending in CLI history. |
| H2: CLI history repair | Only after T2 committed and its final metadata/journal were independently checked, mark `20261022113757` applied. Verify the exact three-version set. | Accurate completed history; access remains closed. |
| T3: `30-release.sql` | Recheck closed access, principals/platform inventory, phase/artifact journal, all three history versions and final application metadata. Grant only public-schema USAGE to API roles and private-schema USAGE to service_role. Assert service-only RPC/schema access, update journal and COMMIT. | Final restricted grants/RLS visible together; ready for **separately approved** synthetic acceptance. |

The SQL identity is `postgres`, never a browser/service API key. The journal is
`algorythm_bootstrap.state`, owned by postgres, with RLS, no API schema/table
privileges, and a single metadata row recording target, artifact fingerprint,
phase and platform inventory. It contains no user/session data and remains
private after release. The final application reference excludes that control
table. Each SQL phase takes the same transaction advisory lock and uses
2-second lock / 30-second statement timeouts. The operator must serialize the
whole run, including CLI gaps; the advisory lock is not a cross-process lease
over the external history commands and cannot restrain an unrelated DB owner.

T1 revokes both schema access and all source-table privileges before its first
commit. Restoring the historical grants in T2 happens only inside the closed
reward transaction; the reward restrictions replace them before commit.
New PUBLIC/anon/authenticated permissions from default ACLs are explicitly
removed by the candidate/reward SQL. The bootstrap additionally normalizes new
service grants to SELECT/INSERT/UPDATE on reward_accounts/practice_progress and
SELECT/INSERT on the receipt ledger, rather than inheriting native ALL.

No default ACL, platform event trigger, managed Auth object, role membership or
production object is changed. No insecure baseline is intentionally released.
Grant restoration in T3 is conditional on exact security assertions and rolls
back if a later statement fails. This was tested from independent connections.

Schema USAGE alone is not treated as a universal kill switch for arbitrary
pre-existing cached statements or SECURITY DEFINER functions. Initial empty-object
checks, table revocation, role-graph review, and review of managed entry points
are necessary. Hosted handler/cache/hook behavior remains a blocker until reviewed.
Existing SQL/cache clients must not be attached to an unreviewed initializer.

## Supported migration-history reconciliation

Supabase's [migration repair reference](https://supabase.com/docs/reference/cli/supabase-migration-repair)
defines applied repair as a history update, not execution of migration DDL.
The general reference still shows some v2 flags. The current
[v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3)
and actual **CLI 3.0.0** `--help` establish the flags tested here: local by default,
`--remote=<ref|url>` for an explicit target, and consent for hosted mutations.
Do not copy an older `--db-url` example or rely on whichever project is linked.

The following are **future authorized operator steps only**, not commands run
against Supabase in this phase:

```bash
# H1, only after successful quarantined baseline T1:
supabase migration repair 20260808183440 20260808213028 --status applied --remote=aexhskdofnpqqraapigk
supabase migration list --remote=aexhskdofnpqqraapigk

# H2, only after actual reward execution T2 and independent final-schema verification:
supabase migration repair 20261022113757 --status applied --remote=aexhskdofnpqqraapigk
supabase migration list --remote=aexhskdofnpqqraapigk
```

Use a reviewed **3.0.0** CLI binary, a clean isolated work directory containing
only the three unchanged migration files and reviewed config, and no project
environment files. CLI v3 loads automatic project env files and lets shell
variables override config; never run it from a developer checkout with real
.env files or unspecified target settings. Authenticate through the approved
credential mechanism; do not put passwords/tokens into command arguments,
generated SQL, commits or reports. No credentials are needed for local tests.

The baseline snapshot already represents both earlier versions. H1 preserves
their original identifiers without replay, invented dates or copied production
rows. H2 is withheld until the reward transaction has actually succeeded.
The CLI owns history schema/table creation and inserts. Repository SQL only
SELECTs ordered version identifiers; it never INSERTs/UPDATEs/DELETEs managed
history, reads stored statements or reads Auth/realtime migration tables.

Expected history: empty before T1; exactly the two represented versions before
T2; exactly those two plus `20261022113757` before T3. Extra/missing/premature
versions stop the SQL phases. Do not run db push, migration up, migration down,
repair --status reverted, reset, legacy pet/quiz SQL, or a new timestamped baseline
to bypass this sequence. A failed CLI step leaves containment in place.

## Future hosted preflight and operator checklist

**Do not execute this checklist's write steps yet.** There is no approved hosted
SQL bundle in this commit. Before creating one, resolve the blockers below and
review the new bundle/guard changes; do not relabel the local fixture as hosted.

1. Independently reconfirm exact staging ref/name/region/status through Supabase
   metadata and verify the SQL transport targets that same project. Never use
   production, a remembered link, or only a self-declared SQL setting. Record
   reviewed commit and all source/reference/derived SQL hashes; rerun offline
   verification immediately before every phase. Any changed bytes require review.
2. Refresh bounded read-only catalog evidence, with explicit metadata scope,
   timeouts and no user rows/tokens/secrets. Require PostgreSQL17, the reviewed
   UTF8/ICU locale, postgres DB/schema ownership/CREATE, auth.users.id UUID PK,
   auth.uid() UUID, REFERENCES and helper EXECUTE/USAGE privileges. Confirm the
   application namespaces and CLI history are empty, not just a table-count guess.
3. Review current API roles, all inheritance/SET ROLE routes, schema privileges,
   object-creator global/public default ACLs and event bindings. Known broad
   defaults are handled; unknown grantees or exposed entry points are blockers.
   Ensure no public views/routines/objects except the reviewed rls_auto_enable
   handler, no reward_private/bootstrap namespace, and no profile/Auth hooks
   depending on public objects. The local prerequisite implementation deliberately
   rejects unknown objects/capabilities.
4. Safely review the actual ensure_rls handler definition/search_path/owner and
   managed GraphQL/PostgREST DDL handlers, with secret-screened metadata handling.
   Confirm they cannot publish an alternate privileged path or perform an
   irreversible external action during this sequence. Do not disable, replace,
   copy or reconstruct managed handlers to make checks pass.
5. Account for [the platform grant rollout](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically),
   announced for existing projects on **2026-10-30**, after our 2026-10-22 capture.
   Fresh metadata, not rollout dates or the old snapshot, decides actual behavior.
   Supabase's [event-trigger example](https://supabase.com/docs/guides/database/postgres/event-triggers)
   explains the pattern; it does not establish the actual hosted handler body.
6. Review and approve temporary public-schema containment, including effects on
   Auth hooks/managed APIs, exclusive operator access, maintenance communications
   and failure recovery. Do not attach application clients during initialization.
   Review the final hosted SQL identity/transport and a version with a deliberate,
   approved replacement for local-only guards. Retain project/hash/version/history,
   schema, role, grant, phase and rollback assertions.
7. Obtain explicit approval for the exact hosted bundle and T1/H1/T2/H2/T3 writes,
   including the private bootstrap journal and temporary schema containment.
   Execute one boundary at a time, with ON_ERROR_STOP/failure exit and no retry
   loop; independently verify containment and expected metadata/history before
   crossing each boundary. Do not batch the entire protocol across one connection
   and assume CLI history shares a transaction.
8. After T3, independently compare final schema/security/history: 11 public
   tables plus one private receipt table, 97 application columns, all validated
   FKs/defaults, RLS, exact table/column grants, 18 policies, service-only invoker
   RPC with empty search_path, no API private-schema access and no unexpected
   views/triggers/rules/types/functions. Review the private journal separately.
9. Stop. No Auth users, synthetic rows, task catalog seeding, API/application
   deployment or automatic acceptance follows initialization. Request separate
   approval for synthetic Auth/data, hosted browser/backend tests and scoped
   cleanup. Initialization success is not staging acceptance.

The September [PG17.11 compatibility notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
was also reviewed. The captured application DDL uses no ltree, btree_gist,
encrypted payloads or custom operators; no remote reindex or data query is
included or implied by this preparation.

## Failure handling and recovery

| Failure | Safe outcome / next action |
| --- | --- |
| Wrong ref/SQL role/PG major/transport, changed hash, missing Auth/helper privilege, occupied namespace, unknown grant, nonempty initial history | Stop before baseline commit; no initializer application objects or privilege changes persist. Review the cause without reset. |
| T1 fails partway through table creation | Entire T1 rolls back, including journal and containment. Initial application schema remains absent. Local tests inject both a SQL error and SQLSTATE 0A000. |
| H1 fails or history differs | T1 stays closed. Inspect bounded version metadata; do not run reward or revert/delete history. If CLI partially completed, require explicit reconciliation review before continuing. |
| T2 fails after reward tables/grants were created | Entire T2 rolls back to quarantined baseline and the two represented versions. No reward version is recorded. Review/fix the cause; a deliberate retry of T2 is possible only after all gates still pass. |
| H2 fails or phase is unknown after disconnection | Keep containment. Inspect the journal, final schema and version set; never infer a commit from CLI output/timeout alone or mark reward applied without proof. |
| T3 fails before or after schema USAGE grants | Entire T3 rolls back to closed reward state. Test injects a failure after release grants and verifies denials from separate connections. |
| Platform/role/default inventory or final privileges drift | Stop while closed; no corrective blanket grants, disabling RLS, ignored checks or overwriting functions. Review the unexpected difference. |
| Problems after an actually committed release | Freeze application rollout/acceptance. Any re-containment or forward repair is a separately reviewed and authorized action; do not auto-drop tables, delete rows, reset or run an invented down migration. |

Before remote execution, approve the exact containment/recovery operations and
operator responsibility. The current preparation has no automatic reset, cleanup
of remote objects, repair reversal, grant bypass or hidden fallback. Only owned
temporary local databases/clusters are destroyed by the test harness.

## Actual local verification

Official PostgreSQL **17.11** was built under a task-owned temporary directory
after checking the archive's published SHA-256:
`dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979`.
No system database/service was changed. The build uses UTF8/C test databases and
no ICU/readline/zlib; it does not prove hosted ICU/Unicode behavior.

The official CLI **3.0.0** Darwin arm64 archive was checked against its release
checksum:
`3b0bfc4602cd7d55ffc78a6b72443d3b8e5fdd856b777e75977978dceb3e44cc`.
Actual CLI repair/list ran against only the harness's private UNIX socket,
despite v3 naming explicit URL targets --remote. No TCP listener or hosted URL
was used. Clean temporary CLI config/migration directories prevent project .env
discovery; application credential/PG/Supabase environment is stripped. Only
synthetic local identities/records are used.

The 21 new cases comprise two offline source/boundary checks, 18 real PG17
bootstrap/failure cases, and an incompatible-major check run separately on
installed PostgreSQL16.15 (skipped in the PG17 run). They cover all nine recovered
tables, exact source metadata before containment, final 12-table application
metadata/ACL reference, secure profile initialization, browser reward denials,
service-only RPC, session/quiz/pet/Mentor contracts, owner isolation, idempotent
concurrency (16 distinct plus 12 identical requests), daily XP/save caps, initial
prerequisite failures, history mismatch/premature reward marking, platform drift,
late reward rollback and rollback after release grants.

`make check` passed with **153 Python tests, one intentional incompatible-major
skip**, **116 frontend tests**, six context tests, Ruff/ESLint, Python compilation
and optimized Vite build. The separate PG16 selection passed four cases, including
actual wrong-major rejection. Existing nine hook warnings and SDK/classifier/
bundler warnings remain. Frontend/backend application sources, BrowserEngine,
Pyodide, migrations and recovery evidence are unchanged. The only frontend
configuration change disables automatic Vercel Git deployment for this exact
preparation branch, using the documented
[git.deploymentEnabled setting](https://vercel.com/docs/project-configuration/git-configuration).
No Vercel deployment command is part of this task. These local regression tests do not constitute a
new real-browser or hosted acceptance run.

Reproduce with locally installed PG17 binaries and a checksum-reviewed CLI3:

```bash
BOOTSTRAP_PG17_REQUIRED=1 BOOTSTRAP_CLI_REQUIRED=1 \
BOOTSTRAP_SUPABASE_CLI=/path/to/supabase-3.0.0 \
REWARD_DATABASE_REQUIRED=1 REWARD_POSTGRES_BIN=/path/to/postgresql17/bin \
PYTHON_DOTENV_DISABLED=1 .venv/bin/python -m pytest tests/database/test_staging_bootstrap.py
```

Use a secret-free environment for full make check; the local optimized build used
an external npm wrapper adding `--mode test`, preserving Vite's existing test
envDir. Runtime versions were Python3.14.3 / Node24.22.1. No real .env was read.
The existing CI database job remains PG16 and explicitly cannot certify PG17
bootstrap success; it runs source/guard checks and reports the other cases skipped.
Its runner is pinned to Ubuntu24.04, whose official repository supplies PG16.
The initial Ubuntu26.04 run failed before tests because that native package was
absent; no database checks were relaxed to address the runner-image change.

## Remaining hosted blockers and next authorization

Local Auth users(id), auth.uid(), roles and auto-RLS behavior are intentionally
minimal shims, not recreated managed Supabase Auth/JWT/session infrastructure.
Still unresolved: fresh post-rollout grants/platform metadata; real ensure_rls
and managed handler behavior; temporary containment effects on Auth/GraphQL/
PostgREST and existing connections; hosted ICU semantics; actual Auth signup/login,
JWT role switching, HTTP RPC/schema-cache discovery and application acceptance.

First resolve the fresh metadata/handler review and approve a hosted artifact
variant retaining all safety checks. Then obtain separate explicit authorization
for **only AlgoRythm-staging / aexhskdofnpqqraapigk**, the exact commit and SQL hashes,
T1/H1/T2/H2/T3, postgres identity, temporary containment and private journal.
That approval must exclude production, reset, Auth/data creation and deployment.
Synthetic Auth/data and hosted acceptance require their own subsequent approval.
No staging execution starts automatically.
