import builtins
import multiprocessing
import platform
import queue
import resource
import sys
import traceback
from typing import Any

from tracer import AlgorithmTracer, TraceLimitReached

MEMORY_LIMIT_BYTES = 256 * 1024 * 1024
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


def _empty_response(error: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "steps": [],
        "error": error,
        "total_steps": 0,
        "truncated": False,
    }


def _apply_resource_limits() -> None:
    if platform.system() != "Linux":
        return

    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))


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


def _sandbox_worker(code: str, array_var: str, max_steps: int, result_queue: multiprocessing.Queue) -> None:
    tracer = AlgorithmTracer(code, array_var, max_steps=max_steps)

    try:
        _apply_resource_limits()
        compiled = compile(code, "<user_code>", "exec")
        exec_globals = _build_exec_globals()
        sys.settrace(tracer.trace)
        exec(compiled, exec_globals, exec_globals)
    except TraceLimitReached:
        pass
    except MemoryError:
        tracer.record_runtime_error("MemoryError", "Execution exceeded the sandbox memory limit.", 1)
    except Exception as exc:
        trace_line = _extract_user_line(traceback.extract_tb(exc.__traceback__))
        tracer.record_runtime_error(type(exc).__name__, str(exc), trace_line)
    finally:
        sys.settrace(None)
        result_queue.put(tracer.build_response())


def execute_code(code: str, array_var: str, max_steps: int = 300, timeout: float = 2.0) -> dict[str, Any]:
    result_queue: multiprocessing.Queue = multiprocessing.Queue(maxsize=1)
    process = multiprocessing.Process(target=_sandbox_worker, args=(code, array_var, max_steps, result_queue))
    process.start()
    process.join(timeout=timeout)

    if process.is_alive():
        process.terminate()
        process.join(timeout=0.5)
        if process.is_alive():
            process.kill()
            process.join(timeout=0.5)
        return _empty_response(
            {
                "type": "timeout",
                "message": f"Execution exceeded {int(timeout)} seconds.",
                "line": 1,
            }
        )

    try:
        return result_queue.get(timeout=0.2)
    except queue.Empty:
        return _empty_response(
            {
                "type": "sandbox_error",
                "message": "Sandbox process exited without returning a result.",
                "line": 1,
            }
        )



def _extract_user_line(tb_summary) -> int | None:
    for frame in reversed(tb_summary):
        if frame.filename == "<user_code>":
            return frame.lineno
    return None
