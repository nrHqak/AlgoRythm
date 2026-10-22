# Supabase schema compatibility and staging preflight — 2026-10-22

## Decision and inspected scope

**Remote compatibility and staging acceptance: NOT VERIFIED. Release blocked.**
The repository/local preflight is complete; it does not certify the actual
Supabase schema or make the reward migration safe to apply to an unknown schema.
No remote SQL, migration, schema change, data copy, deployment command or merge
was run.

Base: `security/reward-integrity` at
`8cc322b8f19da312e5d22cd843757d81517dc3c8`, parent
[PR #4](https://github.com/nrHqak/AlgoRythm/pull/4).
Work branch: `audit/supabase-staging-preflight`. Existing migrations and application
code are unchanged. The browser Pyodide worker, deadlines, builtin policy, step
caps and backend prohibition on executing user Python remain unchanged.

Read: root/frontend/backend/Supabase agent guides, AI_CONTEXT, Contracts,
Known Issues, Workflows, Deploy, the reward-integrity report, all three repository
migrations, the manual pet/quiz SQL, database fixtures/tests, backend settlement,
and frontend auth/profile/catalogue/history/quiz/Mentor dependencies.

### Environment evidence and authorization boundary

Only the connected Supabase **project inventory** was requested. It returned one
project named **AlgoRythm**, status ACTIVE_HEALTHY, PostgreSQL engine 17 with
reported version 17.6.1.155. The inventory does not identify it as disposable
staging or establish authorization to inspect that project's database. Remote
inspection stopped at that point. No tables, policies, functions, migration
history, Auth users, logs, keys or connection strings were fetched.

There is **no confirmed, authorized disposable staging project available to this
audit**. This is not proof that none exists outside the connected inventory.
The engine version is inventory metadata, not schema evidence. No remote column,
grant, duplicate count, trigger, view or RPC finding is asserted below.

Local evidence uses PostgreSQL 16.15 and synthetic UUIDs/rows in a freshly
initialized private UNIX-socket cluster, with no TCP listener. The harness strips
PG connection environment options, uses a private nonexistent password-file path,
and accepts no external database URL. Temporary database creation/cleanup is
confined to that cluster. No destructive remote SQL or general-purpose reset
utility was introduced. Real `.env` files and credentials were not read.

## Migration object inventory and assumptions

Candidate: `supabase/migrations/20261022113757_reward_integrity.sql`.
It wraps its changes in one transaction. Its explicit preflight checks **only**
the UUID type of `profiles.id`, `tasks.id`, `sessions.id`, `sessions.user_id`.
It does not establish the other prerequisites below.

| Object | Required existing shape / effect | Compatibility checks still required remotely |
| --- | --- | --- |
| `profiles` | `id` UUID unique/PK; writable `username`; numeric `xp`, `level`, `streak`; `last_active_date` date compatible. Adds JSONB `legacy_reward_snapshot`, snapshots existing values, resets reward defaults | FK to Auth and signup triggers; id uniqueness for upsert/FKs; username unique/default/null rules; reward ranges/checks; other required fields; triggers on snapshot or mirror updates; existing snapshot name collision |
| `sessions` | `id` UUID unique/PK **with a working default**; `user_id` UUID; `code`, `array_var`, `algorithm_type` text compatible; `trace`, `error` JSONB compatible; `total_steps`, `attempts`, `xp_earned` integer compatible; `solved` boolean. Adds `reward_policy`, `completion_verified`, `reported_task_id` | Every listed column/type/check; default id generation and privileges; unlisted NOT NULL columns/defaults; owner FK; task/algorithm enum constraints; `created_at` for history ordering; generated columns, partitioning, rules and triggers |
| `tasks` | UUID unique/PK referenced by practice FK and task lookup | Canonical catalogue fields, `order_index` used by API, `pattern` from earlier migration, starter/display fields; catalog SELECT policy retained, not rebuilt here |
| `task_progress` | Must exist with `user_id` comparable to `auth.uid()`; policies/grants replaced; no new writes | Legacy constraints/consumers and any non-reward operations relying on INSERT/UPDATE; historical completion must not authorize rewards/unlocks |
| `user_achievements` | Must contain `user_id`, `achievement_id`; adds `verified=false`; creates unique owner/achievement index | Types/FKs/nullability; duplicate non-null pairs prevent migration; null keys remain distinct under the ordinary unique index, so confirm NOT NULL canonical ownership/achievement keys; existing index/column names |
| `achievements` | Catalogue unchanged by reward migration | `id`/FK shape, `title` for ordering, `description`, `xp_reward` display; existing catalog grants/RLS; values are not settlement authority |
| `quiz_attempts` | `user_id`, `quiz_day`, `question_key`, `prompt`, `correct`, `response_ms`; `xp_earned` default reset to zero | id default, `created_at` for frontend ordering, unique `(user_id,quiz_day,question_key)`, types/checks/defaults and other required columns; insert-returning SELECT behavior |
| `reward_accounts` (new) | UUID owner PK/FK profiles; bigint XP 0..2147483647; level 1..5; bounded integer streak/saves; date last-active/save-day | Name absent; schema usage, effective service grants/BYPASSRLS, default privileges and dependency behavior. Starts at zero, not legacy XP |
| `practice_progress` (new) | Owner/task UUID FKs + composite PK; reported boolean, bounded attempts/best steps | Name absent; valid referenced unique keys; new progress is provisional, never certified completion |
| `reward_private.session_settlements` (new) | Private schema; owner/operation UUID PK; unique session UUID FK; JSONB request/receipt; award 0 or 5; date; partial unique owner/day for positive award | Schema/table/index name collisions; private schema usage denied to browser, not API-exposed; service privileges; no alternate writer, purge, cascade or receipt mutation path |
| `public.settle_activity_session(uuid,uuid,jsonb)` (new) | PL/pgSQL invoker, empty search_path, service-only EXECUTE + current_user check; qualified object references | No existing overload/collision; service role and schema access; PostgREST RPC discovery/schema cache/current_user; all referenced insert/update types/defaults/triggers at execution |

New columns/tables/schema/function/indexes are created without general
IF NOT EXISTS reconciliation. A partially or manually installed equivalent is a
blocker, not a reason to rerun blindly. The function's PL/pgSQL statements can
encounter shape errors on the first call even after CREATE FUNCTION succeeds.
The migration does not repair or fabricate a missing canonical baseline.

Dependencies: `20260808183440_add_task_pattern.sql` assumes `tasks` already
exists; `20260808213028_secure_public_tables_with_rls.sql` assumes all core,
pet, quiz and Mentor tables already exist. Its policy-count assertions can also
reject unexpected custom policies. `pet_quiz_schema.sql` is manual partial DDL,
not the full baseline or a safe universal replay sequence. The local fixture is
deliberately smaller: for example it lacks quiz `created_at` and the manual SQL's
quiz uniqueness, full task/achievement display fields, Auth signup infrastructure
and complete pet/Mentor fields. Passing fixture tests cannot certify those flows.

## Compatibility and security findings

### Confirmed locally, conditional on the baseline

Ten cases in `tests/database/test_schema_preflight.py` exercise the unchanged
migration against synthetic schema variants. Passing means the stated failure or
exposure was reproduced, **not** that those variants are safe or occur remotely.

| Case | Observed local result | Required disposition before rollout |
| --- | --- | --- |
| Duplicate historical achievement pairs | Unique-index creation aborts; earlier snapshot DDL rolls back; both original rows remain | Obtain only aggregate duplicate/null counts first; separately approve preservation/reconciliation. No automatic deletion/deduplication |
| Session id default absent; extra required session column (two cases) | Migration commits; first settlement fails NOT NULL; account/session/practice/receipt all roll back | Verify defaults and every required field using canonical schema and a real staging save |
| Extra required profile field | Migration commits; authenticated id/username-only profile insert fails | Review signup schema/trigger/defaults and exact browser insert contract; do not restore browser reward writes |
| Custom restrictive profile SELECT policy | Migration drops it and owner read becomes allowed | Review each removed policy's purpose; retain necessary restrictions through a reviewed migration rather than assuming all policies disposable |
| Inherited profile XP column privilege | Direct revoke from PUBLIC/anon/authenticated leaves inherited UPDATE effective; browser changes profile mirror | Review transitive role membership/effective privileges. This example alone does not grant trusted account XP, but violates the protected-column boundary |
| Existing broadly executable SECURITY DEFINER RPC | Function remains callable; synthetic legacy function changes trusted account to 999 XP | Inventory every reachable write-capable function, overload, owner, search_path and effective EXECUTE. Remove alternate reward authority through separately reviewed changes |
| Existing view owned by privileged role | Table returns only owner, view returns all three synthetic profiles | Review view owner, ACLs, security_invoker, dependencies, rules and updatability; table RLS alone does not secure an owner/definer view |
| Existing profile XP trigger | Receipt/ledger award 5, but trigger makes trusted account 105 | Review all trigger chains, including profile mirror updates. Transaction atomicity does not prevent unintended extra writes inside the transaction |
| Session timezone chosen to differ from UTC calendar day | Ledger date follows UTC with Etc/GMT+12 or Pacific/Kiritimati | Supplement with real midnight/lock-wait acceptance; this test does not cross wall-clock midnight |

These are release gates for unknown database behavior, not reported live
vulnerabilities. No production migration or application security was weakened to
make them pass. Compatibility fixes require their own reviewed forward changes.
A later migration cannot repair an earlier migration's failed prerequisites;
resolve the canonical preconditions and approve the complete execution sequence
before running the pending chain. Do not edit applied migration history or
silently skip failed statements.

### Policy replacement and grant review

The replacement loop drops **every policy** on these seven tables, including
restrictive, admin, tenant, status, retention or other custom rules if present.
It revokes table and existing column grants from PUBLIC/anon/authenticated, then
installs the following access. It does not revoke grants from inherited roles,
other schemas, existing views/functions or background jobs.

| Table | Known repository policies replaced | New authenticated behavior / required review |
| --- | --- | --- |
| `profiles` | `profiles_owner_select/insert/update` | Owner SELECT, INSERT(id,username), UPDATE(username) only; safe defaults. Check account suspension/tenant rules and legitimate additional editable fields |
| `sessions` | `sessions_owner_select` | Owner read only; all history writes service RPC; inspect upload/admin/retention consumers |
| `task_progress` | `task_progress_owner_select/insert/update` | Owner read only; old completion/unlock writers intentionally fail; new practice goes elsewhere |
| `user_achievements` | `user_achievements_owner_select` | Owner read only; legacy rows unverified; no reward grants via browser |
| `quiz_attempts` | `quiz_attempts_owner_select/insert/update` | Owner read + practice INSERT excluding XP; UPDATE removed; verify duplicate/reload flow and any legacy edit behavior |
| `reward_accounts` | None in the fixture; any colliding table blocks earlier | Owner SELECT only; no browser writes |
| `practice_progress` | None in the fixture; any colliding table blocks earlier | Owner SELECT only; backend provisional writes |

`tasks`, `achievements`, `pet_profiles`, `mentor_messages` are outside this loop;
their old policies/grants are not resecured by the reward migration. Known Mentor
policies require both message owner and a null/owned linked session. Inspect
their actual metadata and other indirect paths. Auth user/profile creation
triggers also need review. Service INSERT on profiles or other administration
tables is not newly provided by this migration; do not assume historical service
default grants are present or make them broad without a demonstrated need.

Account-row locking serializes settlement for each owner; owner/key uniqueness,
receipt payload equality and the positive-award owner/day index enforce local
replay/cap semantics. The clock is read after acquiring that lock. Atomicity
assumes normal transactional table/function/trigger behavior, reviewed constraints
and no unsafe external side effects. An HTTP timeout after commit is ambiguous:
retry the **same operation UUID and normalized payload**, not a new operation.
Receipt retention is part of this contract. The session FK deliberately prevents
silent deletion of a settled session; deletion/retention/account-removal workflows
need separate review rather than cascading away idempotency evidence.

## Workflow compatibility map

| Workflow and source | Required checks / potential break |
| --- | --- |
| Signup/login: `frontend/src/hooks/useAuth.jsx`, `useProfile.jsx` | Only id/username creation; ignore duplicate signup profile; confirmation-required signup defers creation. Confirm auth.users FK/trigger ownership, actual authenticated JWT, safe defaults, unique username and extra required fields; no reward fields accepted |
| Profile initialization/edit: `useProfile.jsx` | Owner profile insert/read/update-returning; username only. Reward account SELECT maybeSingle; missing account displays zero/level one/no streak; denied account read must not fall back to legacy XP |
| Task catalogue/progression: `backend/main.py`, `LearnPage.jsx` | Tasks ordered by order_index; existing SELECT/catalog fields. Owner provisional practice reads; all practice tasks available; no legacy completion-gated unlock or task_progress writes |
| Run/session history: `PlaygroundPage.jsx`, `ProfilePage.jsx`, `/session/save` | UUID session default, owner read, created_at ordering, JSON trace/error compatibility, reported outcome labels, activity-v1 metadata. Unknown task UUID stays history only; no practice FK insertion unless catalogue task exists |
| Daily Quiz: `useDailyQuiz.js` | Authenticated INSERT practice columns + SELECT returning; zero default XP, day/key uniqueness and created_at order. Duplicate 23505 reload works; removed UPDATE is not required by current hook. Correctness remains client-reported |
| Achievements: `ProfilePage.jsx` | Catalogue title/description read; only verified owner awards displayed; old verified=false rows retained, no newly granted achievements or solution bonuses |
| Mentor: `MentorChat.jsx`, `MentorPage.jsx`, backend mentor | Owner conversation persistence and cross-owner session rejection; null session allowed on save failure; its policies unchanged. Conversations/hint claims never earn XP |
| XP/level/streak: receipt + `useProfile.jsx` | Only reward_accounts authoritative; profile mirror is compatibility data. UI fresh read/receipt, no optimistic bonus; no-eligible-reward differs from save failure; retain stale-response guards |
| Existing history/admin/demo seed | Source/traces preserved; session solved is reported, old reward_policy legacy_unverified, progress/awards historical. Snapshot old profile values before first mirror update. Do not use legacy seed utilities to initialize trusted XP or copy production data |
| Pet cosmetics | Existing owner grants/RLS and required pet columns still needed for quiz cosmetics; no reward/eligibility dependency. No unrelated feature change in this phase |

Old clients sending `xp_earned`, completion/attempt/hint reward claims or owner
fields, or omitting idempotency_key, receive 422. Old quiz/profile/progression
writes can receive permission errors. These are deliberate contract breaks:
coordinate clients/backend/database; do not restore vulnerable writes as a
compatibility fallback. The old backend could still write misleading session or
profile mirrors using its service privileges and must not coexist with the new
reward policy.

## Authorized metadata review to perform next

First obtain the exact project name/ref and owner confirmation that it is a
disposable, nonproduction environment, plus explicit read-only schema-metadata
authorization. Do not infer this from the name AlgoRythm. Use read-only
transactions, statement timeouts and metadata-only queries; do not invoke unknown
functions. If only a metadata export is supplied, record who produced it, the
target, engine version, migration identifiers and export revision/time.

Record these evidence categories as pass/fail/unknown against the inventory:

1. `pg_class`, `pg_namespace`, `pg_attribute`, `pg_type`, `pg_attrdef` and
   `information_schema.columns`: object kind/owner, column type/typmod,
   generated/identity/default presence, nullability and default behavior. Review
   expressions securely: definitions/defaults may contain embedded sensitive text.
2. `pg_constraint`, `pg_index`: PK/FK target/actions, unique/check constraints,
   validity, partial predicates, expression indexes; required id defaults and all
   proposed object-name collisions. Include dependencies/partitions.
3. `pg_trigger`, `pg_proc`, `pg_depend`, view/rewrite catalogues: trigger timing,
   enabled status, dependency chains, routine identities/languages/owner,
   security-definer flags/search_path, view security options and updatability.
   Include Auth signup triggers, scheduled/extension jobs and all routines or
   views indirectly able to write rewards, not just names containing “reward”.
4. `pg_policies`, RLS/FORCE RLS flags, table/schema/column/sequence/function ACLs,
   `pg_default_acl`, `pg_auth_members` and nonsecret `pg_roles` flags: expand
   transitive memberships, effective privileges and BYPASSRLS/owner/SET ROLE
   behavior. Never query password/secret catalogues. Diff every removed policy
   with an owner-approved disposition; do not rely on policy count alone.
5. Read migration **versions/names only** from authorized migration history;
   reconcile checksums against approved source without printing stored statement
   bodies. Review public/auth schema usage, auth.uid() availability, API exposed
   schemas, RPC schema cache and grants for anon/authenticated/service_role.
   `reward_private` must stay unexposed and inaccessible to browser roles.

Do not paste raw definitions, JWTs, user metadata, code, traces, receipts or dump
files into the report/chat. A trusted operator must securely review routine,
policy and default expressions, returning redacted findings. Schema-only exports
also need review for embedded secrets; exclude data, role-password/global dumps,
ownership tied to personal roles and managed Auth internals where inappropriate.

Duplicate/null-key checks are **data reads, not metadata**. They were not run
remotely. Obtain separate approval for aggregate counts only (no user/achievement
identifiers); if that is unavailable, keep index readiness unknown. Never
automatically reconcile historical rows. After any authorized correction, repeat
schema/grant/dependency review and acceptance against the resulting revision.

## Reproducible local plan and future disposable staging

### Local validation available now

Use repository setup with Python 3.14, supported Node 24 and PostgreSQL binaries.
No Supabase login, environment file or cloud credentials are needed for SQL tests:

```bash
REWARD_DATABASE_REQUIRED=1 PYTHON_DOTENV_DISABLED=1 .venv/bin/python -m pytest tests/database -q
```

`REWARD_POSTGRES_BIN` may select a local binary directory; it is not a DSN. The
harness initializes synthetic auth.uid() and API roles, applies core_fixture.sql
then the old RLS migration and reward migration, and checks actual PostgreSQL
privileges/transactions. Compatibility cases build independent premigration
variants in that private cluster. Tests clean up only their own temporary
databases/cluster. Missing PostgreSQL is a failure with REQUIRED=1, not a mocked
security pass. This does not reconstruct Supabase Auth/PostgREST or canonical DDL.

### Staging runbook — planned only, requires separate write authorization

1. **Identify and isolate.** Owner approves an exact disposable project/ref and
   scope. Provisioning a project/branch, initialization, synthetic Auth creation,
   migration execution, tests that write data and reset each need explicit
   authorization. Keep production integrations/email/webhooks disabled or
   directed at synthetic sinks. Use dedicated staging secrets only through the
   secret manager/environment configuration, never chat, source or report.
2. **Establish canonical baseline.** Obtain a reviewed schema-only baseline and
   migration-history mapping. Use a supported equivalent Supabase/PostgreSQL
   version/extensions/configuration; test on the actual engine 17 environment,
   not just local PG16. Build an empty project using reviewed application DDL
   and platform-managed Auth. Do not restore production rows, Auth users,
   sessions, tokens, storage or credentials. Do not copy the toy core fixture as
   the canonical staging schema. Unknown baseline means stop.
3. **Approve dependency order.** For a baseline predating repository increments:
   canonical core + required pet/quiz/Mentor objects, task-pattern migration,
   old RLS migration, then reward-integrity migration. If baseline already
   includes an increment, reconcile migration history through an approved
   process instead of reapplying it. Review custom policies before either RLS
   migration. Resolve index/default/name collisions before the reward step.
   Record exact file hashes, role/executor and before/after schema fingerprints.
   This report does not authorize executing this sequence.
4. **Synthetic fixtures.** Create Auth accounts A and B with disposable addresses
   under a controlled test domain, confirm them via authorized Auth tooling and
   obtain their own test JWTs securely. Add C for confirmation-required signup
   and a fresh-profile case. Assign catalogue task/achievement UUIDs generated
   in staging; all code is synthetic `pass`/small teaching examples. Seed legacy
   balances/rows only in staging for snapshot/history tests, never to bootstrap
   authoritative XP. Use an isolated schema variant/project for duplicate-row
   and alternate-trigger negative scenarios; never contaminate accepted staging.
5. **Capture permissions and migrate once.** Review metadata before application;
   execute as the approved migration owner only after authorization. Verify
   committed schema and migration history together. Capture sanitized errors
   and schema state on failure; do not continue or blindly rerun. Confirm no
   leftover partial objects, including behavior of the chosen migration runner.
6. **Exercise the real interfaces.** A/B JWTs and publishable client key exercise
   Data API; backend independently verifies each bearer principal and invokes
   service-only RPC. Direct browser RPC and private-schema access must fail.
   Also test service identity after demo login (isolated auth client). No test
   should print tokens, headers, source or full receipts. Browser flow: signup,
   profile edit, practice Run, history, quiz, Mentor, refresh and account switch.
7. **Repeat transaction cases.** For A send 16 concurrent distinct operations,
   then on a fresh synthetic account send 12 concurrent identical operations
   with one retained UUID/payload. Lose an HTTP response after commit and replay
   the same operation; send conflicting payload and expect 409. Reach 100 new
   saves, expect 429 on the next, then replay an accepted operation successfully.
   Inspect only synthetic receipt/account/session counts. Trigger a late failure
   only through an explicitly approved temporary staging fixture and prove no
   partial writes; remove it through that fixture's reviewed cleanup.
8. **Date/refresh acceptance.** Test first activity, same-day, consecutive day,
   skipped day, save-day reset, level thresholds and saturation with isolated
   synthetic state. Real UTC midnight and a lock acquired across midnight must
   use a controlled test schedule/harness; do not change the managed DB clock or
   production RPC. Refresh/two tabs must show one authoritative award. Retrying
   yesterday's committed operation today must return its old receipt, not award
   today's reward; a new operation remains independently eligible.
9. **Safe repeat/reset.** Local reruns recreate only the harness's private
   cluster. Remote reset is not provided as SQL here. Archive sanitized test
   evidence and, with separate owner confirmation of the exact disposable
   target, use the approved project lifecycle to recreate an empty environment.
   Never run a reset against the connected AlgoRythm project by assumption. If
   reset is not authorized, use fresh synthetic accounts and retain evidence;
   do not purge ledgers or bypass immutable migration history for convenience.

## Security acceptance matrix

“Local SQL” below means actual PostgreSQL 16 fixture execution. API/UI tests
use synthetic/mocked cloud responses and are separate evidence. **Every hosted
Supabase/Data API/Auth and deployed browser result remains NOT VERIFIED.**

| Criterion | Required staging result | Current evidence |
| --- | --- | --- |
| Authenticated owner isolation | A can read/edit allowed own fields; B cannot read or mutate A; anonymous denied; test INSERT RETURNING/UPDATE too | Local SQL roles/ownership pass; actual JWT/Auth/API unknown |
| Direct XP/reward writes | Browser cannot INSERT/UPDATE protected profile fields, accounts, sessions, ledger, progress or awards, through direct or indirect paths | Known fixture direct grants pass; inherited/function/view/trigger counterexamples show canonical audit required |
| Service-only settlement | Browser/anon RPC denied; private schema unavailable; real service call succeeds with independently verified owner | Local SQL role check/EXECUTE pass; PostgREST exposure/current_user unknown |
| Forged completion/owner/reward claims | Deprecated/extra fields 422 without RPC; success/algorithm claims award no solution bonus, verified completion or achievements | API validation tests + SQL provisional/zero-achievement evidence; hosted API unknown |
| Fixed 5 XP per UTC day | First new save 5, subsequent saves 0; fresh UUIDs do not bypass daily award; legacy XP ignored | Local SQL passes |
| 100-save daily cap | First 100 accepted; 101st new operation rejected with no partial rows; prior receipt replay still succeeds | Local SQL passes; API 429 mapping tested with mocked RPC |
| Concurrent unique saves | 16 saves, exactly one 5-XP award, all attempts retained, correct threshold level | Local SQL passes |
| Concurrent duplicates/two tabs | 12 identical requests → one session/attempt/receipt; other responses replay | Local SQL passes; actual tabs/API latency unknown |
| Idempotent retries | Lost-response replay same session and original receipt; owner-scoped keys; altered payload 409; no retention loss | Local SQL passes; API orchestration mocked; cross-day and actual network-loss acceptance still needed |
| UTC date boundary | Date independent of session/client timezone; wall clock after lock determines day; count resets; cross-day replay earns nothing extra | Local timezone and stored-date cases pass; actual midnight/lock-crossing/reset integration NOT VERIFIED |
| Streak/level/overflow | Same day stable; yesterday +1; gap resets to1; XP thresholds/counter bounds; balance ceiling safe | Local SQL passes; deployed display unknown |
| Atomic rollback | Late failure leaves no session/account/practice/receipt/mirror partial update | Local injected failure and missing-session-default cases pass; actual trigger/constraint interactions unknown |
| Achievement restrictions | Legacy grants remain unverified, catalogue readable, no new solution awards/duplicate grant paths | Local SQL + UI unit tests; unknown preexisting functions/jobs/duplicates block certification |
| Provisional task progress | Owned existing task only; attempts/best steps recorded as unverified; unknown UUID only history; no verified unlocks | Local SQL + frontend unit tests; canonical FKs/catalogue unknown |
| Session/history/legacy | Source/trace retained, created_at queries work, old rows legacy_unverified, zero-start account and snapshot explained | Local snapshot/history semantics pass; full canonical row shape and hosted history queries unknown |
| Frontend authority | Receipt/fresh account controls XP; no legacy fallback; save failure leaves trace; stale responses cannot mutate current view | Existing frontend unit coverage rerun; Prompt9 browser synthetic-cloud evidence retained, no new hosted browser claim |
| Signup/quiz/Mentor/pet | Confirmed/deferred profile creation, safe username edit, practice quiz reload and cosmetics, owner/null-session Mentor persistence | Partial SQL/unit evidence; full Supabase-specific workflow acceptance required |

## Production rollout plan — not executed

1. **Compatibility/recovery gate:** Review canonical metadata and all policy
   dispositions, close alternate reward writes and shape/duplicate blockers,
   complete disposable staging matrix with approved artifact versions. Have a
   tested restorable database backup/PITR point as supported by the actual plan,
   retained migration/schema fingerprints, designated operator, maintenance
   window, restore timing/data-loss decision and an isolated restore rehearsal.
   A schema-only export is not a data backup. Treat backup material as private.
2. **Approve semantics and bundle:** Owner signs off zero-start authoritative
   accounts, historical snapshot/legacy labels, unverified prior achievements,
   no verified-solution benefits and bounded participation policy. Pin migration,
   backend and frontend revisions. Communicate 422/permission failures for old
   clients and require reload/upgrade; no dual insecure endpoint or reward-write
   fallback. DEPLOY.md's legacy SQL-editor/seed notes are not a reward rollout
   approval or canonical initialization procedure.
3. **Quiesce privileged writes:** Drain old backend workers/jobs and disable
   reward-producing traffic under an approved maintenance procedure; account
   for direct browser old-client writes and queue/retry behavior. Verify the
   snapshot cannot race an old reward writer. Preserve operation UUID/payload
   across retries. Prepare compatible application artifacts before the window,
   with final production release authorization still required.
4. **Apply approved DB sequence, then compatible services/clients:** With separate
   explicit production authorization, apply once using the approved runner and
   executor, bounded lock/statement timeouts and measured lock/storage/index
   budget. The full profile snapshot update and unique-index build may lock or
   scan substantial data. Record commit/history status. Verify service grants,
   private schema and RPC discovery/cache before enabling the new backend, then
   the matched frontend. Keep the old privileged writer drained throughout.
5. **On migration/application failure:** Keep writes quiesced, record sanitized
   failure and whether commit actually occurred. In a transaction error all
   transactional changes should roll back; runner bookkeeping must also be
   checked. A timeout/disconnection does not prove rollback. Do not ignore an
   error, partially reapply, relax RLS or re-enable old reward handlers. Diagnose
   metadata and choose an approved forward correction or recovery procedure.
6. **Postdeployment validation:** Authorized synthetic canary only; verify
   signup, owner isolation, direct write denials, service RPC, one daily award,
   replay, profile account refresh, history, quiz, achievements and Mentor.
   Watch sanitized permission/422/409/429/503 rates, lock waits, latency, counts
   and account/receipt consistency. Never log source, bearer tokens or full
   payloads. Release normal traffic only after named owner approval.
7. **Forward-fix/recovery:** Prefer an approved append-only corrective migration
   and compatible app revision that retain committed receipts/accounts/history.
   Reverting frontend/backend Git alone cannot undo new DB records and must not
   resurrect client-authorized XP. A full database restore can discard later
   writes and requires a separately approved recovery/data reconciliation plan;
   it is not an automatic down migration. Never delete receipts, mark legacy XP
   trusted or recalculate rewards from client reports to make rollback easier.

Final release gate: named schema/security owner approves canonical compatibility
and policy preservation; product owner approves reward/history/client behavior;
operator proves recovery readiness; staging evidence is complete; exact
production target and coordinated deployment are separately authorized.

## Official documentation and changelog review

Reviewed current official guidance on 2026-10-22:

- [Column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
  [RLS and view security](https://supabase.com/docs/guides/database/postgres/row-level-security),
  [roles](https://supabase.com/docs/guides/database/postgres/roles) and
  [functions](https://supabase.com/docs/guides/database/functions): table/column
  grants, effective roles, view execution context and function EXECUTE are
  independent review surfaces; owner RLS alone is insufficient.
- [April 28 Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically):
  new-table exposure increasingly requires explicit role grants, with existing
  project rollout scheduled October 30. The reward migration already grants
  owner SELECT and service operations explicitly; verify schema usage/exposure
  in the actual project instead of assuming default grants solve access.
- [September 25 PostgreSQL update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes):
  17.6 → 17.11 includes extension/operator compatibility changes. Inventory's
  17.6 does not establish upgrade status; record actual staging engine/extensions
  and review applicable checks before baseline restore. No upgrade was run.
- [July 22 extension pinning change](https://supabase.com/changelog/extension-version-pinning-ignored):
  requested extension versions may be ignored; record installed versions rather
  than assuming a restored baseline pins them. No applied migration was edited.
- [October 12 TLS notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated):
  HTTP API CBC cipher retirement starts no earlier than November 10; include
  supported browser/backend TLS clients in staging checks. This audit changes no
  TLS or application dependencies.

## Verification results and explicit remaining unknowns

- **39 real local PostgreSQL tests pass**: 29 existing reward tests plus ten
  schema-preflight cases. Both canonical compatibility and counterexample scope
  are distinguished above. Missing local infrastructure cannot silently pass
  release validation with REWARD_DATABASE_REQUIRED=1.
- `make check` passes: **123 Python tests** (including 39 real DB cases),
  **116 frontend tests**, six context tests, Ruff/ESLint, Python compilation and
  optimized Vite build. Node 24.19.0 / Python 3.14.3 / PostgreSQL 16.15.
  The build uses `--mode test` and Vite's secret-free test envDir through a
  temporary npm wrapper outside the repository; dotenv/cloud integrations are
  disabled. No production environment values are used. Existing hook, dependency,
  classifier artifact and Pyodide bundler warnings remain; no upgrades were made.
- `make context-check`, `make context-strict`, `git diff --check`: pass after
  regenerating the repository map with `make context`.
- No new live-browser run or hosted acceptance was performed. Prior Prompt9
  browser evidence is historical and uses synthetic cloud responses.
- The authorized Git push/PR triggered the repository's existing integration
  checks, including a successful Vercel preview status. This is not staging
  acceptance or a production release; no deployment command was issued.

Unknown and blocking: actual canonical DDL, applied migration versions, duplicate
counts, complete policy purposes, effective inherited/default privileges,
triggers/view/routine/job write paths, Auth signup hooks, schema exposure and
PostgREST service identity/cache, PG17 behavior, real Supabase owner isolation,
midnight/retention integration, full hosted workflows, backup/recovery and
coordinated release acceptance. No mock or local fixture closes those unknowns.

Next authorization needed: identify the exact disposable staging project/ref,
confirm ownership and nonproduction/disposable status, and authorize read-only
metadata review. Provide a reviewed redacted canonical schema/history export if
direct inspection is unavailable. Separately authorize aggregate duplicate
counts, then separately approve staging initialization, synthetic Auth/data
writes, this exact migration and acceptance/reset scope after compatibility
review. Production migration and deployment require their own final approval.
