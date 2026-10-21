"""Pyodide runner. AlgorithmTracer is loaded from the canonical browser runtime source.

Executes only inside the Web Worker. Timeout/termination is owned by its manager.
"""

import builtins
import json
import sys
import traceback
from typing import Any

from tracer import AlgorithmTracer, TraceLimitReached

SAFE_BUILTIN_NAMES = {
    "abs",
    "all",
    "any",
    "bool",
    "dict",
    "enumerate",
    "float",
    "int",
    "isinstance",
    "len",
    "list",
    "max",
    "min",
    "pow",
    "print",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
}


def _build_exec_globals() -> dict[str, Any]:
    import collections
    import functools
    import itertools
    import math
    import random

    safe_builtins = {name: getattr(builtins, name) for name in SAFE_BUILTIN_NAMES}
    safe_builtins.update(
        {
            "math": math,
            "random": random,
            "collections": collections,
            "itertools": itertools,
            "functools": functools,
        }
    )
    return {
        "__builtins__": safe_builtins,
        "__name__": "__main__",
    }



class CountTracer(AlgorithmTracer):
    """Internal complexity measurement with the same eligible-line semantics.

    No arrays, locals, highlights, event regexes, or visualization objects are
    snapshotted. The worker deadline also bounds code before an array exists.
    """

    def __init__(self, array_var: str, max_steps: int) -> None:
        self.array_var = array_var
        self.max_steps = max_steps
        self.count = 0
        self.error = None
        self.truncated = False
        self._error_recorded = False

    def _handle_line(self, frame) -> None:
        value = frame.f_locals.get(self.array_var)
        if not isinstance(value, (list, tuple)) or (not value and self.count):
            return
        self.count += 1
        if self.count >= self.max_steps:
            self.truncated = True
            raise TraceLimitReached()

    def _handle_exception(self, frame, arg) -> None:
        if self._error_recorded:
            return
        exc_type, exc_value, _ = arg
        self.error = {"type": exc_type.__name__, "message": str(exc_value), "line": frame.f_lineno}
        self._error_recorded = True
        if isinstance(frame.f_locals.get(self.array_var), (list, tuple)):
            self.count += 1

    def build_response(self) -> dict[str, Any]:
        return {"count": self.count, "error": self.error, "truncated": self.truncated}


def execute_trace(code: str, array_var: str, max_steps: int = 300, mode: str = "trace") -> str:
    if mode not in ("trace", "count"):
        raise ValueError("Invalid execution mode")
    tracer = (CountTracer(array_var, max_steps) if mode == "count"
              else AlgorithmTracer(code, array_var, max_steps=max_steps))
    try:
        compiled = compile(code, "<user_code>", "exec")
        exec_globals = _build_exec_globals()
        sys.settrace(tracer.trace)
        exec(compiled, exec_globals, exec_globals)
    except TraceLimitReached:
        pass
    except MemoryError:
        tracer.record_runtime_error("MemoryError", "Execution exceeded the sandbox memory limit.", 1)
    except Exception as exc:
        line = next((frame.lineno for frame in reversed(traceback.extract_tb(exc.__traceback__))
                     if frame.filename == "<user_code>"), None)
        tracer.record_runtime_error(type(exc).__name__, str(exc), line)
    finally:
        sys.settrace(None)
    return json.dumps(tracer.build_response())
