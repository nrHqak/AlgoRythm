# Google OAuth verification

Date: 2026-11-16. Branch: `codex/google-oauth`. Base: main merge
`3a849df522bdde8b9aeb7c8b280e63b2b467d1f1`, containing reviewed release candidate
`a56f26a6e0509f2128e96b829b5a75531ff3220a`. PR #9 was already merged before this
work; this task did not merge it. Uncommitted work on the separate UI redesign
branch was left untouched in its original worktree.

## Change

Both auth modes offer Continue with Google using the existing ghost-button style
and English/Russian locale dictionary. `useAuth.signInWithGoogle` calls the same
Supabase client's `signInWithOAuth({ provider: "google", options: {
redirectTo: `${window.location.origin}/auth` } })`. There are no new dependencies,
environment variable names, backend changes or migrations.

Supabase's existing implicit callback/session lifecycle remains authoritative.
`initialize()` surfaces SDK callback failures, while `getSession()` restores the
session. Cancellation and provider errors display local messages without raw
provider details. Auth events supersede late initial reads; logout cannot be
reversed by a stale snapshot. AuthPage navigates to `/learn` only after the shared
session is ready; email confirmation pending leaves the form available.

The existing ProfileProvider creates the first OAuth profile using the Supabase
user ID and safe username fields. It preserves existing profiles and obtains XP
only from reward_accounts after profile persistence. The previous LearnPage
owner/profile guard for Pet and Quiz is unchanged. No OAuth-derived claim awards
XP, alters rewards or weakens protected routes/RLS. No provider tokens are copied
into application state beyond the existing Supabase session lifecycle.

## Evidence

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Staging identity | PASS | Supabase integration confirms `aexhskdofnpqqraapigk`, AlgoRythm-staging, ACTIVE_HEALTHY |
| Google provider enabled | PASS | Staging public Auth settings return google=true and email=true; no provider secret/configuration contents requested |
| Unit/integration regressions | PASS | Google request shape, both modes, callbacks, first profile/Pet/Quiz/reward-read ordering, session refresh, logout, failures and stale snapshots |
| New production build in Chrome 157.0.8103.78 | PASS with synthetic transport | Built files served through interception under both requested origins, using the real Supabase JS SDK and React Router; Auth/data responses are disposable fixtures, not hosted acceptance |
| Same-origin redirects | PASS with synthetic transport | Both buttons request staging `/auth/v1/authorize` with provider=google and the exact current-origin `/auth` redirect |
| Callback and profile ordering | PASS with synthetic transport | Real SDK callback handling reaches `/learn`; profile POST held open, no Pet insert/reward read before release, correct owner/username, zero initial authoritative XP |
| Refresh and logout | PASS with synthetic transport | Reload retains `/learn`; logout returns to `/auth`; zero browser page errors |
| `https://www.algorythm.online/auth` | NOT VERIFIED for new OAuth | Current public page HTTP 200, no Google button; data APIs blocked during inspection |
| `https://algorythm-seven.vercel.app/auth` | NOT VERIFIED for new OAuth | Current public page HTTP 200, no Google button; data APIs blocked during inspection |
| Live Google consent/new hosted OAuth identity | NOT VERIFIED | New code was not deployed; no real Google account, provider credential, existing user or production database accessed |

Local browser evidence is in `/tmp/algorythm-google-oauth-browser-results.json` and
screenshots named `/tmp/algorythm-google-oauth-auth-<hostname>.png`. These are local
ephemeral artifacts, not committed credentials or hosted acceptance evidence.
The browser fixtures made no hosted Auth/data writes. Read-only staging provider
settings are distinct from the intercepted browser transport.

`make check` passed with Node 24.22.1, Python 3.14.3 and disposable PostgreSQL 17.11:
Ruff, ESLint (nine existing hook dependency warnings), 153 Python tests passed,
one PostgreSQL-16-only guard skipped locally, 141 frontend tests across 19 files,
six context tests, Python compilation, production Vite build and current context
map. CI separately uses the repository's pinned Python 3.14.7/PostgreSQL 16 setup.
The new regression coverage adds 23 tests; the earlier first-login, reward and
execution tests remain passing. Production builds retain the existing Pyodide
browser-externalization warnings. Validation output is local at
`/tmp/algorythm-google-oauth-check.log`.

The initial full check found a previously incomplete local PostgreSQL 17 toolchain
(missing postgres.bki); rebuilding an isolated, checksum-verified PostgreSQL 17.11
test installation resolved the environment failure without repository or hosted
database changes.

## Remaining configuration and release checks

Follow [Google OAuth setup](../../DEPLOY.md#google-oauth). Google is enabled in
staging, but this task did not verify the Google Cloud audience, callback allowlist
or validity of its manually entered credentials. Verify them in the dashboards;
do not send secrets to chat. The staging Google callback URI is
`https://aexhskdofnpqqraapigk.supabase.co/auth/v1/callback`; frontend destinations
are exact `/auth` URLs in Supabase's redirect allowlist.

Obtain separate merge/deployment approval, then test a controlled Google account
on a deployment intentionally connected to staging. Exercise both Sign In and
Sign Up buttons, real consent, cancellation and denied consent; confirm same-origin
return to `/learn`, correct new profile ID, Pet/Quiz readiness, authoritative XP,
reload, logout/protected routes and an existing email/password account. If the two
public domains point at production, do not repoint or authenticate against it
under staging-only authorization. Complete those hosted checks only in an approved
environment. Do not mark live Google acceptance passed from synthetic fixtures.

`frontend/vercel.json` disables automatic deployment for this branch. The PR is a
review artifact and grants no permission to merge or deploy. No production
variables, schema, existing data or remote settings were changed. The earlier v1.0
staging acceptance report remains intact.
