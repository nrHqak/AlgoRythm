from __future__ import annotations

import mentor


def test_mentor_returns_fallback_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    result = mentor.generate_mentor_hint(
        code="arr = [1]",
        error="IndexError",
        error_line=7,
        trace_context="",
        user_question="Why did this fail?",
        mode="reactive",
        user_history=None,
    )

    assert result["hint_type"] == "fallback"
    assert "7" in result["message"]


def test_mentor_falls_back_when_provider_raises(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-key")

    class BrokenModel:
        def __init__(self, *args, **kwargs):
            pass

        def generate_content(self, prompt):
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr(mentor.genai, "configure", lambda **kwargs: None)
    monkeypatch.setattr(mentor.genai, "GenerativeModel", BrokenModel)

    result = mentor.generate_mentor_hint(
        code="",
        error=None,
        error_line=None,
        trace_context="",
        user_question="Explain complexity",
        mode="free_chat",
        user_history=None,
    )

    assert result["hint_type"] == "fallback"
