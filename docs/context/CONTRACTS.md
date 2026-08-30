# Contracts

This document records integration boundaries, not every internal helper. Update it whenever a route, payload, ownership rule, or environment-variable name changes.

## HTTP API

| Method and path | Authentication | Request | Response responsibility |
| --- | --- | --- | --- |
| `GET /` | none | none | Health payload `{status: "ok"}` |
| `GET /curriculum` | none at FastAPI layer | none | `{tasks}` loaded with the service client |
| `POST /analyze` | none | `AnalyzeRequest` | Trace result plus algorithm type/confidence |
| `POST /complexity` | none | `ComplexityRequest` | Sample sizes/steps and best-fit complexity, or structured insufficient-data error |
| `POST /mentor` | none | `MentorRequest` | Mentor message or deterministic fallback |
| `POST /session/save` | Supabase bearer token | `SessionSaveRequest` | Session id and newly earned achievements |
| `POST /auth/demo-login` | none; IP-limited | none | Supabase access/refresh tokens when demo mode is enabled |

### Request models

- `AnalyzeRequest`: non-empty `code`, non-empty `array_var`.
- `ComplexityRequest`: non-empty `code`, non-empty `array_var`.
- `MentorRequest`: code/error/error line, compressed trace context, optional question/history, and a mode defaulting to `free_chat`.
- `SessionSaveRequest`: source, trace result, algorithm metadata, solve/task state, XP, attempts, and mentor-message count. The authenticated user id is never accepted from the body.

The generated repository map lists exact Pydantic field names. Source models remain the executable source of truth.

## Frontend integration boundaries

- `VITE_API_URL` is normalized before relative API paths are appended.
- `/session/save` receives `Authorization: Bearer <Supabase access token>`.
- Supabase browser operations use the anon key and rely on RLS. No service-role credential may appear in `frontend/`.
- API errors are represented separately from successful trace results so stale data is cleared after request failure.

## Supabase ownership

| Table | Browser access | Privileged/backend access |
| --- | --- | --- |
| `tasks`, `achievements` | authenticated select | catalog administration/seeding |
| `profiles` | owner select/insert/update | session reward updates |
| `task_progress` | owner select/insert/update | seed/admin workflows |
| `mentor_messages` | owner select/insert/update with session ownership check | seed/admin workflows |
| `pet_profiles`, `quiz_attempts` | owner select/insert/update | seed/admin workflows |
| `sessions`, `user_achievements` | owner select | service-role insert |

## Environment variables

Only names and responsibilities belong in documentation. Values live in ignored local files or deployment secrets.

### Backend

- `GEMINI_API_KEY`, optional `GEMINI_MODEL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `ALLOWED_ORIGINS`
- `DEMO_EMAIL`, `DEMO_PASSWORD`
- `SEED_USER_PASSWORD` for synthetic seed users
- provider-injected `PORT` at deployment

### Frontend

- `VITE_API_URL`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- optional `VITE_DEMO_EMAIL`

Use `backend/.env.example` and `frontend/.env.example` as templates. Never inspect or copy real `.env` values into issues, logs, tests, or generated context.
