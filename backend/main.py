import json
import os
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field
from postgrest.exceptions import APIError
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from supabase import Client, ClientOptions, create_client
from supabase_auth.errors import AuthApiError, AuthInvalidJwtError

from classifier import classify_algorithm
from mentor import generate_mentor_hint

load_dotenv()

# In-memory rate limiting is fine for a single process, but it will not enforce
# correct limits across multiple server instances/workers. Use Redis-backed
# storage before scaling horizontally.
limiter = Limiter(key_func=get_remote_address)
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://algorythm-seven.vercel.app",
]
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if origin.strip()
]

app = FastAPI(title="AlgoRythm API")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    retry_after_seconds = 60
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please retry after 60 seconds.",
            "retry_after_seconds": retry_after_seconds,
        },
        headers={"Retry-After": str(retry_after_seconds)},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

DEMO_EMAIL = os.environ.get("DEMO_EMAIL")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD")

# In-memory rate limiting
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 10
demo_login_attempts = {}


class ClassifyRequest(BaseModel):
    code: str = Field(..., min_length=1)


class MentorRequest(BaseModel):
    code: str = ""
    error: str | None = None
    error_line: int | None = None
    trace_context: str = ""
    user_question: str | None = None
    mode: str = Field(default="free_chat")
    user_history: str | None = None


class SessionSaveRequest(BaseModel):
    # Deprecated reward/completion fields are rejected, including extra user ids.
    model_config = ConfigDict(extra="forbid")
    idempotency_key: UUID
    code: str = Field(max_length=200000)
    array_var: str = Field(default="arr", min_length=1, max_length=128)
    trace: list[dict[str, Any]] = Field(default_factory=list, max_length=300)
    error: dict[str, Any] | None = None
    total_steps: int = Field(default=0, ge=0, le=300)
    algorithm_type: str = Field(default="custom", max_length=128)
    execution_succeeded: bool = False  # Unverified history/practice annotation only.
    task_id: UUID | None = None


def require_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase service configuration is missing.")
    return supabase


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header.")

    return credentials.strip()


def verify_authenticated_user_id(authorization: str | None = Header(default=None)) -> str:
    """Validate the Supabase access token and return the authenticated user's id."""
    access_token = _parse_bearer_token(authorization)
    client = require_supabase()

    try:
        response = client.auth.get_user(jwt=access_token)
    except (AuthApiError, AuthInvalidJwtError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc

    if not response or not response.user or not response.user.id:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")

    return str(response.user.id)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/curriculum")
def curriculum():
    client = require_supabase()
    tasks = client.table("tasks").select("*").order("order_index").execute().data or []
    return {"tasks": tasks}


@app.post("/classify")
@limiter.limit("20/minute")
def classify(request: Request, payload: ClassifyRequest):
    classification = classify_algorithm(payload.code)
    return {
        "algorithm_type": classification.get("algorithm", "unknown"),
        "algorithm_confidence": classification.get("confidence", 0.0),
    }


@app.post("/mentor")
@limiter.limit("20/minute")
def mentor(request: Request, payload: MentorRequest):
    return generate_mentor_hint(
        code=payload.code,
        error=payload.error,
        error_line=payload.error_line,
        trace_context=payload.trace_context,
        user_question=payload.user_question,
        mode=payload.mode,
        user_history=payload.user_history,
    )


@app.post("/session/save")
def save_session(request: SessionSaveRequest, user_id: str = Depends(verify_authenticated_user_id)):
    # One RPC is the transaction boundary. Never fall back to separate writes.
    payload = request.model_dump(mode="json", exclude={"idempotency_key"})
    if len(json.dumps(payload).encode("utf-8")) > 2_000_000:
        raise HTTPException(status_code=413, detail="Session payload is too large.")
    try:
        result = require_supabase().rpc("settle_activity_session", {
            "p_user_id": user_id,
            "p_operation_id": str(request.idempotency_key),
            "p_payload": payload,
        }).execute().data
    except APIError as exc:
        message = str(exc)
        if "idempotency_conflict" in message:
            raise HTTPException(status_code=409, detail="Idempotency key already used with different session data.") from exc
        if "activity_daily_limit" in message:
            raise HTTPException(status_code=429, detail="Daily session save limit reached.") from exc
        raise HTTPException(status_code=503, detail="Session transaction unavailable. Retry with the same idempotency key.") from exc
    return result


@app.post("/auth/demo-login")
async def demo_login(request: Request):
    if not DEMO_EMAIL or not DEMO_PASSWORD:
        raise HTTPException(status_code=404, detail="Demo mode is disabled.")

    require_supabase()

    # Rate limiting logic
    ip_address = request.client.host
    current_time = datetime.now()

    if ip_address not in demo_login_attempts:
        demo_login_attempts[ip_address] = []

    # Remove old attempts
    demo_login_attempts[ip_address] = [
        t for t in demo_login_attempts[ip_address] if current_time - t < timedelta(seconds=RATE_LIMIT_WINDOW)
    ]

    if len(demo_login_attempts[ip_address]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

    demo_login_attempts[ip_address].append(current_time)

    try:
        # Sign-in mutates a Supabase client's Authorization header. Never run it
        # on the shared service principal used for verified settlement RPCs.
        with create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY,
                           options=ClientOptions(auto_refresh_token=False, persist_session=False)).auth as auth_client:
            response = auth_client.sign_in_with_password({"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
        }
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=f"Demo login failed: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
