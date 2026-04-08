# Deploy

## Findings Before Deploy

- Backend imports are flat (`from classifier import ...`), so the service must run with `backend/` as the working directory.
- Frontend uses React Router, so Vercel needs an SPA rewrite to `index.html`.
- `Algorithm Pet` and `Daily Quiz` require the SQL in `supabase/pet_quiz_schema.sql` to be executed before release.
- Gemini still uses the deprecated `google-generativeai` SDK. It works now, but should be migrated later.

## Supabase

Run this file in the Supabase SQL editor before deploying:

`supabase/pet_quiz_schema.sql`

## Demo Data

To seed a polished demo account plus synthetic users:

```bash
cd backend
source ../venv/bin/activate
python seed_demo_data.py
```

The script uses:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- optional `DEMO_EMAIL`
- optional `DEMO_PASSWORD`

If you want one-click demo login on the frontend, also set:

- `VITE_DEMO_EMAIL`
- `VITE_DEMO_PASSWORD`

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
source ../venv/bin/activate
pip install -r requirements.txt
python -m py_compile main.py tracer.py mentor.py sandbox.py classifier.py
uvicorn main:app --host 0.0.0.0 --port 8000
```
