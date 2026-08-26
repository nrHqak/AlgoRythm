import argparse
import os
from collections import Counter
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


EXPECTED_SUPABASE_URL = "https://hfwrglctkzagstzretjy.supabase.co"
FINAL_ORDER_INDEXES = list(range(1, 16))
EXPECTED_PATTERN_COUNTS = {
    "local_reordering": 7,
    "select_and_place": 2,
    "scan_and_match": 3,
    "divide_and_conquer": 3,
}

TASK_PATTERNS: list[dict[str, Any]] = [
    {
        "id": "20fb6931-1949-4aa5-b479-efb7ddce0730",
        "title": "Bubble Sort Basics",
        "order_index": 1,
        "expected_algorithm": "bubble_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "76c40a75-cc9e-4875-ac36-6a4b7783af24",
        "title": "Find the Minimum",
        "order_index": 2,
        "expected_algorithm": "linear_search",
        "pattern": "scan_and_match",
    },
    {
        "id": "51673756-5f8b-40a6-a935-e8d9aa1258f8",
        "title": "Binary Search",
        "order_index": 3,
        "expected_algorithm": "binary_search",
        "pattern": "divide_and_conquer",
    },
    {
        "id": "fac0eb7b-138c-472f-98ee-fd9658b47bf2",
        "title": "Insertion Sort",
        "order_index": 4,
        "expected_algorithm": "insertion_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "1be36e25-4ee0-47c4-bddd-ed261f64875c",
        "title": "Count Swaps",
        "order_index": 5,
        "expected_algorithm": "bubble_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "2e22a2f3-3062-4d30-b376-2e7be91d300b",
        "title": "Clear the Departure Board",
        "order_index": 6,
        "expected_algorithm": "bubble_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "1d5de15d-360e-40fe-bd09-70c03a912b17",
        "title": "Repair the Nearly Sorted Queue",
        "order_index": 7,
        "expected_algorithm": "bubble_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "571b953e-df65-48ee-92e1-31abcd79aa04",
        "title": "Schedule the Shortest Repairs",
        "order_index": 8,
        "expected_algorithm": "selection_sort",
        "pattern": "select_and_place",
    },
    {
        "id": "4b7b4a44-8f04-4dd1-95ea-59dd34834bc2",
        "title": "Rank the Finalists",
        "order_index": 9,
        "expected_algorithm": "selection_sort",
        "pattern": "select_and_place",
    },
    {
        "id": "8654ee99-175e-40f2-acb2-e6365931eaf3",
        "title": "File the Incoming Invoices",
        "order_index": 10,
        "expected_algorithm": "insertion_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "dea87c4e-97c7-4b24-b68d-c95bfee57c39",
        "title": "Restore the Shift Timeline",
        "order_index": 11,
        "expected_algorithm": "insertion_sort",
        "pattern": "local_reordering",
    },
    {
        "id": "e50bf910-dfa2-44ad-b46c-627899a6bd19",
        "title": "Locate the Reserved Seat",
        "order_index": 12,
        "expected_algorithm": "binary_search",
        "pattern": "divide_and_conquer",
    },
    {
        "id": "7a9fc15a-004e-4433-b73b-f97bd79f1e9f",
        "title": "Find the First Matching Batch",
        "order_index": 13,
        "expected_algorithm": "binary_search",
        "pattern": "divide_and_conquer",
    },
    {
        "id": "f85a6102-8811-47e4-96b6-959c9d1bdb88",
        "title": "Trace the Lost Package",
        "order_index": 14,
        "expected_algorithm": "linear_search",
        "pattern": "scan_and_match",
    },
    {
        "id": "600de4b2-35ad-4b8f-baa3-0dab4092def2",
        "title": "Flag the First Overloaded Sensor",
        "order_index": 15,
        "expected_algorithm": "linear_search",
        "pattern": "scan_and_match",
    },
]


def require_admin_client() -> Client:
    load_dotenv()
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if supabase_url != EXPECTED_SUPABASE_URL:
        raise RuntimeError(
            "Refusing to update an unexpected project. "
            f"Expected {EXPECTED_SUPABASE_URL}, got {supabase_url or '<missing>'}."
        )
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY must be set for this admin operation.")

    return create_client(supabase_url, service_key)


def fetch_tasks(client: Client) -> list[dict[str, Any]]:
    response = (
        client.table("tasks")
        .select("id,title,order_index,expected_algorithm,pattern")
        .order("order_index")
        .execute()
    )
    return response.data or []


def validate_curriculum(rows: list[dict[str, Any]]) -> None:
    orders = [int(row["order_index"]) for row in rows]
    if len(rows) != len(TASK_PATTERNS):
        raise RuntimeError(f"Expected 15 tasks before backfill, found {len(rows)}.")
    if orders != FINAL_ORDER_INDEXES:
        raise RuntimeError(f"Expected contiguous order_index 1..15, found {orders}.")

    rows_by_id = {row["id"]: row for row in rows}
    if len(rows_by_id) != len(rows):
        raise RuntimeError("Duplicate task ids found before pattern backfill.")

    for expected in TASK_PATTERNS:
        actual = rows_by_id.get(expected["id"])
        if actual is None:
            raise RuntimeError(f"Expected task {expected['title']!r} is missing.")

        for field in ("title", "order_index", "expected_algorithm"):
            if actual.get(field) != expected[field]:
                raise RuntimeError(
                    f"Preflight failed for {expected['title']!r}.{field}: "
                    f"expected {expected[field]!r}, got {actual.get(field)!r}."
                )


def apply_backfill(client: Client) -> None:
    for task in TASK_PATTERNS:
        response = (
            client.table("tasks")
            .update({"pattern": task["pattern"]})
            .eq("id", task["id"])
            .execute()
        )
        if len(response.data or []) != 1:
            raise RuntimeError(f"Pattern update did not affect {task['title']!r} exactly once.")


def verify_patterns(rows: list[dict[str, Any]]) -> None:
    validate_curriculum(rows)
    rows_by_id = {row["id"]: row for row in rows}

    for expected in TASK_PATTERNS:
        actual_pattern = rows_by_id[expected["id"]].get("pattern")
        if actual_pattern != expected["pattern"]:
            raise RuntimeError(
                f"Verification failed for {expected['title']!r}.pattern: "
                f"expected {expected['pattern']!r}, got {actual_pattern!r}."
            )

    counts = Counter(str(row.get("pattern")) for row in rows)
    if dict(counts) != EXPECTED_PATTERN_COUNTS:
        raise RuntimeError(
            f"Expected pattern counts {EXPECTED_PATTERN_COUNTS}, found {dict(counts)}."
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill the approved thinking-pattern taxonomy for all curriculum tasks."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write pattern values. Without this flag, only production preflight checks run.",
    )
    args = parser.parse_args()

    client = require_admin_client()
    rows = fetch_tasks(client)
    validate_curriculum(rows)

    if not args.apply:
        print(
            f"Preflight passed for {len(rows)} tasks in {EXPECTED_SUPABASE_URL}. "
            "Re-run with --apply to backfill patterns."
        )
        return

    apply_backfill(client)
    final_rows = fetch_tasks(client)
    verify_patterns(final_rows)

    counts = Counter(row["pattern"] for row in final_rows)
    print(f"Backfilled patterns for {len(final_rows)} tasks in {EXPECTED_SUPABASE_URL}.")
    print("Verified order_index=" + ",".join(str(row["order_index"]) for row in final_rows) + ".")
    print("Verified pattern_counts=" + ",".join(f"{key}:{value}" for key, value in counts.items()) + ".")


if __name__ == "__main__":
    main()
