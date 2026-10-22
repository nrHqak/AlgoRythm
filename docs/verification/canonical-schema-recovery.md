# Canonical application schema recovery — 2026-10-22

## Assessment

**A complete logical representation of the nine existing application tables has
been recovered from authorized production metadata and validated locally. It is
a source-verified, noncanonical candidate pending owner/release review, not
authorization to initialize staging.** No remote database was modified. No
migration, Auth creation, application insert, reset, merge or deployment command
was executed remotely. No application data or credentials were exported.

Base: `audit/staging-discovery`, `fdaef717700de26f2c7e76309b73f4eee8af4a99`.
Work branch: `database/canonical-schema-recovery`.
Earlier reports are historical: [staging discovery](staging-discovery.md),
[schema preflight](supabase-schema-preflight.md),
[reward integrity](reward-integrity.md). Contracts remain unchanged.

## Evidence, authorization and provenance

Production was not queried under the initial prompt alone. After being asked,
the user separately answered **“Confirm ref and authorize metadata inspection”**
for AlgoRythm / `hfwrglctkzagstzretjy`. The exact-project integration lookup
confirmed AlgoRythm, ACTIVE_HEALTHY, ap-northeast-1, reported 17.6.1.155; the SQL
catalogue reported PostgreSQL 17.6. All production queries pinned that ref.

Bounded catalogue queries used BEGIN READ ONLY, local 5-second statement and
1-second lock timeouts, and ROLLBACK. No application function was invoked.
Counts bounded every inventory below 200 items. Two initial metadata projections
had reserved-word syntax errors; corrected read-only queries and a final single
catalogue statement captured the application columns/constraints/indexes/policies/
grants consistently. No definitions were fabricated to compensate for an error.

Definitions were screened before returning them: defaults used a known-expression
allowlist; constraint/policy/index expressions withheld unexpected string literals.
The one initially withheld integer default, achievements.xp_reward, was resolved
with a bounded numeric-only projection of that identified schema field: **50**.
No definitions remain withheld in the application candidate. No routine bodies,
comments, user metadata, passwords, tokens, source, traces, sessions or receipts
were retrieved. Migration history returned versions/names only, not SQL bodies.

The Prompt 11 read-only authorization was reused for one exact-target staging
configuration comparison on `aexhskdofnpqqraapigk`; it still has zero public
tables, PostgreSQL 17.11 and enabled ensure_rls. That query was metadata-only.
Production and staging were never used for local fixture data.

### Repository and history evidence

Fetched origin refs and searched all reachable branch history for SQL paths and
CREATE TABLE definitions in documentation. The initial history begins at
fe14112. Only the following SQL sources exist in the fetched/reachable history;
no omitted/deleted complete core baseline was found. This does not attest to
unreachable commits or an external schema source outside this repository.

| Evidence | Introduction | Authority and use |
| --- | --- | --- |
| supabase/pet_quiz_schema.sql | 60a8d58 | Actual repository pet/quiz DDL; agrees with recovered source shape; partial only |
| 20260808183440_add_task_pattern.sql | 0729459 | Committed incremental DDL; actual source records it and contains its column |
| 20260808213028_secure_public_tables_with_rls.sql | 0729459 | Committed RLS/grant increment; source policy set matches; represented already |
| 20261022113757_reward_integrity.sql | 8cc322b | Pending forward change, never edited or remotely applied here |
| tests/database/core_fixture.sql | 8cc322b | Synthetic assumptions only; explicitly excluded as a recovery authority |
| Backend/frontend database calls | Current base | Establish consumed fields and contracts; do not establish hidden defaults/FKs/nullability |
| Authorized production catalogue snapshot | This recovery | Authority for the recovered current application schema, including fields absent from code/tests |

This is the current source snapshot **after** two increments, not a claim to have
recreated an undocumented pristine MVP schema before those increments.

## Recovered artifacts

See [snapshot/provenance](../../supabase/recovery/application-schema.snapshot.json),
[candidate DDL](../../supabase/recovery/application-schema.candidate.sql),
[offline renderer](../../scripts/schema_recovery.py) and
[local integration tests](../../tests/database/test_recovered_schema.py).
The candidate is outside supabase/migrations and requires explicit local-review
opt-in. It is not discovered/applied automatically by the migration workflow.

| Artifact | SHA-256 |
| --- | --- |
| Candidate SQL | e1c73eac2942be1d25d56f19afa4f1a1cb82c13b9304e55269dc5156e3abc668 |
| Screened metadata JSON | 90b78c5e233db3136853d4dd2fb72d9741432c3be03bc88241a3547812307d3f |

Deterministic regeneration is offline: `python scripts/schema_recovery.py --check`
or, after reviewing changed evidence, `--write`. The renderer refuses unsupported
objects, column properties, withheld defaults and unreviewed expressions instead
of silently omitting them. PK/unique constraints are installed before FKs.
No CREATE ROLE, managed schema DDL, migration-history INSERT or user data is emitted.

### Application objects and complete field map

All nine tables are ordinary persistent heap tables owned by postgres, RLS
enabled, FORCE RLS false, default replica identity, no custom table options.
The candidate preserves **73 columns, 24 constraints, 15 indexes, 19 policies,
27 table-grant groups and zero explicit column ACLs**. Exact types, defaults,
nullability, expressions and names are in the metadata/DDL rather than inferred
from JavaScript or Python values.

| Table | Recovered columns | Relevant consumers |
| --- | --- | --- |
| profiles | id, username, xp, level, streak, last_active_date, created_at | useAuth/useProfile, backend settlement mirror, legacy seed |
| tasks | id, title, description, difficulty, order_index, starter_code, solution_hint, expected_algorithm, max_xp, pattern | /curriculum, TaskCard, Learn/Playground, seed_tasks/backfill |
| sessions | id, user_id, code, array_var, trace, error, total_steps, algorithm_type, solved, attempts, xp_earned, created_at | settlement insert, Profile/Mentor history, useDNA, legacy seed |
| task_progress | id, user_id, task_id, status, attempts, best_steps, xp_earned, completed_at | preserved legacy history/admin seed; no current browser write |
| achievements | id, slug, title, description, icon, xp_reward, condition_type | Profile catalogue and legacy seed; not current reward authority |
| user_achievements | id, user_id, achievement_id, earned_at | Profile grants/history; pending migration adds verified |
| mentor_messages | id, user_id, session_id, role, message, trigger_type, created_at | Playground/Mentor conversation persistence |
| pet_profiles | user_id, pet_name, hunger, mood, energy, evolution_points, last_fed_at, created_at, updated_at | usePet cosmetic state/quiz callbacks |
| quiz_attempts | id, user_id, quiz_day, question_key, prompt, correct, xp_earned, response_ms, created_at | useDailyQuiz insert/read/order/duplicate reload |

Important recovered facts that the toy fixture could not establish:

- profiles.id is UUID PK with an FK to **managed auth.users(id)**; it has no
  generated default. username is required and unique. id/username-only creation
  is supported after an Auth identity exists. xp/level/streak are nullable integer
  mirrors with defaults 0/1/0; last_active_date has no default. created_at defaults
  now(). There are no extra required profile fields or signup triggers.
- Seven other id-based tables have UUID PKs generated by gen_random_uuid();
  pet_profiles uses user_id as its UUID PK. All referenced identity columns are
  UUIDs. Session code is required; trace/error are JSONB, solved boolean; array_var
  defaults arr, attempts 1, xp_earned 0, created_at now(). No hidden mandatory
  session field blocks the existing settlement payload.
- achievements requires **icon and condition_type**, as well as slug/title/
  description; its default xp_reward is **50**. Core fixture rows must not be
  mistaken for valid catalogue inserts into this full schema.
- task_progress and user_achievements have generated id PKs, absent from the
  toy fixture. Unique keys exist for owner/task and owner/achievement. The latter
  uses ordinary NULLS DISTINCT semantics; both owner/achievement FKs are nullable.
- There are nine PKs, five unique constraints and ten FKs, all validated,
  nondeferrable; all FKs use default NO ACTION/MATCH SIMPLE. Preserve these facts;
  do not invent CASCADE, NOT NULL, ranges, enum checks or automatic updated_at
  triggers. Many legacy owner fields are nullable; policies still require uid
  equality. No application CHECK/enum/domain definitions were found.
- Quiz day/key uniqueness, required created_at/default now(), pet defaults and
  the standalone owner/day descending index match the manual pet/quiz SQL.
  Mentor session_id is nullable. Its policies require a null or owned session.

There are **zero application routines/RPCs, ordinary noninternal triggers on
public/auth, views, sequences, rewrite rules or enum/domain objects** to restore.
In particular settlement and reward_private/reward_accounts/practice_progress,
session reward metadata and achievement verified are absent before reward
integrity. Absence was inspected, not filled with invented trigger/function DDL.

### Policy/grant inventory and security

All policies are permissive and bound to authenticated. Catalogue tables tasks/
achievements have SELECT true. sessions/user_achievements have owner SELECT only.
profiles, task_progress, quiz_attempts and pet_profiles each have owner SELECT/
INSERT/UPDATE; Mentor has those three operations plus session ownership checks.
These are the **19 known repository policies**, with no additional custom
restrictions observed. No application policy must be assumed disposable merely
because a future database differs from this snapshot.

Authenticated grants are SELECT on the four catalogue/history tables above,
and SELECT/INSERT/UPDATE on the other five. postgres/service_role have native
ALL table privileges, including PG17 MAINTAIN. There are no anon/PUBLIC table
grants, custom grantees or column ACLs. The API roles have no outbound membership
edges; authenticated/anon do not bypass RLS and service_role does.

**The recovered legacy grant model permits owner profile/quiz reward-column
writes at the SQL privilege layer. This is a recovery fact, not a security fix or
a live API exploitation test. Never activate this historical baseline alone.**
Pending reward integrity removes browser reward-column writes and uses the
service-only transactional authority. The candidate faithfully records legacy
ACLs for review; it does not change any live grants or weaken the pending fix.

The pending policy loop removes eleven existing policies on profiles,
task_progress, sessions, user_achievements and quiz_attempts, replacing them with
the narrowed operations. Retained catalogue/pet/Mentor behavior and intentional
removed quiz/progression/reward edits are covered by local tests. No inherited
browser grant or application trigger/view/RPC bypass was found in this source
snapshot. Repeat review if source/target metadata changes.

The existing validated owner/achievement unique key already prevents duplicate
non-null pairs, establishing the new ordinary unique index's structural
precondition without reading user rows. The new differently named index is
redundant with it; leave the immutable migration unchanged and review index cost
for production separately. Null-key historical rows remain uninspected and are
not silently cleaned up or reclassified as verified rewards.

## Managed dependencies and PostgreSQL 17/staging comparison

The artifact references auth.users(id) and auth.uid(), and depends on platform
roles/schema usage/core UUID generation. Production metadata confirms UUID types,
auth.uid() execution for authenticated/service_role, and postgres CREATE on
public, USAGE on auth and REFERENCES on auth.users. Staging also confirms the
REFERENCES capability. These are prerequisites, not managed DDL to replay.

Managed Auth, Storage, Realtime, Vault, GraphQL, roles/membership/default ACLs,
extensions, event handlers and migration-ledger internals are **not restored**.
The JSON records relevant platform observations separately. Eight production
event triggers point to managed graphql/extensions routines; their bodies were
not retrieved. There is no production public auto-RLS handler to copy.

| Setting | Production source | Staging target |
| --- | --- | --- |
| PostgreSQL | 17.6 | 17.11 |
| Encoding/provider | UTF8 / ICU | UTF8 / ICU |
| Collation/ctype | en_US.UTF-8 / en_US.UTF-8 | Same |
| Collation version | 153.121 | 153.121 |
| Public application tables | Nine | Zero, reconfirmed read-only |
| Default public ACLs | Broad postgres/supabase_admin-created object grants | Same broad pattern |
| ensure_rls event trigger | Absent | Enabled, as identified in Prompt 11 |

No table/type/default syntax translation is needed between these PG17 versions.
PG17's [MAINTAIN privilege](https://www.postgresql.org/docs/17/ddl-priv.html) is
preserved via native ALL grants. Do not silently
remove that source privilege to make a PG16 test pass. The local PG17 run compares
the complete ACL; PG16 native-privilege tests explicitly omit only MAINTAIN.

The platform's [Data API grant changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
do not override the actual broad defaults found here. An approved initializer
must prevent an unsecured interval while creating tables and moving from legacy
to final grants/RLS. Do not rely solely on ensure_rls: its actual body/DDL side
effects and PostgREST cache/API behavior require later approved staging tests.
Do not copy production's platform event handlers over staging's configuration.

## Migration reconciliation and exact future dependency plan

Production's CLI metadata records **20260808183440/add_task_pattern** and
**20260808213028/secure_public_tables_with_rls**, and the captured application
shape represents both. Stored migration SQL/checksums were not read, so version
names alone do not attest to execution of a particular Git blob. A local
equivalence test confirms rerunning the committed two files against the candidate
changes none of the recovered columns, constraints, indexes, policies or grants.
That is a disposable local coverage test, not the proposed deployment sequence.

For this recovered snapshot, the future reviewed sequence is:

1. Approve the exact recovered snapshot/DDL hashes, legacy grant quarantine,
   target platform prerequisites and metadata drift check. It already contains
   pet/quiz DDL, tasks.pattern and the old RLS policies; do not rerun their files.
2. Under separately approved write scope, initialize an empty isolated staging
   application schema from the reviewed snapshot, retaining platform objects.
   A reviewed bootstrap/history-reconciliation procedure must record the two
   represented versions without copying production history/data or rerunning
   represented changes. That procedure is not implemented/executed by this phase.
3. Apply only pending **20261022113757_reward_integrity.sql**, whose SHA-256 is
   f0705538d81ea953ba34270d9b4bb0b8c551fcd914814970412c4b475c84a27d.
   Local tests prove candidate → reward works with the actual recovered FKs,
   defaults, uniqueness and permissions. Recheck collision/privilege metadata
   immediately before any approved execution.
4. Confirm final grants/RLS/private schema/RPC exposure, then introduce only
   approved synthetic Auth/data and perform the hosted acceptance matrix.

Do not append a current-timestamp baseline to the existing CLI chain and blindly
db-push an empty project: pending reward DDL would precede its prerequisites.
Do not fake a pre-increment baseline by deleting fields/policies from the source
snapshot. Do not edit committed migrations or mark pending reward applied without
executing it in its approved sequence. Existing production needs no baseline
replay. Production rollout remains a separate authorization/recovery project.

## Local validation and remaining unknowns

The new test databases are empty databases in the existing private UNIX-socket
harness, not clones of core_fixture.sql. Only minimal synthetic platform shims
are created locally: auth.users(id), auth.uid(), API roles and required grants.
They test FK/ownership mechanics, not managed Auth/JWT/session infrastructure.
No external DSN is accepted, PG connection environment is stripped, no TCP
listener is opened and owned test databases/clusters are removed after tests.

Ten new test cases cover exact metadata roundtrip, deterministic rendering and
refusal of withheld/unhandled evidence; opt-in guard; represented-increment
equivalence; Auth FK rejection/safe profile defaults; catalogue/session/quiz/pet/
Mentor and cross-owner contracts; direct reward/RPC/private-schema denials;
late-failure rollback; 16 concurrent unique and 12 identical operations with one
daily award/session replay and no lost attempts. Existing daily cap/UTC/streak/
overflow tests remain in the separate reward suite.

`make check` passes on local **PostgreSQL 17.11**: **133 Python tests**,
including 49 database-module cases (46 real PostgreSQL cases and three offline
renderer rejection cases), **116 frontend tests**, six context tests, Ruff/ESLint,
Python compilation and optimized Vite build. The ten new recovery cases also
pass separately on PostgreSQL 16.15, with its explicit native-privilege limitation.
`make context-check`, `make context-strict`, `git diff --check` and
`python scripts/schema_recovery.py --check` pass. The repository map was regenerated
with `make context`, never hand-edited. CI retains PostgreSQL 16; its result does
not replace the local PG17 MAINTAIN comparison.

Node 24.19.0 and Python 3.14.3 were used. Dotenv/cloud integrations were disabled;
the optimized build used Vite's secret-free test envDir through an external npm
wrapper (`--mode test`). Existing hook/dependency/classifier/bundler warnings
remain. No application dependency versions or runtime architecture changed.

Reproduce the new tests with local binaries, without cloud credentials:

```bash
REWARD_DATABASE_REQUIRED=1 REWARD_POSTGRES_BIN=/path/to/postgresql17/bin PYTHON_DOTENV_DISABLED=1 .venv/bin/python -m pytest tests/database/test_recovered_schema.py
python scripts/schema_recovery.py --check
```

PostgreSQL 17.11 was built in a temporary directory from the official
[source archive](https://ftp.postgresql.org/pub/source/v17.11/)
with its published SHA-256 verified. No system PostgreSQL service was
changed. Local initialization used UTF8/C with ICU disabled; it does **not** test
ICU Unicode uniqueness/ordering, despite the verified source/staging locale match.
Managed provider hooks, Auth confirmation/login, real JWT role switching, HTTP
RPC discovery/cache, actual UI/backend hosted responses and DDL-event behavior
remain NOT VERIFIED. Production rows/null-owner history/reward legitimacy were
not read; this is a logical schema recovery, not a physical backup or data audit.

## Requirements before staging initialization

The missing-core-DDL gap is closed as a reviewable, source-backed candidate. It
is **not yet a release-approved canonical initializer**. Required next steps:

1. Owner reviews the candidate/evidence hashes, current nullable/default/FK
   semantics, legacy ACL preservation and the no-duplicate migration manifest.
2. Review a fail-closed staging bootstrap/history procedure that accounts for
   broad default grants, ensure_rls and the transaction boundaries in existing
   migration files. It must not expose the legacy permission model to clients.
3. Separately authorize that exact initialization procedure and reward migration
   for **AlgoRythm-staging / aexhskdofnpqqraapigk**, plus precisely scoped synthetic
   Auth/data, failure fixtures, tests and cleanup. Current authorization is
   read-only; reset/deployment/production writes are excluded.
4. Complete Prompt 11's hosted acceptance, including ICU/Unicode edge cases,
   after approved initialization. Do not treat this local result as acceptance.

No staging initialization or next phase begins automatically.
