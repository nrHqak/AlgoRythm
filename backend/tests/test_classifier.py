from __future__ import annotations

from pathlib import Path

import classifier


def test_classifier_recognizes_bubble_sort_shape():
    code = """
arr = [3, 2, 1]
for i in range(len(arr)):
    for j in range(len(arr) - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
"""

    result = classifier.classify_algorithm(code)

    assert str(result["algorithm"]) == "bubble_sort"
    assert 0 <= result["confidence"] <= 1


def test_classifier_has_unknown_fallback_when_model_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(classifier, "_bundle", None)
    monkeypatch.setattr(classifier, "MODEL_PATH", Path(tmp_path) / "missing.pkl")

    result = classifier.classify_algorithm("arr = [1]")

    assert result == {"algorithm": "unknown", "confidence": 0.0, "probabilities": {}}
