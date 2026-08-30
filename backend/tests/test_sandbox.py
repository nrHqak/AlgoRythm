from __future__ import annotations

import pytest

from sandbox import execute_code


@pytest.mark.parametrize(
    ("code", "error_type"),
    [
        ("arr = [1, 2]\nfor", "SyntaxError"),
        ("arr = [1]\nvalue = 1 / 0", "ZeroDivisionError"),
    ],
)
def test_sandbox_returns_structured_errors(code, error_type):
    result = execute_code(code, "arr")

    assert result["error"]["type"] == error_type
    assert isinstance(result["error"]["line"], int)


def test_sandbox_executes_and_traces_valid_code():
    result = execute_code(
        "arr = [3, 1]\narr[0], arr[1] = arr[1], arr[0]",
        "arr",
    )

    assert result["error"] is None
    assert result["total_steps"] >= 1
    assert result["steps"][-1]["array"] in ([3, 1], [1, 3])


def test_sandbox_terminates_runaway_code():
    result = execute_code("while True:\n    pass", "missing_array", timeout=0.1)

    assert result["error"]["type"] == "timeout"
    assert result["steps"] == []


def test_sandbox_marks_trace_limit():
    code = "arr = [5, 4, 3]\nfor i in range(100):\n    arr[0] = i"

    result = execute_code(code, "arr", max_steps=4)

    assert result["truncated"] is True
    assert result["total_steps"] == 4
