"""Backend source and routes cannot dispatch user source to an executor."""
import ast
import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("route", ["/analyze", "/complexity"])
def test_execution_routes_are_absent(route):
    assert route not in main.app.openapi()["paths"]
    assert TestClient(main.app).post(route, json={"code": "while True: pass", "array_var": "arr"}).status_code == 404


def test_backend_has_no_code_execution_or_runtime_imports():
    for path in (ROOT / "backend").glob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else ""
                assert name not in {"exec", "eval", "execute_code", "trace_code", "execute_trace", "AlgorithmTracer"}, path
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                names = [node.module or ""] if isinstance(node, ast.ImportFrom) else [a.name for a in node.names]
                assert not any(n.split(".")[0] in {"multiprocessing", "sandbox", "tracer", "browser_trace"} for n in names), path
    for name in ["sandbox.py", "tracer.py", "benchmark_execution.py"]:
        assert not (ROOT / "backend" / name).exists()


def test_real_classification_does_not_run_source(tmp_path):
    marker = tmp_path / "must-not-exist"
    code = f"__import__('pathlib').Path({str(marker)!r}).write_text('executed')"
    response = TestClient(main.app).post("/classify", json={"code": code})
    assert response.status_code == 200
    assert isinstance(response.json()["algorithm_type"], str)
    assert not marker.exists()


def test_demo_seed_uses_source_matched_saved_traces():
    tree = ast.parse((ROOT / "backend/seed_demo_data.py").read_text())
    cases = next(n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "ALGORITHM_CASES" for t in n.targets))
    saved = json.loads((ROOT / "backend/demo_traces.json").read_text())
    for case in ast.literal_eval(cases.value):
        assert saved[case["key"]]["code"] == case["code"]
        assert saved[case["key"]]["array_var"] == case["array_var"]
        trace = saved[case["key"]]["trace"]
        assert trace["trace_version"] == 1
        assert trace["total_steps"] == len(trace["steps"])


def test_frontend_has_no_backend_execution_request_path():
    for path in (ROOT / "frontend/src").rglob("*"):
        if path.suffix not in {".js", ".jsx"} or "__tests__" in path.parts:
            continue
        source = re.sub(r"^import\b.*?;", "", path.read_text(), flags=re.M | re.S)
        for removed in ["ServerEngine", "VITE_EXECUTION_ENGINE", "/analyze", "/complexity"]:
            assert removed not in source, path


def test_session_save_stores_browser_trace_without_executing_source(monkeypatch, tmp_path):
    from types import SimpleNamespace

    marker = tmp_path / "must-not-exist"
    source = f"__import__('pathlib').Path({str(marker)!r}).write_text('executed')"
    trace = [{"step": 0, "line": 1, "array": [1], "event": "step", "highlights": [], "locals": {}, "error": None}]
    writes = []

    def table(name):
        state = {}
        query = SimpleNamespace()
        def write(action, payload):
            state.update(action=action, payload=payload)
            return query
        query.insert = lambda payload: write("insert", payload)
        query.update = lambda payload: write("update", payload)
        def eq(key, value):
            state["owner"] = (key, value)
            return query
        query.eq = eq
        def execute():
            writes.append((name, dict(state)))
            return SimpleNamespace(data=[{"id": "saved-session"}] if name == "sessions" else [])
        query.execute = execute
        return query

    monkeypatch.setattr(main, "supabase", SimpleNamespace(table=table))
    achievement = {"id": "first-run", "slug": "first_run", "xp_reward": 10}
    monkeypatch.setattr(main, "load_user_data", lambda _client, user_id: {
        "profile": {"xp": 100}, "sessions": [{"error": None}], "task_progress": [],
        "achievements": [achievement], "user_achievements": [],
    })
    main.app.dependency_overrides[main.verify_authenticated_user_id] = lambda: "verified-user"
    try:
        response = TestClient(main.app).post("/session/save", json={
            "user_id": "untrusted-body-user", "code": source, "trace": trace,
            "total_steps": 1, "solved": True, "xp_earned": 30,
        })
    finally:
        main.app.dependency_overrides.pop(main.verify_authenticated_user_id)
    assert response.status_code == 200
    assert response.json() == {"session_id": "saved-session", "achievements_earned": [achievement]}
    saved = next(state["payload"] for name, state in writes if name == "sessions")
    assert saved["code"] == source and saved["trace"] == trace
    assert saved["user_id"] == "verified-user"
    profile = next(state for name, state in writes if name == "profiles")
    assert profile["payload"]["xp"] == 140
    assert profile["owner"] == ("id", "verified-user")
    assert not marker.exists()
