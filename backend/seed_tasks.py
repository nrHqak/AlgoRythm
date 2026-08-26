import argparse
import os
from textwrap import dedent
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from classifier import classify_algorithm


EXPECTED_SUPABASE_URL = "https://hfwrglctkzagstzretjy.supabase.co"
BASE_ORDER_INDEXES = list(range(1, 6))
FINAL_ORDER_INDEXES = list(range(1, 16))
MIN_CLASSIFIER_CONFIDENCE = 0.7


def starter_code(source: str) -> str:
    return dedent(source).strip() + "\n"


TASKS: list[dict[str, Any]] = [
    {
        "id": "2e22a2f3-3062-4d30-b376-2e7be91d300b",
        "title": "Clear the Departure Board",
        "description": (
            "Order departure delays from shortest to longest by repeatedly swapping "
            "adjacent out-of-order entries."
        ),
        "difficulty": "beginner",
        "order_index": 6,
        "starter_code": starter_code(
            """
            arr = [18, 7, 12, 3, 9]

            for end in range(len(arr) - 1, 0, -1):
                for i in range(end):
                    if arr[i] > arr[i + 1]:
                        arr[i], arr[i + 1] = arr[i + 1], arr[i]
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "bubble_sort",
        "max_xp": 100,
    },
    {
        "id": "1d5de15d-360e-40fe-bd09-70c03a912b17",
        "title": "Repair the Nearly Sorted Queue",
        "description": (
            "Restore a nearly ordered support queue and stop as soon as a full pass "
            "makes no swaps."
        ),
        "difficulty": "intermediate",
        "order_index": 7,
        "starter_code": starter_code(
            """
            arr = [5, 8, 12, 11, 15, 20]

            for end in range(len(arr) - 1, 0, -1):
                swapped = False
                for i in range(end):
                    if arr[i] > arr[i + 1]:
                        arr[i], arr[i + 1] = arr[i + 1], arr[i]
                        swapped = True
                if not swapped:
                    break
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "bubble_sort",
        "max_xp": 150,
    },
    {
        "id": "571b953e-df65-48ee-92e1-31abcd79aa04",
        "title": "Schedule the Shortest Repairs",
        "description": (
            "Arrange repair estimates by repeatedly selecting the shortest remaining "
            "job for the next service bay."
        ),
        "difficulty": "beginner",
        "order_index": 8,
        "starter_code": starter_code(
            """
            arr = [42, 17, 31, 8, 23]

            for slot in range(len(arr)):
                lowest = slot
                for i in range(slot + 1, len(arr)):
                    if arr[i] < arr[lowest]:
                        lowest = i
                arr[slot], arr[lowest] = arr[lowest], arr[slot]
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "selection_sort",
        "max_xp": 100,
    },
    {
        "id": "4b7b4a44-8f04-4dd1-95ea-59dd34834bc2",
        "title": "Rank the Finalists",
        "description": (
            "Build a highest-to-lowest finalist ranking by selecting the best "
            "remaining interview score each round."
        ),
        "difficulty": "intermediate",
        "order_index": 9,
        "starter_code": starter_code(
            """
            arr = [71, 85, 64, 92, 78]

            for slot in range(len(arr)):
                highest = slot
                for i in range(slot + 1, len(arr)):
                    if arr[i] > arr[highest]:
                        highest = i
                arr[slot], arr[highest] = arr[highest], arr[slot]
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "selection_sort",
        "max_xp": 150,
    },
    {
        "id": "8654ee99-175e-40f2-acb2-e6365931eaf3",
        "title": "File the Incoming Invoices",
        "description": (
            "Place invoice amounts into ascending order as each new invoice enters "
            "the processed section."
        ),
        "difficulty": "intermediate",
        "order_index": 10,
        "starter_code": starter_code(
            """
            arr = [920, 450, 780, 310, 640]

            for i in range(1, len(arr)):
                current = arr[i]
                j = i - 1
                while j >= 0 and arr[j] > current:
                    arr[j + 1] = arr[j]
                    j -= 1
                arr[j + 1] = current
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "insertion_sort",
        "max_xp": 150,
    },
    {
        "id": "dea87c4e-97c7-4b24-b68d-c95bfee57c39",
        "title": "Restore the Shift Timeline",
        "description": (
            "Reinsert late clock-in records into a schedule that is already almost "
            "chronological."
        ),
        "difficulty": "beginner",
        "order_index": 11,
        "starter_code": starter_code(
            """
            arr = [540, 560, 590, 575, 610, 605]

            for i in range(1, len(arr)):
                current = arr[i]
                j = i - 1
                while j >= 0 and arr[j] > current:
                    arr[j + 1] = arr[j]
                    j -= 1
                arr[j + 1] = current
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "insertion_sort",
        "max_xp": 100,
    },
    {
        "id": "e50bf910-dfa2-44ad-b46c-627899a6bd19",
        "title": "Locate the Reserved Seat",
        "description": (
            "Find a reserved seat code in a sorted seating index by repeatedly "
            "halving the remaining range."
        ),
        "difficulty": "intermediate",
        "order_index": 12,
        "starter_code": starter_code(
            """
            arr = [101, 104, 108, 112, 117, 121]
            target = 112
            left = 0
            right = len(arr) - 1
            result = -1

            while left <= right:
                mid = (left + right) // 2
                if arr[mid] == target:
                    result = mid
                    break
                if arr[mid] < target:
                    left = mid + 1
                else:
                    right = mid - 1
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "binary_search",
        "max_xp": 150,
    },
    {
        "id": "7a9fc15a-004e-4433-b73b-f97bd79f1e9f",
        "title": "Find the First Matching Batch",
        "description": (
            "Locate the earliest occurrence of a repeated batch number in a sorted "
            "production log."
        ),
        "difficulty": "advanced",
        "order_index": 13,
        "starter_code": starter_code(
            """
            arr = [12, 18, 18, 18, 25, 31]
            target = 18
            left = 0
            right = len(arr) - 1
            result = -1

            while left <= right:
                mid = (left + right) // 2
                if arr[mid] == target:
                    result = mid
                    right = mid - 1
                elif arr[mid] < target:
                    left = mid + 1
                else:
                    right = mid - 1
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "binary_search",
        "max_xp": 200,
    },
    {
        "id": "f85a6102-8811-47e4-96b6-959c9d1bdb88",
        "title": "Trace the Lost Package",
        "description": (
            "Scan an unsorted list of package IDs to find the index of a missing "
            "shipment label."
        ),
        "difficulty": "beginner",
        "order_index": 14,
        "starter_code": starter_code(
            """
            arr = [4102, 7718, 2055, 9630, 1184]
            target = 9630
            result = -1

            for i in range(len(arr)):
                if arr[i] == target:
                    result = i
                    break
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "linear_search",
        "max_xp": 100,
    },
    {
        "id": "600de4b2-35ad-4b8f-baa3-0dab4092def2",
        "title": "Flag the First Overloaded Sensor",
        "description": (
            "Scan sensor readings from left to right and report the first reading "
            "that reaches the alert threshold."
        ),
        "difficulty": "intermediate",
        "order_index": 15,
        "starter_code": starter_code(
            """
            arr = [12, 18, 21, 29, 34, 41]
            target = 30
            result = -1

            for i in range(len(arr)):
                if arr[i] >= target:
                    result = i
                    break
            """
        ),
        "solution_hint": None,
        "expected_algorithm": "linear_search",
        "max_xp": 150,
    },
]


def require_admin_client() -> Client:
    load_dotenv()
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if supabase_url != EXPECTED_SUPABASE_URL:
        raise RuntimeError(
            "Refusing to seed an unexpected project. "
            f"Expected {EXPECTED_SUPABASE_URL}, got {supabase_url or '<missing>'}."
        )
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY must be set for this admin operation.")

    return create_client(supabase_url, service_key)


def fetch_tasks(client: Client) -> list[dict[str, Any]]:
    response = client.table("tasks").select("*").order("order_index").execute()
    return response.data or []


def validate_starter_code() -> None:
    for task in TASKS:
        source = task["starter_code"]
        expected = task["expected_algorithm"]
        compile(source, f"<{task['title']}>", "exec")
        classification = classify_algorithm(source)
        predicted = str(classification.get("algorithm", "unknown"))
        confidence = float(classification.get("confidence", 0.0))

        if predicted != expected or confidence < MIN_CLASSIFIER_CONFIDENCE:
            raise RuntimeError(
                f"Classifier preflight failed for {task['title']!r}: "
                f"expected {expected}, got {predicted} at {confidence:.3f}."
            )


def validate_existing_rows(rows: list[dict[str, Any]]) -> None:
    seed_ids = {task["id"] for task in TASKS}
    seed_titles = {task["title"] for task in TASKS}
    seed_by_id = {task["id"]: task for task in TASKS}
    rows_by_order: dict[int, dict[str, Any]] = {}

    for row in rows:
        order_index = int(row["order_index"])
        if order_index in rows_by_order:
            raise RuntimeError(f"Duplicate existing order_index {order_index}.")
        rows_by_order[order_index] = row

        if row["title"] in seed_titles and row["id"] not in seed_ids:
            raise RuntimeError(
                f"Task title {row['title']!r} already exists under a different id."
            )

        if row["id"] in seed_ids:
            expected_order = seed_by_id[row["id"]]["order_index"]
            if order_index != expected_order:
                raise RuntimeError(
                    f"Seed task {row['title']!r} has unexpected order_index "
                    f"{order_index}; expected {expected_order}."
                )

    base_rows = [row for row in rows if row["id"] not in seed_ids]
    base_orders = sorted(int(row["order_index"]) for row in base_rows)
    if base_orders != BASE_ORDER_INDEXES:
        raise RuntimeError(
            "Expected the five original tasks at order_index 1..5 before seeding; "
            f"found {base_orders}."
        )

    unexpected_rows = [
        row for row in rows if row["id"] not in seed_ids and int(row["order_index"]) > 5
    ]
    if unexpected_rows:
        titles = ", ".join(row["title"] for row in unexpected_rows)
        raise RuntimeError(f"Unexpected non-seed tasks would be overwritten: {titles}.")


def verify_final_rows(rows: list[dict[str, Any]]) -> None:
    orders = [int(row["order_index"]) for row in rows]
    if len(rows) != len(FINAL_ORDER_INDEXES):
        raise RuntimeError(f"Expected 15 tasks after seeding, found {len(rows)}.")
    if orders != FINAL_ORDER_INDEXES:
        raise RuntimeError(f"Expected contiguous order_index 1..15, found {orders}.")

    rows_by_id = {row["id"]: row for row in rows}
    for expected in TASKS:
        actual = rows_by_id.get(expected["id"])
        if actual is None:
            raise RuntimeError(f"Seeded task {expected['title']!r} is missing.")

        for field, expected_value in expected.items():
            if actual.get(field) != expected_value:
                raise RuntimeError(
                    f"Verification failed for {expected['title']!r}.{field}: "
                    f"expected {expected_value!r}, got {actual.get(field)!r}."
                )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed AlgoRythm's approved supported-algorithm curriculum tasks."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the approved tasks. Without this flag, only preflight checks run.",
    )
    args = parser.parse_args()

    validate_starter_code()
    client = require_admin_client()
    existing_rows = fetch_tasks(client)
    validate_existing_rows(existing_rows)

    if not args.apply:
        print(
            f"Preflight passed for {len(TASKS)} tasks against "
            f"{len(existing_rows)} existing rows. Re-run with --apply to insert."
        )
        return

    client.table("tasks").upsert(TASKS, on_conflict="id").execute()
    final_rows = fetch_tasks(client)
    verify_final_rows(final_rows)

    print(f"Seeded {len(TASKS)} tasks into {EXPECTED_SUPABASE_URL}.")
    print(f"Verified row_count={len(final_rows)}.")
    print(
        "Verified order_index="
        + ",".join(str(row["order_index"]) for row in final_rows)
        + "."
    )


if __name__ == "__main__":
    main()
