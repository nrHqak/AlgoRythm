from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_endpoint_combines_trace_and_classification(monkeypatch):
    monkeypatch.setattr(
        main,
        "execute_code",
        lambda code, array_var: {
            "steps": [{"step": 0, "array": [2, 1]}],
            "error": None,
            "total_steps": 1,
            "truncated": False,
        },
    )
    monkeypatch.setattr(
        main,
        "classify_algorithm",
        lambda code: {"algorithm": "bubble_sort", "confidence": 0.99},
    )

    response = client.post("/analyze", json={"code": "arr = [2, 1]", "array_var": "arr"})

    assert response.status_code == 200
    assert response.json()["algorithm_type"] == "bubble_sort"
    assert response.json()["algorithm_confidence"] == 0.99


def test_session_save_rejects_missing_bearer_token(monkeypatch):
    monkeypatch.setattr(main, "supabase", None)

    response = client.post("/session/save", json={"code": "arr = [1]"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header."


def test_calculate_level_boundaries():
    assert main.calculate_level(0) == 1
    assert main.calculate_level(200) == 2
    assert main.calculate_level(2_000) == 5


def test_compute_streak_for_same_consecutive_and_broken_days():
    today = date.today()

    assert main.compute_streak(today.isoformat(), 4) == (4, today.isoformat())
    assert main.compute_streak((today - timedelta(days=1)).isoformat(), 4) == (5, today.isoformat())
    assert main.compute_streak((today - timedelta(days=3)).isoformat(), 4) == (1, today.isoformat())


def test_evaluate_achievements_for_first_clean_fast_solution():
    request = main.SessionSaveRequest(
        code="arr = [2, 1]",
        algorithm_type="bubble_sort",
        task_completed=True,
        task_attempts=2,
        mentor_messages_count=0,
    )

    slugs = main.evaluate_achievements(
        request=request,
        user_sessions=[{"error": None}],
        task_progress=[],
        current_streak=3,
    )

    assert {"first_run", "no_hints", "fast_solve", "clean_sort", "streak_3"} <= slugs
