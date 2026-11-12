# AlgoRythm staging integration acceptance

Verified on 2026-11-12 in Asia/Atyrau against AlgoRythm-staging
(`aexhskdofnpqqraapigk`, ACTIVE_HEALTHY, PostgreSQL 17.11.0.003). Reward tests
used the database's 2026-11-11 UTC day.

**Staging functional acceptance passed.** The four remaining Auth checks passed
on 2026-11-12 after the operator configured custom SMTP and authorized the inbox
associated with the Resend account. The earlier PASS results are retained.
PR #9 is ready for final review and merge approval. Production rollout remains
separately gated.

The initial signup attempts returned HTTP 429 with
`over_email_send_rate_limit`. The first custom SMTP attempt returned Resend
SMTP 550 because its test sender restricted delivery to a different account
email. Using the operator-authorized matching inbox resolved delivery.

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
| 1. Signup, login, logout and session persistence | PASS | Public signup returned 200 and sent confirmation without issuing a session. The operator confirmed the received email, and Auth recorded email_confirmed_at. Browser login with the original signup password returned 200 and the actual Profile UI displayed the new owner profile. Earlier logout, local storage clearing, protected-route redirects, reload persistence and token rotation PASS results are retained. |
| 2. Profile initialization and updates | PASS | The application created each owner's profile. A safe username update through the existing owner REST contract persisted and appeared in the actual Profile UI after refresh. Reward columns rejected browser updates. No profile-editing feature was added. |
| 3. Playground execution | PASS | Bubble, selection and insertion sort, binary search and linear search matched every field of their frozen Trace Protocol v1 fixtures in real optimized workers. Step counts were 38, 47, 40, 15 and 13. Next/Prev playback rendered the expected steps. |
| 4. Session saving and history | PASS | Actual browser POST /session/save returned 200 and hosted owner reads returned the same source, session ID, trace count and activity policy. The Profile UI rendered nine history cards at its checkpoint and expanded stored source. Later saves also succeeded. |
| 5. Server-authoritative XP | PASS | The first save awarded 5 XP. Later saves awarded zero and the displayed/refreshed balance stayed 5. Four concurrent fresh saves for the second fixture awarded [0, 5, 0, 0]. Before cleanup, private receipt aggregates independently showed 5 awarded XP for each account on one UTC day. |
| 6. Idempotency, duplicate rewards and RLS | PASS | An identical retry returned the original session with replayed=true and preserved the accepted-save count. Changed content under that key returned 409. Five concurrent identical retries produced one session and one counted save. Cross-user reads returned zero rows despite positive owner reads in all six active feature tables. Direct privileged writes/RPC calls were denied. |
| 7. Task catalogue and provisional progress | PASS | One disposable catalogue task appeared through the actual /curriculum endpoint. Start opened its real starter code. Saving created owner practice_progress with reported_completed=true, one accepted attempt and 38 best steps. The Learn UI displayed provisional completion. completion_verified remained false and no achievement was issued. |
| 8. Daily Quiz and Algorithm Pet | PASS | The real UI saved three quiz attempts with zero XP, updated cosmetic pet growth, fed the pet once and disabled feeding afterward. Completion and cooldown persisted through refresh. The first login initialization defect described below was fixed and retested with a held real profile request. |
| 9. Classification and Mentor fallback | PASS | Actual classification returned bubble_sort with confidence 1.0. A real IndexError triggered the backend fallback, displayed it in the Playground, and stored an owner Mentor message linked to the matching hosted session. Live Gemini generation was not tested. |
| 10. Refresh, navigation and error recovery | PASS | Authenticated navigation and reload preserved identity, profile XP, quiz, pet state and history. A real infinite loop hit the worker deadline, saved its timeout annotation, and a subsequent valid Run succeeded. Deliberately blocking CDN requests disabled Run and exposed Retry. Restoring requests recovered real Python and a hosted save returned 200. |

The core run used two confirmed synthetic Auth accounts and one synthetic task.
The second fixture's application rows were removed and recreated to repeat a
first login with a new profile after the fix. Its earlier concurrency evidence was captured
before that administrative fixture cleanup. Account data was never taken from
existing users.

**Remaining Auth checks, 2026-11-12.** Only public signup, email confirmation,
login after confirmation and profile initialization were repeated. Application
source remained at `484a7ca0bf2925a4b38e84a3ab43f1967d985bee`.

| Final check | Status | Evidence |
| --- | --- | --- |
| Public signup | PASS | Actual UI POST /auth/v1/signup returned 200. confirmation_sent_at was present and no session was issued before confirmation. |
| Email confirmation | PASS | The operator confirmed delivery and clicked the email button. Auth recorded confirmation at 2026-11-12T17:52:09.875986Z. No administrative confirmation was performed. |
| Login after confirmation | PASS | Actual UI password login returned 200 for the new signup identity and opened /learn. The original signup password was used. |
| Profile initialization | PASS | The application created the correct owner's profile and rendered its username on /profile, with 0 XP, level 1 and streak 0. No administrative profile insertion was used. |

The final disposable identity was
`73280134-2629-4ffb-b770-8a8e46167c79`. Cleanup removed its profile and automatic
Pet record, then the Auth account. Auth lookup returned 404, and bounded counts
for that ID across Auth and all application tables returned zero. No test
Auth account or application row was retained. Managed Auth/SMTP logs and the
operator's mailbox are outside application-data cleanup. The local browser and services were
stopped, and temporary in-memory credentials were cleared. Sanitized final
receipts remain under /tmp/algorythm-smtp-acceptance-final for the operator.

The selected Resend test sender delivers only to the Resend account's email.
This verifies the approved controlled-inbox staging flow. Delivery to arbitrary
recipients requires a verified sender domain or an appropriately configured
production mail service before public deployment.
[Resend test-sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

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

No remaining P0/P1 application defect was confirmed in the tested flows. The
first login P1 is fixed and the final signup blocker is resolved for the
authorized staging inbox. Deployed Vercel/Render behavior, production database
compatibility and production SMTP remain outside this acceptance scope.

**Manual merge procedure.** Separate final approval is required by DEPLOY.md
and the operator's release instructions. These steps have been prepared only.

1. Review the latest PR #9 diff and this report. Pin its full head SHA and verify
   all three GitHub CI checks pass on that exact SHA.
2. Have the hosting operator confirm production automatic deployments are held
   before merging when deployment is deferred. The current Vercel file disables
   Git deployment only for the candidate/bootstrap branches. Unspecified branches
   such as main default to enabled. For Render, set the linked service's
   Auto-Deploy behavior to Off. Any repository change used to establish a hold
   requires a new reviewed head and fresh CI.
3. Mark PR #9 ready for review after those gates. Confirm its base is main, its
   head is codex/algorythm-v1.0-rc and it remains mergeable. Obtain required
   reviewer approvals and explicit final approval to merge. Resolve any new
   base conflict through the candidate branch and revalidate the resulting head.
4. Perform the approved manual merge with a merge commit to preserve candidate
   history, using the exact reviewed head SHA in the command below.
5. Verify the merged PR and main commit. Leave production migration, coordinated
   frontend/backend rollout and production smoke testing under their separate
   deployment approval in DEPLOY.md.

```sh
gh pr view 9 --repo nrHqak/AlgoRythm --json headRefOid,headRefName,baseRefName,isDraft,mergeable
gh pr checks 9 --repo nrHqak/AlgoRythm
# The operator opens final review after the deployment hold is confirmed
gh pr ready 9 --repo nrHqak/AlgoRythm
# Execute only after final merge approval, using the reviewed head SHA
gh pr merge 9 --repo nrHqak/AlgoRythm --merge --match-head-commit APPROVED_HEAD_SHA
gh pr view 9 --repo nrHqak/AlgoRythm --json state,mergeCommit
```

Automatic deployment behavior is documented by
[Vercel](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
and [Render](https://render.com/docs/deploys#configuring-auto-deploys).
Production configuration was not inspected or modified. PR #9 remains draft
pending the operator's final approval. No merge or deployment was executed.
