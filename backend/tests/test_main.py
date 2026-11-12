from __future__ import annotations

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_session_save_rejects_missing_bearer_token(monkeypatch):
    monkeypatch.setattr(main, "supabase", None)

    response = client.post("/session/save", json={"code": "arr = [1]"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header."


def test_classify_endpoint_reuses_classifier_without_execution(monkeypatch):
    received = []
    monkeypatch.setattr(main, "classify_algorithm", lambda code: (
        received.append(code) or {"algorithm": "binary_search", "confidence": 0.94}
    ))
    response = client.post("/classify", json={"code": "arr = [1, 3, 5]"})
    assert response.status_code == 200
    assert response.json() == {"algorithm_type": "binary_search", "algorithm_confidence": 0.94}
    assert received == ["arr = [1, 3, 5]"]


def test_classify_empty_source_rejected():
    assert client.post("/classify", json={"code": ""}).status_code == 422


def test_classify_preserves_existing_unknown_semantics(monkeypatch):
    monkeypatch.setattr(main, "classify_algorithm", lambda code: {"algorithm": "unknown", "confidence": 0.0})
    response = client.post("/classify", json={"code": "this is invalid python"})
    assert response.json() == {"algorithm_type": "unknown", "algorithm_confidence": 0.0}


def test_session_save_verifies_bearer_identity_with_auth_service(monkeypatch):
    from types import SimpleNamespace

    tokens = []

    def get_user(*, jwt):
        tokens.append(jwt)
        return SimpleNamespace(user=SimpleNamespace(id="verified-owner"))

    monkeypatch.setattr(main, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=get_user)))
    assert main.verify_authenticated_user_id("Bearer synthetic-token") == "verified-owner"
    assert tokens == ["synthetic-token"]


def test_session_save_rejects_invalid_auth_identity_before_writing(monkeypatch):
    from types import SimpleNamespace

    import pytest

    from fastapi import HTTPException

    writes = []
    service = SimpleNamespace(
        auth=SimpleNamespace(get_user=lambda **_kwargs: SimpleNamespace(user=None)),
        table=lambda name: writes.append(name),
    )
    monkeypatch.setattr(main, "supabase", service)
    for authorization in ["Basic synthetic", "Bearer ", "Bearer synthetic-invalid"]:
        with pytest.raises(HTTPException) as error:
            main.verify_authenticated_user_id(authorization)
        assert error.value.status_code == 401
    response = client.post("/session/save", json={"code": "arr = [1]"},
                           headers={"Authorization": "Bearer synthetic-invalid"})
    assert response.status_code == 401
    assert writes == []
