import json
from pathlib import Path

import pytest

from tracer import AlgorithmTracer
from browser_trace import execute_trace as execute

ROOT = Path(__file__).resolve().parents[2]
cases = json.loads((ROOT / "tests/fixtures/browser_traces.json").read_text())


@pytest.mark.parametrize("case", [case for case in cases if case["name"] != "Timeout"], ids=lambda case: case["name"])
def test_count_matches_trace_eligible_lines_errors_and_caps(case):
    trace = json.loads(execute(case["code"], case["arrayVar"], case["maxSteps"]))
    count = json.loads(execute(case["code"], case["arrayVar"], case["maxSteps"], "count"))
    assert count == {"count": trace["total_steps"], "error": trace["error"], "truncated": trace["truncated"]}
    assert set(count) == {"count", "error", "truncated"}


def test_count_performs_no_visual_snapshot_or_event_work(monkeypatch):
    def forbidden(*args):
        raise AssertionError("Count mode must not create visualization payloads")

    for method in ("_extract_array", "_snapshot_locals", "_extract_highlights", "_detect_event"):
        monkeypatch.setattr(AlgorithmTracer, method, forbidden)
    result = json.loads(execute("arr = [2, 1]\narr.sort()\nfinal = arr", "arr", 25000, "count"))
    assert result == {"count": 2, "error": None, "truncated": False}


def test_counter_bounds_excessive_steps():
    result = json.loads(execute("arr = [1]\nwhile True:\n    arr[0] += 1", "arr", 25, "count"))
    assert result == {"count": 25, "error": None, "truncated": True}
