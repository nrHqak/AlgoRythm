"""Regression guards for the browser's execution policy and frozen v1 traces."""
import json
from pathlib import Path

import pytest
from browser_trace import SAFE_BUILTIN_NAMES, execute_trace

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((ROOT / "tests/fixtures/browser_traces.json").read_text())


def test_browser_builtin_policy():
    assert SAFE_BUILTIN_NAMES == {
        "abs", "all", "any", "bool", "dict", "enumerate", "float", "int", "isinstance",
        "len", "list", "max", "min", "pow", "print", "range", "repr", "reversed", "round",
        "set", "sorted", "str", "sum", "tuple", "zip",
    }
    for source in ["import os", "open('file')", "eval('1')", "exec('pass')"]:
        assert json.loads(execute_trace(source, "arr"))["error"] is not None


@pytest.mark.parametrize("case", [c for c in CASES if c["name"] != "Timeout"], ids=lambda c: c["name"])
def test_browser_trace_matches_frozen_v1(case):
    assert json.loads(execute_trace(case["code"], case["arrayVar"], case["maxSteps"])) == case["expected"]
