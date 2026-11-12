# Staging schema discovery — 2026-10-22

## Scope and authorization

Target: **AlgoRythm-staging**, project ref **aexhskdofnpqqraapigk** only.
Base branch: `audit/supabase-staging-preflight` at `6fff7e9`.
Discovery branch: `audit/staging-discovery`.

The user confirmed this is separate from production. The Supabase integration's
project-details lookup for this exact ref independently returned:

| Metadata | Verified value |
| --- | --- |
| Project name | AlgoRythm-staging |
| Project ref | aexhskdofnpqqraapigk |
| Region | ap-northeast-1 |
| Status | ACTIVE_HEALTHY |
| PostgreSQL engine | 17 |
| Reported database version | 17.11.0.003 |
| Project creation time | 2026-10-22T11:44:33.229Z |

Only this project's metadata was requested. No production inventory/details or
production database objects were inspected in this phase. No credentials, tokens,
Auth user rows, session contents or application records were requested.

After identity confirmation the user separately answered **“Authorize read-only
schema inspection”**. Only then were seven bounded metadata-query transactions
executed against this exact project. Each used BEGIN READ ONLY, 5-second statement
and 1-second lock timeouts, and ROLLBACK. The first independently reported
transaction_read_only=on and server_version=17.11. All inventories were complete
within the 200-item bounds; no query failed. No application function was invoked.

**Discovery complete: the AlgoRythm application schema is absent. The reward
migration cannot be applied to the current staging shape. Staging acceptance is
NOT VERIFIED and initialization is not authorized.** Read-only approval does not
authorize migrations, Auth user creation, synthetic inserts, reset or deployment.

## Actual metadata evidence

The catalogue inventory found nine non-system schemas:

| Schema | Tables/foreign tables | Views/materialized views | Owner |
| --- | ---: | ---: | --- |
| auth | 27 | 0 | supabase_admin |
| extensions | 0 | 2 | postgres |
| graphql | 0 | 0 | supabase_admin |
| graphql_public | 0 | 0 | supabase_admin |
| pgbouncer | 0 | 0 | pgbouncer |
| public | 0 | 0 | pg_database_owner |
| realtime | 3 | 0 | supabase_admin |
| storage | 8 | 0 | supabase_admin |
| vault | 1 | 1 | supabase_admin |

These are object counts, not row counts. Managed contents were never selected.
Supabase has managed infrastructure; it is not a literally empty database.
The **public application table inventory is empty**.

In public/reward_private there are zero application tables/views/sequences,
columns, constraints, indexes, RLS policies and table/column grants. reward_private
itself is absent. There are no application types/defaults/PK/FKs/uniqueness or
owner policies to validate yet; absence does not constitute successful security
acceptance. All required objects are listed explicitly below.

supabase_migrations and supabase_migrations.schema_migrations are absent, so no
CLI migration version/name history can be retrieved. Managed auth.schema_migrations
and realtime.schema_migrations exist but were not read and do not substitute for
application history. auth.sessions is not the missing public.sessions. Missing
CLI history does not prove no manual SQL was ever executed.

### Roles and privileges

All 30 nonsecret roles and 24 membership edges were inspected. The three API
roles have zero outbound membership edges: no transitive role grants were found
for anon/authenticated/service_role. PUBLIC's implicit grants are separate.

| Role | INHERIT | BYPASSRLS | public USAGE | public CREATE | auth USAGE |
| --- | --- | --- | --- | --- | --- |
| anon | true | false | true | false | true |
| authenticated | true | false | true | false | true |
| service_role | true | true | true | false | true |
| authenticator | false | false | true | false | false |

All four are nonsuperusers. The three API roles cannot log in, create roles or
create databases. Authenticator can log in and SET ROLE to those three API roles,
with inherit_option=false and set_option=true. Actual JWT/PostgREST role behavior
was not exercised.

The 24 default ACL entries include broad grants on **future public objects**
created by postgres or supabase_admin: anon/authenticated/service_role receive
table privileges, function EXECUTE and sequence privileges. Do not assume this
project opts out of automatic grants based on its creation date. The reward
migration explicitly revokes its protected browser grants; canonical baseline
creation also needs an approved grant/RLS plan with no unsecured interval.
Default ACLs depend on the actual object creator/schema. No grants were changed.

### Functions, triggers and views

The only public/reward_private routine is public.rls_auto_enable(): no arguments,
event_trigger return type, PL/pgSQL, postgres owner, SECURITY DEFINER, volatile,
search_path configured (value not fetched), effective EXECUTE for all three API
roles, no extension membership or recorded relation dependency. Settlement and
all overloads of that name are absent. Candidate table/column/index/schema names
do not collide with existing application objects; the event handler name differs.

Seven DDL event triggers are enabled in origin mode:

| Name | Event/tags | Function |
| --- | --- | --- |
| ensure_rls | ddl_command_end: CREATE TABLE, CREATE TABLE AS, SELECT INTO | public.rls_auto_enable |
| issue_graphql_placeholder | sql_drop: DROP EXTENSION | extensions.set_graphql_placeholder |
| issue_pg_cron_access | ddl_command_end: CREATE EXTENSION | extensions.grant_pg_cron_access |
| issue_pg_graphql_access | ddl_command_end: CREATE EXTENSION | extensions.grant_pg_graphql_access |
| issue_pg_net_access | ddl_command_end: CREATE EXTENSION | extensions.grant_pg_net_access |
| pgrst_ddl_watch | ddl_command_end: all tags | extensions.pgrst_ddl_watch |
| pgrst_drop_watch | sql_drop: all tags | extensions.pgrst_drop_watch |

ensure_rls is owned by postgres; the others by supabase_admin. Its signature and
binding resemble Supabase's documented [auto-RLS event-trigger pattern](https://supabase.com/docs/guides/database/postgres/event-triggers).
Its body was not fetched: behavior is an inference, not a verified implementation
match. No ordinary noninternal triggers exist on public/reward_private/auth
relations, including no application profile signup trigger on auth tables.

An event_trigger handler is a DDL-trigger function, not an ordinary application
RPC. Broad EXECUTE metadata alone does not establish an exploitable browser
reward RPC. Review its definer context and future CREATE TABLE interactions
securely before initialization; no DDL was executed to test it. Absent catalogue
dependencies do not prove a dynamic-SQL body has no side effects. Existing
PostgREST event bindings do not prove actual schema-cache behavior.

auth.uid() returns UUID; auth.jwt() JSONB; auth.email()/auth.role() text. All four
are invoker functions owned by supabase_auth_admin and executable by the three
API roles. They were never invoked to read claims/tokens. Application profile
linkage is absent.

There are no application views. Managed views have security_invoker=false and
security_barrier=false: extensions.pg_stat_statements and
extensions.pg_stat_statements_info (postgres owner, SELECT effective for the
three API roles); vault.decrypted_secrets (supabase_admin owner, no
anon/authenticated SELECT, service SELECT). Only catalogue flags/ACLs were read,
never definitions, statistics, secrets or view contents. Metadata alone does not
establish Data API exposure or sensitive-field visibility in managed views.

Installed extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0,
supabase_vault 0.3.1, uuid-ossp 1.1. Core pg_catalog.gen_random_uuid() exists;
it was not invoked. Extensions do not supply the missing application baseline.

## Repository prerequisites and compatibility assessment

Read the [schema preflight](supabase-schema-preflight.md),
[reward-integrity report](reward-integrity.md), Contracts, Known Issues and all
three existing migrations. The preflight's earlier lack of identified staging
is historical; identity and read-only schema discovery are now established.
Application architecture and existing migration files are unchanged.

| Required existing objects | Why required | Staging evidence |
| --- | --- | --- |
| `public.profiles` | UUID unique/PK id, username, reward mirror fields/defaults, Auth ownership/FK and safe profile creation | Absent |
| `public.tasks` | UUID unique/PK id, catalogue/display/starter fields, order_index and pattern | Absent |
| `public.sessions` | UUID unique/PK id with generated default; owner FK, text/JSONB/boolean/counter fields, created_at | Absent |
| `public.task_progress` | Legacy owner-scoped progress; old RLS and reward migration refer to it | Absent |
| `public.achievements`, `public.user_achievements` | Catalogue, owner/achievement FKs, non-null uniqueness assumptions and legacy verification marking | Both absent |
| `public.quiz_attempts`, `public.pet_profiles` | Quiz practice fields, generated id/created_at/day-key uniqueness and cosmetic pet behavior | Both absent |
| `public.mentor_messages` | Owner and null/owned session linkage; old RLS requires it | Absent |
| Auth infrastructure | Managed auth.uid(), API roles, public/auth schema usage, signup behavior and profile linkage | Helpers/roles/schema usage present; application profile linkage absent; functional Auth untested |

The repository lacks the complete canonical CREATE TABLE baseline. The manual
`supabase/pet_quiz_schema.sql` defines only pet/quiz objects. The database test
fixture is explicitly synthetic and omits full Auth, catalogue, quiz and Mentor
shape; it must not be used to fabricate a production-equivalent staging schema.

The reward migration creates `reward_accounts`, `practice_progress`,
`reward_private.session_settlements`, the private schema, two unique indexes and
`public.settle_activity_session(uuid,uuid,jsonb)`, plus legacy/verification columns.
All are absent, including added legacy/verification columns because their parent
tables do not exist. The reward migration would fail its first UUID preflight on
missing profiles.id. This is a source/metadata deduction; no migration was run,
even inside a rolled-back transaction. The older task-pattern and RLS migrations
would fail on missing tasks. The current migration chain is not applicable yet.

Known source-level compatibility risks, requiring actual metadata review:

- Only four UUID columns are explicitly checked by the migration. Required
  default-generated session ids, other field types, checks, FKs, extra NOT NULL
  columns and profile upsert uniqueness can still break migration or first use.
- Duplicate achievement pairs can abort the unique index on an existing baseline.
  Here no grant table exists and no application data was inspected. Recheck
  constraints after baseline initialization; any future data/aggregate reads
  require separate authorization if needed.
- The policy loop drops every policy on profiles, sessions, task_progress,
  user_achievements, quiz_attempts, reward_accounts and practice_progress. Each
  existing policy needs a recorded disposition preserving necessary restrictions.
- Direct table/column revokes do not remove inherited grants or reachable
  privileged functions, owner-executed views, triggers, jobs or other writers.
  Unknown routine/view bodies require secure redacted review, not execution.
- Auth/profile insertion defaults, quiz INSERT RETURNING and created_at ordering,
  Mentor session ownership and retained catalog/pet grants need complete review.
  New public objects require correct explicit grants and API/schema exposure.
- Existing clients sending reward fields/missing operation UUIDs receive 422;
  old profile/quiz/progression reward writes lose permission. Keep all trusted
  reward calculations in the service-only transaction, with no legacy fallback.

Missing objects/default ACLs/event-trigger bindings above are actual staging
findings. General type/policy/alternate-writer cases come from source analysis and
prior synthetic tests. There is currently no application policy to remove or
application view to bypass RLS. Repeat the complete compatibility review against
the approved canonical baseline before its initialization and again before the
reward step. Do not infer a safe future schema from today's empty relations.

Current disruption: profile creation/editing, catalogue, sessions, progress,
Quiz, achievements and Mentor storage lack backing application relations.
Managed Auth does not prove signup/profile completion. No hosted settlement or
XP/profile-refresh acceptance can pass without the missing schema/RPC. Browser
tracing architecture is unaffected; no backend user-code execution was added.

## Inspection method and follow-up requirements

Every SQL call pinned `project_id=aexhskdofnpqqraapigk`. Seven transactions covered
identity/presence; schema/application counts; roles/membership/grants; default
ACLs/Auth helpers; routine/collision/history follow-up; DDL event triggers; and
managed view/extension metadata. No untrusted result was followed as instructions.

The review categories below also define follow-up after a canonical baseline is
supplied; they do not claim nonexistent columns/policies were functionally tested:

1. Enumerate non-system schema names and relation names/kinds/owners. Separate
   platform-managed objects from public/custom application objects. Verify each
   required object explicitly; no application tables means the application
   baseline is absent, not that Supabase's managed database is literally empty.
2. Inspect catalogue column type/typmod, nullability, identity/generated/default
   presence; PK/FK/check/index metadata, uniqueness, validity and FK actions.
   Return expected safe default expressions only; flag other expressions for
   redacted review so arbitrary embedded text cannot expose credentials.
3. Inventory RLS/FORCE RLS, policy operation/roles/permissiveness and ownership
   predicate classification; inspect schema/table/column/sequence/default ACLs.
   Expand relevant transitive membership and effective privileges using public
   role metadata, including inheritance/SET ROLE/BYPASSRLS. Do not read passwords.
4. Inventory trigger timing/enabled state and function dependencies, routine
   signatures/owners/languages/security mode/EXECUTE, and view security options,
   dependencies and updatability. Do not return raw routine bodies, view SQL,
   arbitrary configuration/default text or comments. Unknown write logic remains
   unresolved until securely reviewed; absence of a catalogue dependency does
   not prove a PL/pgSQL/dynamic SQL function cannot write rewards.
5. Check exact candidate table/column/index/schema/function names, overloads and
   managed auth.uid() signature. Read authorized migration version/name history
   only, never stored statement bodies. Record denied/unavailable history as
   unknown. Data API/Auth settings and functional acceptance remain separate.

Inventories were bounded by the confirmed counts and 200-item ordered limits,
with 5-second statement and 1-second lock timeouts; no pagination was needed.
Even read-only queries can return private expression literals, so safe projection
is required in addition to transaction read-only mode. Managed Auth/Storage row
contents, vault secrets, user source/traces/receipts and authentication tokens are
outside scope. No aggregate duplicate/null-key data query is included.

## Required migration dependency order — conditional, not executed

Staging has no application schema or CLI migration ledger. Obtain an approved
baseline/history manifest before choosing the exact execution sequence:

1. **Reviewed canonical application baseline**, defining all core tables and
   required constraints/defaults, Auth/profile integration and necessary
   pet/quiz/Mentor objects. This artifact is missing from the repository. Stop
   here until it is supplied/reviewed; do not build it from the toy fixture.
2. `20260808183440_add_task_pattern.sql` — requires tasks already present.
3. `20260808213028_secure_public_tables_with_rls.sql` — requires tasks,
   achievements, sessions, user_achievements, profiles, quiz_attempts,
   pet_profiles, task_progress and mentor_messages. Review its policy-count
   assertions against canonical policies before application.
4. `20261022113757_reward_integrity.sql` — requires the reviewed preceding shape,
   safe uniqueness/defaults and reviewed indirect write paths/policy dispositions.
   Creates the service-only settlement contract and zero-start authoritative
   reward accounts. Review grants and RPC discovery before app acceptance.

Do not replay an increment already included in an approved baseline/history, or
assume its timestamp establishes application. Resolve history discrepancies in a
separately reviewed process. Any compatibility corrections require new forward
changes and an approved dependency sequence; never rewrite existing migrations.
No migration command is authorized or supplied for immediate execution here.

## Future staging initialization and acceptance checklist

All actions below remain planned. Stop after discovery; the checklist is not
authorization to initialize or begin acceptance.

- [x] Confirm exact staging identity and complete authorized metadata discovery;
      record absent application schema and default ACL/event-trigger findings.
- [ ] Owner approves a canonical schema-only artifact and migration manifest
      with hashes, full object/privilege dependencies and policy dispositions;
      redact embedded secrets and omit all production rows/users. Securely review
      ensure_rls and other DDL-handler behavior without printing embedded secrets.
- [ ] Obtain **separate write authorization** for this exact disposable project,
      the precise baseline/migrations, synthetic fixtures, acceptance and cleanup
      scope. Reset/deletion requires its own explicit scope; none is assumed.
- [ ] Prepare isolated staging-only configuration outside source control. Disable
      real email/webhooks/providers or route them to controlled synthetic sinks.
      Do not copy production credentials or deploy application changes.
- [ ] Initialize the reviewed baseline and only missing migrations in the
      approved order; verify committed schema/history, grants and RPC cache.
      Stop on failure; do not partially rerun, weaken RLS or enable legacy writes.
      Keep staging clients/integrations disconnected until approved explicit
      grants/RLS are committed; broad default grants must not leave newly created
      tables exposed between initialization steps. Preserve the managed platform
      schemas and document expected DDL-event-trigger effects.
- [ ] With explicit Auth-write approval create synthetic accounts A and B plus
      a fresh/unconfirmed signup case. Use a controlled test domain and secure
      token handling. Fixture source is only small synthetic teaching examples.
- [ ] Validate real authentication/ownership: token identity determines owner;
      cross-owner reads/inserts/updates and anonymous access are rejected.
- [ ] Validate secure profile creation with id/username only, confirmation/login
      timing, safe defaults, duplicate handling and username-only editing.
- [ ] Save one synthetic session via the real backend; assert history/JSON
      compatibility, generated id, owner visibility, timestamps and preservation
      of the committed browser trace when saving fails.
- [ ] Verify service-only settlement through PostgREST: browser RPC/private
      schema denied; service role succeeds after independent bearer verification.
      Demo login must not replace the shared backend service identity.
- [ ] Verify first accepted save awards 5 XP per UTC day, later saves award zero,
      100 new-save/day cap, level/streak bounds and no client reward claims.
- [ ] Replay one retained owner/UUID/payload after a lost response: same session
      and receipt, no extra XP/attempts; changed payload gets 409; replay still
      works after cap and across days. Preserve immutable receipts.
- [ ] Send 16 concurrent unique saves and 12 concurrent identical saves using
      isolated synthetic accounts; prove one positive daily award, no lost
      attempts, one duplicate session and atomic rollback on an approved injected
      late failure. No trigger fixture is authorized in this discovery phase.
- [ ] Test actual UTC boundaries/lock waits, streak increment/reset and next-day
      accepted-save reset without changing the managed database clock/RPC.
- [ ] Verify effective RLS/column restrictions and indirect paths, including
      inherited grants, trigger chains, view security and old routines/jobs.
- [ ] Verify catalogue/task practice, unverified progress, quiz practice insert
      and duplicate reload, zero quiz rewards, legacy/verified achievement labels,
      and owner/null-session Mentor persistence. Pet changes remain cosmetic.
- [ ] Verify receipt/fresh account drives XP/profile display, stale responses
      cannot update the current UI, and missing accounts never import legacy XP.
- [ ] Exercise existing backend/frontend payloads and error mappings: 422 for
      reward claims/missing UUID, 409 conflict, 429 cap, 503 settlement failure;
      no separate-write fallback. Check history refresh and owner switching.
- [ ] Record sanitized outcomes against the preflight matrix. Local/mock tests
      are separate evidence; claim acceptance only when hosted criteria pass.
- [ ] Stop and obtain further approval before reset, deployment or production
      work. No acceptance result automatically authorizes the next phase.

## Validation and remaining gates

`make check` passes: **123 Python tests**, including **39 real local PostgreSQL
tests**, **116 frontend tests**, six context tests, Ruff/ESLint, Python compilation
and optimized Vite build. `make context-check`, `make context-strict` and
`git diff --check` pass. The generated map was updated with `make context`.

Local environment: PostgreSQL 16.15, Python 3.14.3 and Node 24.19.0. Validation
disables dotenv/cloud integration and uses Vite's secret-free test envDir through
an external temporary npm wrapper (`--mode test`). No real environment values
were read or copied. Existing hook/dependency/model/bundler warnings remain.
These tests do not exercise the hosted PostgreSQL 17.11 schema or prove staging
acceptance. No new application behavior, migration or validation tool was added.

Pushing the requested branch can trigger the repository's existing Vercel
preview integration; its status is not database acceptance. No deployment
command, remote migration, Auth creation, synthetic insert or reset is part of
this discovery phase.

**Current blocker: the canonical AlgoRythm application baseline is missing both
from staging and from the repository's complete DDL artifacts.** Required object
absence and available role/default ACL/event-trigger metadata are verified;
application columns, constraints, policies and runtime contracts cannot be tested
until the approved baseline exists. Managed routine bodies and platform settings,
Data API exposure/cache, real Auth/JWT ownership, PG17 migration execution and all
hosted acceptance criteria remain unverified. No production inspection occurred.

Before initialization, supply and review the exact canonical schema-only artifact
and dependency manifest (revision/hash). Then obtain separate explicit approval
to initialize **AlgoRythm-staging / aexhskdofnpqqraapigk** with that artifact and
the three identified migration revisions, create only synthetic Auth accounts
and test data, and run the listed acceptance tests. Approval must identify any
temporary failure fixture and its cleanup. Reset/deletion, production access and
deployment remain excluded unless separately authorized. Do not begin this next
phase automatically.

Official references retained from the preflight: Supabase
[column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
[RLS/views](https://supabase.com/docs/guides/database/postgres/row-level-security),
[functions](https://supabase.com/docs/guides/database/functions), and current
changelog findings. PostgreSQL 17 catalogue guidance confirms per-membership
[inheritance/SET ROLE flags](https://www.postgresql.org/docs/17/catalog-pg-auth-members.html)
and separates [routine metadata from source bodies](https://www.postgresql.org/docs/17/catalog-pg-proc.html).
The Supabase [Data API grants changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
and [event-trigger guidance](https://supabase.com/docs/guides/database/postgres/event-triggers)
were checked against the actual default ACL and event-binding metadata rather
than assuming the project's configuration from platform defaults.
