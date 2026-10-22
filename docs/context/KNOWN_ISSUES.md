# Known issues and context boundaries

## Missing canonical database baseline

The repository does not contain `CREATE TABLE` definitions for all core tables described by the application. Existing SQL includes incremental changes, RLS policies, and pet/quiz table creation. Do not fabricate columns or claim a clean database can be built solely from these files. Exporting and reviewing a canonical baseline is a separate database project.

## Deprecated Gemini SDK

The backend still uses `google-generativeai`. It is intentionally unchanged in this infrastructure task. Provider migration requires separate behavior and regression review.

## Classifier artifact/library version mismatch

`algo_classifier.pkl` was serialized with scikit-learn 1.6.1 while the runtime pins scikit-learn 1.9.0. The artifact currently loads and the regression test verifies a known classification, but scikit-learn warns that cross-version pickle compatibility is not guaranteed. Retraining or re-exporting the artifact with the runtime version is separate model-maintenance work.

## In-memory rate limits

Rate limiting is process-local. It is suitable for the current single-process deployment but will not coordinate across multiple workers or instances.

## Complexity estimation limitations

Complexity fitting rewrites the first list literal and measures trace steps on a fixed small size set. It is educational guidance, not a formal complexity proof.

## Browser execution boundary

The backend does not execute user Python code. The Pyodide worker keeps ordinary
execution off the UI thread and preserves safe builtins, step caps, and hard
worker termination/recovery. There is no browser memory quota; builtin filtering
is not proof against all Python escapes or worker JavaScript/network access.
Initial Pyodide loading requires jsDelivr access; offline/self-hosted assets are
not configured. Suspended-tab scheduling can delay timeout enforcement.

## Frontend concentration

`App.css`, locale data, and some page/hook modules are large. Avoid broad reads when a selector, translation key, or focused component search is sufficient.

The initial ESLint baseline also reports existing `react-hooks/exhaustive-deps` findings as warnings. Resolve them feature-by-feature with behavioral tests rather than applying blind dependency-array changes.

The current online `npm audit` reports four advisories across the Vite 5/esbuild development toolchain and React Router 6. Safe transitive fixes have been applied; the remaining automated fixes require Vite 8 and React Router 7. Those major migrations are intentionally deferred because they can change build and routing behavior and need dedicated compatibility passes.

## External/live facts

Deployment status, live Supabase schema, secrets, provider dashboards, and production data are not inferable from the repository. Use an authorized live connector or ask the system owner when those facts are required.

## Reward security rollout and solution verification

The reward-integrity branch replaces client-authorized rewards with transactional
`activity-v1` settlement and removes browser reward-column writes. The forward
migration has real disposable PostgreSQL coverage, but the missing live baseline
still requires schema/grant/trigger/view/RPC review and disposable staging
acceptance. Until that coordinated migration/backend/frontend rollout is approved
and verified, production remains blocked. Do not deploy the old save endpoint
alongside the new policy.

Browser execution cannot prove a task was solved. Solution bonuses, verified
completion/achievements and completion-gated unlocks remain unavailable pending a
trusted verifier. Practice annotations remain explicitly unverified. Legacy XP,
progress and achievement claims are preserved as history and are not imported
into authoritative reward accounts. See
[reward integrity](../verification/reward-integrity.md) for policy and evidence.
