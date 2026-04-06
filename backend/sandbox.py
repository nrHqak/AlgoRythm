import builtins
import sys
import threading
import traceback
from typing import Any

from tracer import AlgorithmTracer, TraceLimitReached

ALLOWED_IMPORTS = {"math", "random", "collections", "itertools", "functools"}
BLOCKED_IMPORTS = {"os", "sys", "subprocess", "socket", "shutil", "pathlib"}


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root_module = name.split(".")[0]
    if root_module in BLOCKED_IMPORTS or root_module not in ALLOWED_IMPORTS:
        raise ImportError(f"Import of '{root_module}' is not allowed in the sandbox.")
    return builtins.__import__(name, globals, locals, fromlist, level)


def execute_code(code: str, array_var: str, max_steps: int = 300, timeout: float = 2.0) -> dict[str, Any]:
    result: dict[str, Any] = {
        "steps": [],
        "error": None,
        "total_steps": 0,
        "truncated": False,
    }

    def runner() -> None:
        tracer = AlgorithmTracer(code, array_var, max_steps=max_steps)
        safe_builtins = dict(builtins.__dict__)
        safe_builtins["__import__"] = _safe_import
        exec_globals = {"__builtins__": safe_builtins, "__name__": "__main__"}

        try:
            compiled = compile(code, "<user_code>", "exec")
            sys.settrace(tracer.trace)
            exec(compiled, exec_globals, exec_globals)
        except TraceLimitReached:
            pass
        except Exception as exc:
            trace_line = _extract_user_line(traceback.extract_tb(exc.__traceback__))
            tracer.record_runtime_error(type(exc).__name__, str(exc), trace_line)
        finally:
            sys.settrace(None)
            result.update(tracer.build_response())

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    if thread.is_alive():
        return {
            "steps": [],
            "error": {
                "type": "timeout",
                "message": f"Execution exceeded {int(timeout)} seconds.",
                "line": 1,
            },
            "total_steps": 0,
            "truncated": False,
        }

    return result


def _extract_user_line(tb_summary) -> int | None:
    for frame in reversed(tb_summary):
        if frame.filename == "<user_code>":
            return frame.lineno
    return None
