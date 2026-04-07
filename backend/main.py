import os
import re
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from supabase import Client, create_client

from classifier import classify_algorithm
from mentor import generate_mentor_hint
from sandbox import execute_code
from tracer import trace_code

load_dotenv()

app = FastAPI(title="AlgoRythm API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class AnalyzeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    array_var: str = Field(..., min_length=1)


class MentorRequest(BaseModel):
    code: str = ""
    error: str | None = None
    error_line: int | None = None
    trace_context: str = ""
    user_question: str | None = None
    mode: str = Field(default="free_chat")
    user_history: str | None = None


class SessionSaveRequest(BaseModel):
    user_id: str
    code: str
    array_var: str = "arr"
    trace: list[dict[str, Any]] = Field(default_factory=list)
    error: dict[str, Any] | None = None
    total_steps: int = 0
    algorithm_type: str = "custom"
    solved: bool = False
    xp_earned: int = 0
    task_id: str | None = None
    task_completed: bool = False
    task_attempts: int = 1
    mentor_messages_count: int = 0


class ComplexityRequest(BaseModel):
    code: str = Field(..., min_length=1)
    array_var: str = Field(..., min_length=1)


LEVELS = [
    {"level": 1, "min_xp": 0, "max_xp": 199},
    {"level": 2, "min_xp": 200, "max_xp": 499},
    {"level": 3, "min_xp": 500, "max_xp": 999},
    {"level": 4, "min_xp": 1000, "max_xp": 1999},
    {"level": 5, "min_xp": 2000, "max_xp": float("inf")},
]

COMPLEXITY_SIZES = [5, 10, 20, 40, 80]
COMPLEXITY_MAX_STEPS = 25000
COMPLEXITY_PROFILES = [
    {"kind": "power", "exponent": 0.5, "complexity": "O(√n)", "label": "Sublinear — work grows very gently."},
    {"kind": "log", "complexity": "O(log n)", "label": "Logarithmic — doubling input adds only a little extra work."},
    {"kind": "power", "exponent": 1.0, "complexity": "O(n)", "label": "Linear — work grows proportionally with input size."},
    {
        "kind": "nlogn",
        "complexity": "O(n log n)",
        "label": "Near-optimal for sorting — a strong result for comparison-based algorithms.",
    },
    {"kind": "power", "exponent": 2.0, "complexity": "O(n²)", "label": "Quadratic — typical for nested loops."},
    {"kind": "power", "exponent": 3.0, "complexity": "O(n³)", "label": "Cubic — very expensive on larger inputs."},
]


def require_supabase() -> Client:
    if supabase is None:
        raise RuntimeError("Supabase service configuration is missing.")
    return supabase


def calculate_level(xp: int) -> int:
    for entry in LEVELS:
        if entry["min_xp"] <= xp <= entry["max_xp"]:
            return entry["level"]
    return LEVELS[-1]["level"]


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None


def compute_streak(last_active_date: str | None, previous_streak: int) -> tuple[int, str]:
    today = date.today()
    previous = parse_iso_date(last_active_date)

    if previous == today:
        return previous_streak, today.isoformat()
    if previous == today - timedelta(days=1):
        return previous_streak + 1, today.isoformat()
    return 1, today.isoformat()


def load_user_data(client: Client, user_id: str) -> dict[str, Any]:
    profile = client.table("profiles").select("*").eq("id", user_id).single().execute().data
    sessions = client.table("sessions").select("*").eq("user_id", user_id).execute().data or []
    task_progress = client.table("task_progress").select("*").eq("user_id", user_id).execute().data or []
    achievements = client.table("achievements").select("*").execute().data or []
    user_achievements = (
        client.table("user_achievements").select("*").eq("user_id", user_id).execute().data or []
    )
    return {
        "profile": profile,
        "sessions": sessions,
        "task_progress": task_progress,
        "achievements": achievements,
        "user_achievements": user_achievements,
    }


def evaluate_achievements(
    request: SessionSaveRequest,
    user_sessions: list[dict[str, Any]],
    task_progress: list[dict[str, Any]],
    current_streak: int,
) -> set[str]:
    completed_tasks = [row for row in task_progress if row.get("status") == "completed"]
    error_sessions = [session for session in user_sessions if session.get("error")]
    slugs: set[str] = set()

    if len(user_sessions) == 1:
        slugs.add("first_run")
    if request.error and len(error_sessions) == 1:
        slugs.add("first_error")
    if request.task_completed and request.mentor_messages_count == 0:
        slugs.add("no_hints")
    if current_streak >= 3:
        slugs.add("streak_3")
    if current_streak >= 7:
        slugs.add("streak_7")
    if len(completed_tasks) >= 5:
        slugs.add("complete_5")
    if request.task_completed and request.task_attempts <= 3:
        slugs.add("fast_solve")
    if request.algorithm_type == "bubble_sort" and request.error is None:
        slugs.add("clean_sort")

    return slugs


def _replace_first_list_literal(code: str, generated_array: list[int]) -> str:
    replacement = str(generated_array)
    pattern = re.compile(r"(\b\w+\b)\s*=\s*\[[^\]]*\]", re.MULTILINE)
    return pattern.sub(lambda match: f"{match.group(1)} = {replacement}", code, count=1)


def _complexity_feature(sizes: np.ndarray, profile: dict[str, Any]) -> np.ndarray:
    if profile["kind"] == "power":
        return np.power(sizes, profile["exponent"])
    if profile["kind"] == "log":
        return np.log(np.maximum(sizes, 2))
    if profile["kind"] == "nlogn":
        return sizes * np.log(np.maximum(sizes, 2))
    raise ValueError("Unknown complexity profile.")


def _fit_profile(sizes: list[int], steps: list[int], profile: dict[str, Any]) -> dict[str, Any]:
    sizes_array = np.array(sizes, dtype=float)
    steps_array = np.array(steps, dtype=float)
    feature = _complexity_feature(sizes_array, profile)
    denominator = float(np.dot(feature, feature))
    scale = float(np.dot(feature, steps_array) / denominator) if denominator else 0.0
    predicted = scale * feature
    residual = steps_array - predicted
    sse = float(np.sum(np.square(residual)))
    mean_steps = float(np.mean(steps_array))
    sst = float(np.sum(np.square(steps_array - mean_steps)))
    r_squared = 1.0 if sst == 0 else max(0.0, min(1.0, 1 - (sse / sst)))

    return {
        "complexity": profile["complexity"],
        "label": profile["label"],
        "confidence": round(r_squared, 3),
        "sse": sse,
    }


def analyze_complexity_curve(code: str, array_var: str) -> dict[str, Any]:
    successful_sizes: list[int] = []
    successful_steps: list[int] = []
    all_steps: list[int] = []

    for size in COMPLEXITY_SIZES:
        generated_array = list(range(size, 0, -1))
        modified_code = _replace_first_list_literal(code, generated_array)

        try:
            result = trace_code(modified_code, array_var, max_steps=COMPLEXITY_MAX_STEPS)
        except Exception:
            all_steps.append(0)
            continue

        if result.get("error"):
            all_steps.append(0)
            continue

        step_count = int(result.get("total_steps", 0) or 0)
        all_steps.append(step_count)

        if step_count > 0:
            successful_sizes.append(size)
            successful_steps.append(step_count)

    if len(successful_sizes) < 3:
        return {
            "error": "not enough data",
            "sizes": COMPLEXITY_SIZES,
            "steps": all_steps,
        }

    fits = [_fit_profile(successful_sizes, successful_steps, profile) for profile in COMPLEXITY_PROFILES]
    best_fit = min(fits, key=lambda item: item["sse"])

    return {
        "sizes": COMPLEXITY_SIZES,
        "steps": all_steps,
        "complexity": best_fit["complexity"],
        "label": best_fit["label"],
        "confidence": best_fit["confidence"],
    }


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/curriculum")
def curriculum():
    client = require_supabase()
    tasks = client.table("tasks").select("*").order("order_index").execute().data or []
    return {"tasks": tasks}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    result = execute_code(request.code, request.array_var)
    classification = classify_algorithm(request.code)
    result["algorithm_type"] = classification.get("algorithm", "unknown")
    result["algorithm_confidence"] = classification.get("confidence", 0.0)
    return result


@app.post("/complexity")
def complexity(request: ComplexityRequest):
    return analyze_complexity_curve(request.code, request.array_var)


@app.post("/mentor")
def mentor(request: MentorRequest):
    return generate_mentor_hint(
        code=request.code,
        error=request.error,
        error_line=request.error_line,
        trace_context=request.trace_context,
        user_question=request.user_question,
        mode=request.mode,
        user_history=request.user_history,
    )


@app.post("/session/save")
def save_session(request: SessionSaveRequest):
    client = require_supabase()

    session_payload = {
        "user_id": request.user_id,
        "code": request.code,
        "array_var": request.array_var,
        "trace": request.trace,
        "error": request.error,
        "total_steps": request.total_steps,
        "algorithm_type": request.algorithm_type,
        "solved": request.solved,
        "attempts": request.task_attempts,
        "xp_earned": request.xp_earned,
    }

    created_session = client.table("sessions").insert(session_payload).execute().data[0]
    user_data = load_user_data(client, request.user_id)
    profile = user_data["profile"]
    previous_streak = profile.get("streak", 0) or 0
    current_streak, active_date = compute_streak(profile.get("last_active_date"), previous_streak)

    achievements_by_slug = {item["slug"]: item for item in user_data["achievements"]}
    eligible_slugs = evaluate_achievements(
        request=request,
        user_sessions=user_data["sessions"],
        task_progress=user_data["task_progress"],
        current_streak=current_streak,
    )

    achievements_earned = []
    achievement_xp = 0
    earned_ids = {item["achievement_id"] for item in user_data["user_achievements"]}

    for slug in sorted(eligible_slugs):
        achievement = achievements_by_slug.get(slug)
        if not achievement or achievement["id"] in earned_ids:
            continue

        client.table("user_achievements").insert(
            {
                "user_id": request.user_id,
                "achievement_id": achievement["id"],
            }
        ).execute()
        achievements_earned.append(achievement)
        achievement_xp += achievement.get("xp_reward", 0)

    total_xp = (profile.get("xp", 0) or 0) + request.xp_earned + achievement_xp
    next_level = calculate_level(total_xp)

    client.table("profiles").update(
        {
            "xp": total_xp,
            "level": next_level,
            "streak": current_streak,
            "last_active_date": active_date,
        }
    ).eq("id", request.user_id).execute()

    return {
        "session_id": created_session["id"],
        "achievements_earned": achievements_earned,
    }
