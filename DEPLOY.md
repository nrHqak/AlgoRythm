# Deploy

Release requires staging acceptance and separate approval to merge and deploy.
Follow the [schema preflight and rollout plan](docs/verification/supabase-schema-preflight.md)
before executing any deployment steps below. Coordinate the reward migration,
backend and frontend because older clients send fields the new API rejects.

## Findings Before Deploy

- Backend imports are flat (`from classifier import ...`), so the service must run with `backend/` as the working directory.
- Frontend uses React Router, so Vercel needs an SPA rewrite to `index.html`.
- Gemini still uses the deprecated `google-generativeai` SDK. It works now, but should be migrated later.

## Supabase

For empty staging, use the [staging bootstrap runbook](docs/verification/staging-bootstrap.md).
The recovered baseline already includes Algorithm Pet and Daily Quiz. Do not
apply `supabase/pet_quiz_schema.sql` or the recovered baseline on its own. The
local bootstrap files are intentionally disabled for hosted execution; a reviewed
hosted bundle and separate approval are required before staging writes.

Existing production needs its own approved rollout against the actual schema and
migration history. Do not replay the recovered baseline against production.

### Google OAuth

Configure the provider manually in the intended Supabase project. Staging is
`aexhskdofnpqqraapigk`; never reuse this setup as permission to change production.

1. Create a Google OAuth **Web application** client with the required `openid`,
   email and profile scopes. When the consent app is in Testing, authorize only
   controlled test accounts in its audience.
2. The Google **Authorized redirect URI** for this staging project is exactly
   `https://aexhskdofnpqqraapigk.supabase.co/auth/v1/callback`. This differs from
   the application's `/auth` route. Add each approved frontend origin to Google's
   Authorized JavaScript origins (origin only, no path).
3. Enter the Google Client ID and Client Secret directly into Supabase's Google
   provider settings and enable it. Never put the secret in a `VITE_*` variable,
   source file, chat or committed configuration. No additional frontend variable
   or Google SDK is required.
4. Supabase Auth's Redirect URLs must include each exact approved callback:
   `https://www.algorythm.online/auth`,
   `https://algorythm-seven.vercel.app/auth`, and the local `/auth` URL used for
   staging tests, if those origins are intentionally configured for this project.
   Set Site URL deliberately; do not rely on a fallback or broad wildcard. Each
   deployed frontend must point at its intended Supabase project. Do not repoint
   production domains or change production variables as part of this work.
5. After separate approval for a staging deployment, verify real Google consent,
   cancellation, `/auth` callback to `/learn`, a new profile with the authenticated
   user ID, Pet/Quiz initialization, refresh and logout on both approved origins.
   Keep email/password checks. Existing Supabase identity linking rules apply;
   do not create duplicate profiles or manually migrate users.

The `codex/google-oauth` branch disables automatic Vercel deployments in
`frontend/vercel.json`. Pushing its review PR does not authorize deployment.
The effective hosting configuration must retain the deployment hold, and merges
or changes to the deployment environment require separate approval. Google OAuth
needs no schema migration, backend change or reward-system rollout.

See the [OAuth verification report](docs/verification/google-oauth.md) for the
tested scope and remaining hosted checks, and the official
[Supabase Google guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Demo Data

For an explicitly authorized disposable environment only, to seed a demo
account plus synthetic users:

```bash
cd backend
source ../.venv/bin/activate
python seed_demo_data.py
```

The script uses:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- optional `DEMO_EMAIL`
- optional `DEMO_PASSWORD`

If you want one-click demo login on the frontend, also set:

- `VITE_DEMO_EMAIL`

## Backend on Render

This repo includes `render.yaml`, so you can deploy with a Render Blueprint or create a Web Service manually.

### Blueprint

1. Push the repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select this repo.
4. Render will detect `render.yaml`.
5. Add environment variables:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
- `ALLOWED_ORIGINS` for the exact frontend origin(s)

### Manual Web Service

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Frontend on Vercel

Deploy the `frontend/` app.

### Recommended

1. Import the GitHub repo into Vercel.
2. Set the Root Directory to `frontend`.
3. Framework Preset: `Vite`.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variables:
   - `VITE_API_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

The file `frontend/vercel.json` already adds the SPA rewrite required for React Router.

Python execution and complexity run only in the browser worker. Keep `VITE_API_URL` for classification, mentor, and authenticated session saving. Pyodide assets load from the version-pinned jsDelivr URL; deployment CSP/network policy must permit that loader and its assets. Smoke-test Python readiness, Retry after initialization failure, tracing, explicit complexity/cache reuse, classification, mentor, and session saving. The backend has no execution routes.

Demo seeding reads saved example traces from `backend/demo_traces.json`; it never executes the stored source.

## Local Pre-Deploy Checks

### Frontend

```bash
cd frontend
npm install
npm run build
```

### Backend

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
python -m py_compile main.py mentor.py classifier.py
uvicorn main:app --host 0.0.0.0 --port 8000
```
