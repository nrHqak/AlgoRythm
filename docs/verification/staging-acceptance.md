# AlgoRythm staging integration acceptance

Verified on 2026-11-12 in Asia/Atyrau against AlgoRythm-staging
(`aexhskdofnpqqraapigk`, ACTIVE_HEALTHY, PostgreSQL 17.11.0.003). Reward tests
used the database's 2026-11-11 UTC day.

**PR #9 remains blocked by public signup/email confirmation.** Supabase returned
HTTP 429 with `over_email_send_rate_limit` on both attempts using the approved
controlled inbox. Neither attempt created an account or sent a confirmation
email. Confirmation delivery and completion remain NOT VERIFIED.

The optimized local frontend and actual local FastAPI service connected to
hosted staging Auth, PostgREST and PostgreSQL. Chrome 157.0.8103.39 ran real
BrowserEngine/Pyodide workers. Successful Auth and persistence responses were
live. Vercel/Render deployments and their environment-specific behavior were
outside this run.

Testing started from release commit
`e1a8afd5dcbe60094728bab2decb70c0c380e889`. The accompanying LearnPage fix was
rebuilt and verified against the same hosted staging project. Its optimized
staging build was byte-identical under Node 24.22.1 and the initial Node 25 build.
The initialization manifest remained
`54855fac71a2e6a38855d4d1c845c209aebd29c323e2055d75004a422a42859b`.

| Requested user flow | Status | Actual evidence |
| --- | --- | --- |
| 1. Signup, login, logout and session persistence | FAIL | Public signup returned 429/email-send quota twice. With two administratively confirmed synthetic fixtures, browser login returned 200, logout returned 204, local session storage cleared, protected routes redirected, reload restored the authenticated workspace, and a real Auth token refresh rotated the token. Email confirmation remains NOT VERIFIED. |
| 2. Profile initialization and updates | PASS | The application created each owner's profile. A safe username update through the existing owner REST contract persisted and appeared in the actual Profile UI after refresh. Reward columns rejected browser updates. No profile-editing feature was added. |
| 3. Playground execution | PASS | Bubble, selection and insertion sort, binary search and linear search matched every field of their frozen Trace Protocol v1 fixtures in real optimized workers. Step counts were 38, 47, 40, 15 and 13. Next/Prev playback rendered the expected steps. |
| 4. Session saving and history | PASS | Actual browser POST /session/save returned 200 and hosted owner reads returned the same source, session ID, trace count and activity policy. The Profile UI rendered nine history cards at its checkpoint and expanded stored source. Later saves also succeeded. |
| 5. Server-authoritative XP | PASS | The first save awarded 5 XP. Later saves awarded zero and the displayed/refreshed balance stayed 5. Four concurrent fresh saves for the second fixture awarded [0, 5, 0, 0]. Before cleanup, private receipt aggregates independently showed 5 awarded XP for each account on one UTC day. |
| 6. Idempotency, duplicate rewards and RLS | PASS | An identical retry returned the original session with replayed=true and preserved the accepted-save count. Changed content under that key returned 409. Five concurrent identical retries produced one session and one counted save. Cross-user reads returned zero rows despite positive owner reads in all six active feature tables. Direct privileged writes/RPC calls were denied. |
| 7. Task catalogue and provisional progress | PASS | One disposable catalogue task appeared through the actual /curriculum endpoint. Start opened its real starter code. Saving created owner practice_progress with reported_completed=true, one accepted attempt and 38 best steps. The Learn UI displayed provisional completion. completion_verified remained false and no achievement was issued. |
| 8. Daily Quiz and Algorithm Pet | PASS | The real UI saved three quiz attempts with zero XP, updated cosmetic pet growth, fed the pet once and disabled feeding afterward. Completion and cooldown persisted through refresh. The first login initialization defect described below was fixed and retested with a held real profile request. |
| 9. Classification and Mentor fallback | PASS | Actual classification returned bubble_sort with confidence 1.0. A real IndexError triggered the backend fallback, displayed it in the Playground, and stored an owner Mentor message linked to the matching hosted session. Live Gemini generation was not tested. |
| 10. Refresh, navigation and error recovery | PASS | Authenticated navigation and reload preserved identity, profile XP, quiz, pet state and history. A real infinite loop hit the worker deadline, saved its timeout annotation, and a subsequent valid Run succeeded. Deliberately blocking CDN requests disabled Run and exposed Retry. Restoring requests recovered real Python and a hosted save returned 200. |

Two confirmed synthetic Auth accounts and one synthetic task were sufficient.
The second fixture's application rows were removed and recreated to repeat a
first login with a new profile after the fix. Its earlier concurrency evidence was captured
before that administrative fixture cleanup. Account data was never taken from
existing users.

**Confirmed P1 application defect, fixed.** On the original
candidate, Pet initialization raced ProfileProvider's profile insertion. The
second new account displayed a pet_profiles_user_id_fkey violation and had no
pet row even after its profile existed. LearnPage now supplies the current
owner to Pet and Quiz only after that owner's saved profile is available.

The new regression covers both a pending profile and a stale previous-owner
profile. It failed against the original source and passed after the fix. The
hosted retest held the real profile POST open. No Pet or Quiz insert occurred
while it was held. After release, the observed order was profile commit then
Pet POST 201. A Quiz POST then returned 201 without a foreign-key error.

**Security evidence.** Direct profile-XP updates, reward-account writes, session
inserts, browser settlement RPCs, quiz-XP claims and catalogue writes each
returned HTTP 403/42501. The private reward schema returned 406/PGRST106.
Forged backend reward/owner fields returned 422; missing and invalid bearer
tokens returned 401. Cross-owner Mentor session attachment returned 403.
Anonymous catalogue REST access returned 401. Positive owner reads and empty
other-owner reads covered sessions, reward_accounts, practice_progress,
quiz_attempts, pet_profiles and mentor_messages. Cross-owner profile reads and
updates returned zero rows and preserved the other owner's username.

**Validation.** The two new regression cases passed. Full make check passed
under Node 24.22.1 with 153 Python tests passed, one local PostgreSQL 16
case skipped, 118 frontend tests passed across 17 files, and six context tests
passed. Native PostgreSQL 17 and Supabase CLI 3.0.0 were required for local
bootstrap coverage. The separate CI PostgreSQL 16 run covers the incompatible
major guard. The first validation attempt used unsupported Node 25.8.2 and hit
Web Storage failures in existing tests. Rerunning with the repository's required
Node 24 resolved those failures without changing application or test storage.

Dotenv loading was disabled. Vite used its existing test envDir with explicitly
supplied staging public configuration. The backend key stayed in the backend
and test-driver processes. A byte scan confirmed it was absent from every
frontend asset. The generated repository map was refreshed with make context.

**Observed limitation.** Deliberately blocking the Pyodide CDN produced three
pageerror messages reading Failed to fetch. Retry recovered successfully and
the next hosted save passed. Ordinary tested flows had no uncaught page errors.
This fault-injection observation is retained; no unrelated runtime changes were
made.

**Cleanup and schema integrity.** Both Auth fixtures returned 404 after deletion.
The task seed and all owned application rows, including private receipts, were
removed. Bounded counts for all owned IDs and planned test addresses returned
zero. No synthetic accounts or database records were retained. The immutable
released-state verifier passed again after cleanup, confirming the original
schema, all 13 RLS-enabled tables, 18 policies, privileges, RPC definition,
platform fingerprints and the same three migration versions. No schema or
Supabase setting was changed during acceptance.

Local sanitized receipts, build hashes and a Playground screenshot are retained
for the operator under /tmp/algorythm-staging-acceptance. They contain no backend
key, passwords, session tokens or confirmation links. The supplied credential
files remain outside the repository. Test browsers and local servers were
stopped.

No P0 application defect was confirmed. The first login P1 is fixed. The
remaining release acceptance blocker is a successful public signup followed
by the operator's email confirmation and a normal browser login. PR #9 must
remain draft until that flow passes and final release approval is granted.
Production, merge and deployment were outside the authorized execution.
