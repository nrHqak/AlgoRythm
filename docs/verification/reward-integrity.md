# Reward security and persistence integrity — 2026-10-22

## Assessment and scope

The source-level arbitrary-XP vulnerability is closed. A forward-only migration
and service-only RPC implement bounded activity rewards with real local
PostgreSQL transaction, concurrency and privilege evidence. The browser execution
architecture is unchanged. **This is not a claim that the live database is
secured:** no live schema, grants, migration or application deployment was changed.
Production remains blocked pending canonical-schema/security review and a
separately approved, coordinated staging/rollout acceptance.

Base: clean Prompt 8 branch `audit/production-readiness`, commit `c079c52`.
Implementation branch: `security/reward-integrity`. Prior branches/PRs are
preserved. The historical production-readiness report describes the old reward
flow; current Contracts and this report supersede its reward semantics.

## Original vulnerability and ownership audit

The old `/session/save` verified a user identity but used supplied `xp_earned`
and success/completion/algorithm/attempt/hint claims to grant privileged benefits.
The prior in-memory audit accepted 1,000,000,000 XP. Its session insertion,
achievement writes and profile update were separate non-idempotent operations.
The audit for this phase also identified a separate browser Daily Quiz XP write,
reward values in profile initialization, browser level synchronization, and
browser task-progress/first-solve/unlock writes.

| Path | Previous authority | Current boundary |
| --- | --- | --- |
| Playground Run | Calculated 30/10 XP plus task/first-solve/no-hint/attempt bonuses, upserted task progress/unlocks | Submits only history/practice annotations and a per-Run UUID; renders the server receipt |
| `/session/save` | Read/modify/write supplied XP; evaluated claimed achievements | Verifies bearer principal; one transactional RPC; no alternate writes |
| Auth signup | Upserted XP/level/streak values | Only id/username with ignore-duplicates; waits for an authenticated signup session; confirmed login/profile provider handles deferred creation |
| Profile provider | Inserted reward values and synchronized level from the browser | Safe creation, username-only editing; reads authoritative reward account; never imports legacy balance or writes reward columns |
| Daily Quiz | Correctness checked in JavaScript, then updated profile XP/level | Practice answers only; no XP column submission or balance update |
| Curriculum | Claimed completion drove first-solve rewards and next-task unlocks | All tasks available as practice; new practice rows are explicitly unverified |
| Profile history/achievements | Treated saved success/legacy grants as rewards | Reported success labeled unverified; only activity-v1 session XP counted; legacy grants have verified=false and are not shown as certified awards |
| Pet/Mentor writes | Owner-owned cosmetics/conversation | Remain cosmetic/conversational, never XP or eligibility inputs |
| Demo/admin seed utilities | Privileged synthetic/administrative writes | Remain explicitly privileged; legacy seeded balances/grants do not initialize authoritative activity accounts |

Existing `task_progress` is preserved read-only as legacy history. Authoritative
accounts, settlement receipts and new provisional practice records have no
browser write grants. No owner-only RLS policy is treated as column protection.

## Trust model and final policy

A client can forge the code, trace, errors, step counts, classifier label,
execution success, task identifier, attempts, hint usage and operation UUID.
Moving arithmetic to Python cannot make those claims credible. No browser-held
secret, signature, hash, or supposed execution attestation was introduced. No
backend user-code execution or fake trusted verifier was introduced.

`activity-v1` awards **5 XP for the first accepted authenticated session save per
account per UTC day**, regardless of reported execution success/error. It rewards
server-observed participation in saving, not proof of running code or learning.
A script can obtain that bounded daily participation reward without using the UI;
this is an explicit policy, not a claimed execution guarantee. Fresh identifiers
cannot bypass the 5-XP/day limit. A persistent 100-new-save/day/account ceiling
also limits accepted operation volume; identical retries remain recoverable after
that ceiling. This does not prevent a person obtaining multiple separate accounts.

XP, level and activity streak are authoritative only in `reward_accounts`.
Accounts start at zero; no untrusted old XP is imported. Existing profile reward
values are captured in `legacy_reward_snapshot`; a successful settlement mirrors
the new account back to the profile compatibility fields. Profile UI reads the
account, defaulting to zero/level one/no streak if no account exists. Existing
session history/source/traces remain intact, with old rows marked
`reward_policy=legacy_unverified`. New session `solved` values are reported
execution outcomes only; `completion_verified` is always false in this RPC.

Solution/task bonuses, fast-solve/no-hint rewards, algorithm achievements,
completion-dependent grants and completion-gated unlocks are unavailable.
Existing achievement records remain historical with `verified=false`. The
catalogue remains visible with an explanation. No new achievements are issued;
notification rendering still accepts an authoritative server result, with stale
Run protection. Demo login now uses an isolated non-persistent auth client: the installed SDK
changes Authorization headers on sign-in, so it must not mutate the shared
service client that invokes settlement. A regression covers this boundary.

Quiz results and task progress remain useful practice, clearly
separated from certified benefits. Introducing verified solutions is a separate
trusted-verifier design problem and is not necessary for this activity policy.

## API and frontend compatibility

The request requires a UUID `idempotency_key`, source, and optional bounded
history/practice fields. **Deprecated reward fields are rejected with 422**, as
are extra user ids or other unknown fields. This is a deliberate coordinated
contract change, not a silent compatibility grant. Source is bounded to 200,000
characters, trace length/steps to 300, metadata names to 128 characters and the
serialized payload to 2 MB. Negative or huge counters fail validation.

The verified Supabase bearer user is the sole principal. The API sends one
`settle_activity_session(p_user_id,p_operation_id,p_payload)` RPC using its
backend-only service client. Payload claims cannot select another reward owner.
Unknown task UUIDs can remain history annotations but cannot create catalogue
entries or verified benefits. Provisional practice is recorded only for an
existing catalogue task.

The receipt returns session id, `xp_awarded`, `reward_status`, `replayed`, an
account snapshot, provisional practice state, `completion_verified=false` and
`achievements_earned=[]`. Identical retries return the original receipt;
`xp_awarded` then describes the original award, not another increment. Key reuse
with different normalized data returns 409; the accepted-save ceiling returns
429; database/RPC failures return 503 without separate-write fallback. Transport
failure can leave commit outcome unknown: retry the same key/payload, never
interpret a lost response as proof of rollback. Clients are responsible for
retaining that operation key for retries; a new Run creates a new operation.

The lifecycle remains Run → real BrowserEngine/Pyodide → committed trace/player
→ background classification/session transaction → receipt/XP notice → fresh
profile read. No optimistic local bonus is displayed. Saved-with-no-eligible-XP
is distinct from persistence failure; either leaves the trace available. Existing
run generations reject stale UI changes, and historical saves can still finish.
Page-local ordering is for feedback only, not the database concurrency guarantee.
Mentor still starts from committed errors and stores replies against the matching
session (or null on save failure).

## Database design and authorization

Migration: `supabase/migrations/20261022113757_reward_integrity.sql`, generated
with the Supabase CLI as a new forward migration. It has an explicit transaction
and UUID-type preflight for core identity fields. The disposable fixture states
its assumptions; it is not a reconstructed canonical production schema.

The RPC uses **security invoker**, empty search_path and qualified relations.
Execute is revoked from PUBLIC/anon/authenticated and granted only to service_role;
it also checks current_user=service_role. The backend's independently verified
principal supplies the owner. The private receipt schema has no browser usage or
table access. There is no broadly callable SECURITY DEFINER function.

Within one transaction the function:

1. Creates/locks the owner's unique reward account, serializing all tabs/instances.
2. Checks owner/operation uniqueness and structural payload equality, returning a
   prior receipt before checking new-operation limits.
3. Reads the DB wall clock after locking and computes UTC eligibility, daily
   accepted-save limit, fixed award, level and streak from authoritative state.
4. Inserts session history, atomically updates provisional practice attempts/best
   steps, updates the account and profile mirror, and inserts the immutable receipt.

The owner/key primary key prevents duplicate settlement; a partial unique
owner/day index independently prevents more than one positive award. Receipt
session ids are unique, and session deletion cannot silently cascade away the
receipt. There is no TTL eviction that turns old retries into new awards.
Achievement owner/id uniqueness prevents duplicate grants, even though current
settlement grants none. Counters saturate safely; an account at the integer XP
ceiling receives zero with balance_limit, never an overflow or negative award.
All mutations roll back together on failure, including attempts and the receipt.

The migration revokes both table-level and existing column-level privileges from
PUBLIC, anon and authenticated, replaces permissive policies with owner checks,
and then grants only safe profile insert(id,username)/update(username), owner
reads, and quiz practice inserts excluding XP. Profile reward defaults are safe.
Reward accounts, verified/legacy task progress, sessions and achievement grants
are not browser-writable. New provisional practice is backend-writable only.
Known pet/Mentor ownership policies are retained for their separate user data.

These choices follow the official [column privilege guidance](https://supabase.com/docs/guides/database/postgres/column-level-security)
and [database-function authorization guidance](https://supabase.com/docs/guides/database/functions).
The Supabase changelog was reviewed; this work changes no SDK/model/framework
versions or hosting configuration.

## Verification evidence

Environment: macOS 26.6.1, Apple M1/arm64, Node 24.19.0, Python 3.14.3,
PostgreSQL 16.15, Playwright 1.62.1, real headless Chrome 155.0.8059.85.
All local app checks disable dotenv and use the secret-free Vite test envDir.
No credentials were read/copied and no live cloud writes were performed.

- **29 real PostgreSQL tests** pass. They initialize a fresh private local cluster,
  apply the explicit fixture, old RLS migration and new migration, then destroy
  it. No database URL is accepted; PG connection environment is stripped and no
  TCP listener is opened. Tests run as actual anon/authenticated/service roles.
- Real DB coverage includes fresh-key daily limits, 16 concurrent distinct saves,
  12 concurrent duplicate saves representing two tabs, lost-response replay,
  out-of-order arrival, payload mismatch, the 100-save limit and replay thereafter,
  rollback after an injected late profile-update failure, cross-owner isolation,
  old PUBLIC/column grant revocation, denied INSERT/UPDATE/DELETE, safe profile
  creation/editing, quiz zero rewards, achievement uniqueness, saturation,
  all level thresholds, UTC streak rules and preserved legacy snapshots.
- **API orchestration tests use mocked RPC/auth**, separately from SQL evidence.
  Billion/negative/extreme XP and forged completion/attempt/hint/owner claims get
  422 with no RPC. Algorithm/success annotations reach only the atomic RPC and
  cannot authorize achievement grants. Identical retries preserve the operation;
  conflict/limit/database errors map to 409/429/503 with no fallback writes.
- **116 frontend unit tests** pass, including receipt-driven XP, no client reward
  or unlock writes, zero eligible reward feedback, persistence failure isolation,
  stale classification/save/Mentor/profile responses, safe signup defaults and
  quiz practice without profile XP writes. Assertions tied to the old insecure
  bonus arithmetic were replaced with corresponding secure-boundary assertions;
  worker/playback/complexity failure coverage is retained.
- **Real browser:** all 50 named checks and all 15 frozen Pyodide trace fixtures
  pass on the optimized build, including all algorithms/highlights/playback,
  timeout/recovery, CDN failure/Retry, explicit complexity/cache/cancellation,
  navigation, task starter and authoritative XP notice. Session requests are
  asserted to have a UUID and no deprecated reward fields. Browser cloud responses
  are synthetic; SQL guarantees come from the separate real DB tests. Evidence:
  [reward-browser-results.json](reward-browser-results.json).
- `make check` passes **113 Python tests** (including the 29 real DB cases),
  **116 frontend tests**, six context tests, Ruff/ESLint, Python compilation and
  optimized Vite build. The nine existing hook warnings and classifier/Gemini
  compatibility warnings remain; no dependency upgrade was made.
- `make context-check`, `make context-strict`, `git diff --check`: pass.
- Actual local Uvicorn starts; browser CORS/classification and Mentor fallback
  pass with cloud integrations disabled. Removed execution routes remain absent.

CI now requires PostgreSQL 16 binaries and REWARD_DATABASE_REQUIRED=1, so missing
DB infrastructure fails rather than silently skipping security coverage. Local
machines without PostgreSQL explicitly mark DB checks NOT VERIFIED/skipped;
set REWARD_DATABASE_REQUIRED=1 for release validation. REWARD_POSTGRES_BIN selects
only a binary directory, never an external connection.

## Migration requirements and remaining release blockers

No staging/production migration was applied. Live Supabase auth, schema/grants,
PostgREST RPC exposure, triggers/views/existing privileged functions, role
inheritance and deployed flows remain **NOT VERIFIED**. The repository's partial
SQL cannot certify those facts. Before approved disposable staging acceptance:

- Review/export the canonical core schema, defaults/types/constraints and all
  write-capable views, triggers, RPCs and inherited grants. Eliminate alternate
  reward mutation paths. The fixture's UUID/jsonb/column assumptions must match.
- Review duplicate legacy achievement rows before the new unique index; the
  migration fails safely rather than deleting duplicates. Confirm how legacy
  snapshot/history and the new zero-start authoritative balance are presented.
- Approve the bounded participation policy and unavailable verified-solution
  benefits; coordinate migration, backend and frontend rollout. Old clients are
  intentionally rejected. Keep the old vulnerable save implementation out of the
  deployment and verify safe rollback/forward-fix operations.
- With separate approval, verify real auth, owner isolation, RPC permissions,
  concurrent/retried saves, history, provisional practice, profile state and UI
  labels against disposable staging accounts/data. Do not use production data.

The implementation is ready for that reviewed, explicitly authorized disposable
staging phase; it is not ready for an automatic production deployment. A trusted
completion verifier remains a separate future feature, not a fabricated guarantee.
