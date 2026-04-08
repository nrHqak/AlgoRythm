import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

from classifier import classify_algorithm
from sandbox import execute_code

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@algorythm.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "AlgoRythmDemo123!")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
  raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set before seeding demo data.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@dataclass
class SeedUser:
  email: str
  password: str
  username: str
  xp: int
  level: int
  streak: int
  last_active_days_ago: int
  mentor_style: str
  pet_name: str


ALGORITHM_CASES = [
  {
    "key": "bubble_sort_clean",
    "code": """arr = [5, 3, 1, 4, 2]
for i in range(len(arr)):
    for j in range(0, len(arr) - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]""",
    "array_var": "arr",
    "solved": True,
    "attempts": 1,
    "xp_earned": 75,
    "days_ago": 0,
  },
  {
    "key": "selection_sort",
    "code": """arr = [9, 5, 1, 4, 3]
for i in range(len(arr)):
    min_idx = i
    for j in range(i + 1, len(arr)):
        if arr[j] < arr[min_idx]:
            min_idx = j
    arr[i], arr[min_idx] = arr[min_idx], arr[i]""",
    "array_var": "arr",
    "solved": True,
    "attempts": 2,
    "xp_earned": 68,
    "days_ago": 1,
  },
  {
    "key": "binary_search",
    "code": """arr = [1, 3, 5, 7, 9, 11]
target = 7
left = 0
right = len(arr) - 1

while left <= right:
    mid = (left + right) // 2
    if arr[mid] == target:
        result = mid
        break
    if arr[mid] < target:
        left = mid + 1
    else:
        right = mid - 1""",
    "array_var": "arr",
    "solved": True,
    "attempts": 1,
    "xp_earned": 64,
    "days_ago": 2,
  },
  {
    "key": "linear_search",
    "code": """arr = [4, 8, 2, 9, 1]
target = 9
for i in range(len(arr)):
    if arr[i] == target:
        result = i
        break""",
    "array_var": "arr",
    "solved": True,
    "attempts": 1,
    "xp_earned": 52,
    "days_ago": 3,
  },
  {
    "key": "insertion_sort",
    "code": """arr = [5, 3, 1, 4, 2]
for i in range(1, len(arr)):
    key = arr[i]
    j = i - 1
    while j >= 0 and arr[j] > key:
        arr[j + 1] = arr[j]
        j -= 1
    arr[j + 1] = key""",
    "array_var": "arr",
    "solved": True,
    "attempts": 2,
    "xp_earned": 70,
    "days_ago": 5,
  },
  {
    "key": "index_error_demo",
    "code": """arr = [1, 2, 3]
print(arr[5])""",
    "array_var": "arr",
    "solved": False,
    "attempts": 3,
    "xp_earned": 12,
    "days_ago": 7,
  },
]


SEED_USERS = [
  SeedUser(DEMO_EMAIL, DEMO_PASSWORD, "demo_algonaut", 1480, 4, 6, 0, "coach", "Byte"),
  SeedUser("maya@algorythm.app", "AlgoRythmSeed123!", "maya_loop", 920, 3, 4, 0, "calm", "Nova"),
  SeedUser("ivan@algorythm.app", "AlgoRythmSeed123!", "ivan_mid", 610, 3, 3, 1, "strict", "Pulse"),
  SeedUser("sara@algorythm.app", "AlgoRythmSeed123!", "sara_sort", 1240, 4, 5, 0, "warm", "Orbit"),
  SeedUser("leo@algorythm.app", "AlgoRythmSeed123!", "leo_search", 430, 2, 2, 2, "quiet", "Knot"),
  SeedUser("dina@algorythm.app", "AlgoRythmSeed123!", "dina_trace", 210, 2, 1, 1, "gentle", "Luma"),
]


def list_auth_users():
  return supabase.auth.admin.list_users(page=1, per_page=200)


def find_user_by_email(email):
  for user in list_auth_users():
    if getattr(user, "email", None) == email:
      return user
  return None


def ensure_auth_user(seed_user):
  existing = find_user_by_email(seed_user.email)
  attributes = {
    "email": seed_user.email,
    "password": seed_user.password,
    "email_confirm": True,
    "user_metadata": {
      "username": seed_user.username,
      "seeded": True,
      "demo": seed_user.email == DEMO_EMAIL,
    },
  }

  if existing:
    supabase.auth.admin.update_user_by_id(existing.id, attributes)
    return find_user_by_email(seed_user.email)

  response = supabase.auth.admin.create_user(attributes)
  return getattr(response, "user", response)


def reset_user_rows(user_id):
  for table in [
    "mentor_messages",
    "user_achievements",
    "quiz_attempts",
    "task_progress",
    "sessions",
    "pet_profiles",
  ]:
    supabase.table(table).delete().eq("user_id", user_id).execute()


def build_session_payload(case, offset_days):
  traced = execute_code(case["code"], case["array_var"])
  classification = classify_algorithm(case["code"])
  created_at = datetime.now(timezone.utc) - timedelta(days=offset_days, hours=random.randint(1, 20))
  return {
    "code": case["code"],
    "array_var": case["array_var"],
    "trace": traced["steps"],
    "error": traced["error"],
    "total_steps": traced["total_steps"],
    "algorithm_type": classification.get("algorithm", "custom"),
    "solved": case["solved"] and traced["error"] is None,
    "attempts": case["attempts"],
    "xp_earned": case["xp_earned"],
    "created_at": created_at.isoformat(),
  }


def seed_sessions(user_id, seed_user):
  inserted = []
  for index, case in enumerate(ALGORITHM_CASES):
    payload = build_session_payload(case, case["days_ago"] + index // 2)
    payload["user_id"] = user_id
    row = supabase.table("sessions").insert(payload).execute().data[0]
    inserted.append(row)
  return inserted


def seed_task_progress(user_id):
  tasks = supabase.table("tasks").select("*").order("order_index").execute().data or []
  progress_rows = []
  for task in tasks:
    status = "completed" if task["order_index"] <= 3 else "unlocked" if task["order_index"] == 4 else "locked"
    progress_rows.append(
      {
        "user_id": user_id,
        "task_id": task["id"],
        "status": status,
        "attempts": 2 if status == "completed" else 0,
        "best_steps": 42 + task["order_index"] * 7 if status == "completed" else None,
        "xp_earned": int(task.get("max_xp", 0) * 0.8) if status == "completed" else 0,
        "completed_at": (datetime.now(timezone.utc) - timedelta(days=task["order_index"] + 2)).isoformat()
        if status == "completed"
        else None,
      }
    )
  if progress_rows:
    supabase.table("task_progress").insert(progress_rows).execute()


def seed_achievements(user_id):
  wanted = {"first_run", "first_error", "clean_sort", "streak_3", "fast_solve"}
  achievements = supabase.table("achievements").select("*").in_("slug", list(wanted)).execute().data or []
  rows = [{"user_id": user_id, "achievement_id": item["id"]} for item in achievements]
  if rows:
    supabase.table("user_achievements").insert(rows).execute()


def seed_mentor_messages(user_id, sessions, mentor_style):
  if not sessions:
    return
  session_id = sessions[0]["id"]
  messages = [
    {
      "user_id": user_id,
      "session_id": session_id,
      "role": "user",
      "message": "Why does my binary search keep missing the target?",
      "trigger_type": "free_chat",
    },
    {
      "user_id": user_id,
      "session_id": session_id,
      "role": "mentor",
      "message": f"As a {mentor_style} coach, I would ask: what does mid point to after each update of left and right?",
      "trigger_type": "free_chat",
    },
    {
      "user_id": user_id,
      "session_id": sessions[-1]["id"],
      "role": "mentor",
      "message": "Look one line before the error. Which index becomes larger than the array allows?",
      "trigger_type": "error",
    },
  ]
  supabase.table("mentor_messages").insert(messages).execute()


def seed_pet(user_id, seed_user):
  payload = {
    "user_id": user_id,
    "pet_name": seed_user.pet_name,
    "hunger": random.randint(18, 42),
    "mood": random.randint(66, 92),
    "energy": random.randint(58, 88),
    "evolution_points": max(120, seed_user.xp // 2),
    "last_fed_at": (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
  }
  supabase.table("pet_profiles").insert(payload).execute()


def seed_quiz_attempts(user_id):
  today = datetime.now(timezone.utc).date()
  prompts = [
    ("time_binary", "What time complexity does binary search have on a sorted array?", True, 10),
    ("swap_bubble", "In bubble sort, what happens when two adjacent items are out of order?", True, 10),
    ("trace_use", "What is the main purpose of a step trace in AlgoRythm?", False, 3),
  ]
  rows = []
  for index, (key, prompt, correct, xp) in enumerate(prompts):
    rows.append(
      {
        "user_id": user_id,
        "quiz_day": today.isoformat(),
        "question_key": key,
        "prompt": prompt,
        "correct": correct,
        "xp_earned": xp,
        "response_ms": 4200 + index * 900,
        "created_at": (datetime.now(timezone.utc) - timedelta(minutes=15 - index * 3)).isoformat(),
      }
    )
  supabase.table("quiz_attempts").insert(rows).execute()


def seed_profile(user_id, seed_user):
  last_active_date = (datetime.now(timezone.utc).date() - timedelta(days=seed_user.last_active_days_ago)).isoformat()
  supabase.table("profiles").upsert(
    {
      "id": user_id,
      "username": seed_user.username,
      "xp": seed_user.xp,
      "level": seed_user.level,
      "streak": seed_user.streak,
      "last_active_date": last_active_date,
    },
    on_conflict="id",
  ).execute()


def seed_one_user(seed_user):
  auth_user = ensure_auth_user(seed_user)
  user_id = auth_user.id
  reset_user_rows(user_id)
  seed_profile(user_id, seed_user)
  sessions = seed_sessions(user_id, seed_user)
  seed_task_progress(user_id)
  seed_achievements(user_id)
  seed_mentor_messages(user_id, sessions, seed_user.mentor_style)
  seed_pet(user_id, seed_user)
  seed_quiz_attempts(user_id)
  return user_id


def main():
  print("Seeding demo and synthetic users...")
  ids = []
  for item in SEED_USERS:
    user_id = seed_one_user(item)
    ids.append((item.email, user_id))
    print(f"Seeded {item.email} -> {user_id}")

  print("\nDemo login:")
  print(f"email: {DEMO_EMAIL}")
  print(f"password: {DEMO_PASSWORD}")


if __name__ == "__main__":
  main()
