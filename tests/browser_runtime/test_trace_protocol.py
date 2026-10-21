"""Browser Trace Protocol v1 semantics; hard deadlines are tested in JS/Pyodide."""

import json
from pathlib import Path

import pytest

from browser_trace import execute_trace
from tracer import AlgorithmTracer

CASES = json.loads((Path(__file__).resolve().parents[1] / "fixtures/browser_traces.json").read_text())
EXAMPLES = {case["name"]: case["code"] for case in CASES}


def run_trace(code, array_var, max_steps=300):
    return json.loads(execute_trace(code, array_var, max_steps))


def assert_trace(result, code):
    assert result["trace_version"] == 1
    assert result["total_steps"] == len(result["steps"])
    for index, step in enumerate(result["steps"]):
        assert step["step"] == index
        assert 1 <= step["line"] <= len(code.splitlines())
        assert set(step) == {"step", "line", "event", "array", "highlights", "locals", "error"}
        assert isinstance(step["array"], list)
        assert isinstance(step["locals"], dict)
        assert all(0 <= highlight < len(step["array"]) for highlight in step["highlights"])


@pytest.mark.parametrize(
    ("name", "events"),
    [
        ("Bubble Sort", {"compare", "swap"}),
        ("Selection Sort", {"compare", "swap"}),
        ("Insertion Sort", {"search", "shift", "write"}),
        ("Binary Search", {"search", "found"}),
        ("Linear Search", {"search", "found"}),
    ],
)
def test_supported_algorithm_trace(name, events):
    code = EXAMPLES[name]
    result = run_trace(code, "arr")
    assert_trace(result, code)
    assert result["steps"]
    assert result["error"] is None
    assert result["truncated"] is False
    assert result["steps"][-1]["array"] == [1, 2, 3, 4, 5]
    assert events <= {step["event"] for step in result["steps"]}
    assert all(step["error"] is None for step in result["steps"])
    if "Search" in name:
        assert result["steps"][-1]["locals"]["result"] == 3


def test_trace_snapshot_precedes_line_execution():
    code = "arr = [2, 1]\narr[0], arr[1] = arr[1], arr[0]\nfinal = arr[:]"
    result = run_trace(code, "arr")
    assert_trace(result, code)
    assert [(step["line"], step["array"], step["event"]) for step in result["steps"]] == [
        (2, [2, 1], "swap"), (3, [1, 2], "step"),
    ]


@pytest.mark.parametrize(
    ("code", "error_type", "error_line"),
    [("arr = [1]\nfor", "SyntaxError", 1), ("arr = [1]\nvalue = arr[9]", "IndexError", 2)],
)
def test_execution_errors(code, error_type, error_line):
    result = run_trace(code, "arr")
    assert_trace(result, code)
    assert result["truncated"] is False
    assert result["error"]["type"] == error_type
    assert result["error"]["line"] == error_line
    assert result["error"]["message"]
    if error_type == "SyntaxError":
        assert result["steps"] == []
    else:
        assert result["steps"][-1]["event"] == "error"
        assert result["steps"][-1]["error"] == result["error"]



def test_trace_truncation_protocol():
    code = "arr = [1]\nwhile True:\n    arr[0] += 1"
    result = run_trace(code, "arr", max_steps=4)
    assert_trace(result, code)
    assert result["total_steps"] == 4
    assert result["truncated"] is True
    assert result["error"] is None



def test_tracer_core_excludes_diagnostics_and_enrichment():
    assert AlgorithmTracer("arr = [1]", "arr").build_response() == {
        "trace_version": 1, "steps": [], "error": None, "total_steps": 0, "truncated": False,
    }


def test_selected_array_is_omitted_from_locals_only_when_represented():
    tracer = AlgorithmTracer("values = [1]", "values")
    assert tracer._snapshot_locals({"values": [1], "arr": [2], "i": 3}) == {"arr": [2], "i": 3}
    assert tracer._snapshot_locals({"values": (1,), "x": 4}) == {"x": 4}
    assert tracer._snapshot_locals({"values": "scalar", "x": 4}) == {"values": "scalar", "x": 4}


@pytest.mark.parametrize("container", [list, tuple])
def test_nested_array_and_other_locals_have_independent_historical_snapshots(container):
    tracer = AlgorithmTracer("arr = []", "arr")
    mutable = [[2, 1], {"key": [3]}]
    array = container(mutable)
    first = tracer._extract_array(array)
    locals_snapshot = tracer._snapshot_locals({"arr": array, "other": mutable, "i": 1})
    mutable[0][0] = 99
    mutable[1]["key"].append(4)
    assert first == [[2, 1], {"key": [3]}]
    assert locals_snapshot == {"other": [[2, 1], {"key": [3]}], "i": 1}


def test_primitive_snapshots_and_static_events_keep_trace_semantics(monkeypatch):
    tracer = AlgorithmTracer("arr = [2, 1]\nif arr[0] > arr[1]:\n    arr[0], arr[1] = arr[1], arr[0]", "arr")
    assert tracer.line_events == ["step", "compare", "swap"]
    values = [2, 1, "text", None, True]
    snapshot = tracer._extract_array(values)
    assert snapshot == values and snapshot is not values
    values[0] = 99
    assert snapshot[0] == 2
    monkeypatch.setattr(tracer, "_detect_event", lambda _: pytest.fail("Events must be precomputed"))
    from types import SimpleNamespace
    frame = SimpleNamespace(f_locals={"arr": [2, 1], "i": 0}, f_lineno=2)
    tracer._handle_line(frame)
    assert tracer.steps[0]["event"] == "compare"
    assert tracer.steps[0]["locals"] == {"i": 0}
