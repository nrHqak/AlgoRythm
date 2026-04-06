import copy
import re
from typing import Any


class TraceLimitReached(Exception):
    """Raised internally to stop execution after the trace limit."""


class AlgorithmTracer:
    def __init__(self, source_code: str, array_var: str, max_steps: int = 300) -> None:
        self.source_lines = source_code.splitlines()
        self.array_var = array_var
        self.max_steps = max_steps
        self.steps: list[dict[str, Any]] = []
        self.error: dict[str, Any] | None = None
        self.truncated = False
        self._error_recorded = False

    def trace(self, frame, event, arg):
        if frame.f_code.co_filename != "<user_code>":
            return self.trace

        if event == "line":
            self._handle_line(frame)
        elif event == "exception":
            self._handle_exception(frame, arg)

        return self.trace

    def _handle_line(self, frame) -> None:
        if self.array_var not in frame.f_locals:
            return

        array_value = self._extract_array(frame.f_locals.get(self.array_var))
        if array_value is None:
            return
        if len(array_value) == 0 and self.steps:
            return

        line_number = frame.f_lineno
        locals_snapshot = self._snapshot_locals(frame.f_locals)
        event_type = self._detect_event(self._get_source_line(line_number))
        highlights = self._extract_highlights(frame.f_locals, len(array_value))

        self.steps.append(
            {
                "step": len(self.steps),
                "line": line_number,
                "event": event_type,
                "array": array_value,
                "highlights": highlights,
                "locals": locals_snapshot,
                "error": None,
            }
        )

        if len(self.steps) >= self.max_steps:
            self.truncated = True
            raise TraceLimitReached()

    def _handle_exception(self, frame, arg) -> None:
        if self._error_recorded:
            return

        exc_type, exc_value, _ = arg
        line_number = frame.f_lineno
        array_value = self._extract_array(frame.f_locals.get(self.array_var))
        locals_snapshot = self._snapshot_locals(frame.f_locals)
        highlights = self._extract_highlights(frame.f_locals, len(array_value or []))
        error_payload = {
            "type": exc_type.__name__,
            "message": str(exc_value),
            "line": line_number,
        }

        self.error = error_payload
        self._error_recorded = True

        if array_value is not None:
            self.steps.append(
                {
                    "step": len(self.steps),
                    "line": line_number,
                    "event": "error",
                    "array": array_value,
                    "highlights": highlights,
                    "locals": locals_snapshot,
                    "error": error_payload,
                }
            )

    def build_response(self) -> dict[str, Any]:
        return {
            "steps": self.steps,
            "error": self.error,
            "total_steps": len(self.steps),
            "truncated": self.truncated,
        }

    def record_runtime_error(self, exc_type: str, message: str, line_number: int | None) -> None:
        if self.error is not None:
            return

        self.error = {
            "type": exc_type,
            "message": message,
            "line": line_number or 1,
        }

    def _get_source_line(self, line_number: int) -> str:
        if 1 <= line_number <= len(self.source_lines):
            return self.source_lines[line_number - 1].strip()
        return ""

    def _detect_event(self, source_line: str) -> str:
        if self._is_swap_line(source_line):
            return "swap"
        if self._is_compare_line(source_line):
            return "compare"
        return "step"

    def _is_compare_line(self, source_line: str) -> bool:
        pattern = re.compile(rf"{re.escape(self.array_var)}\[[^\]]+\]")
        return "if" in source_line and len(pattern.findall(source_line)) >= 2

    def _is_swap_line(self, source_line: str) -> bool:
        escaped = re.escape(self.array_var)
        pattern = re.compile(
            rf"^\s*{escaped}\[(?P<a>[^\]]+)\]\s*,\s*{escaped}\[(?P<b>[^\]]+)\]\s*=\s*"
            rf"{escaped}\[(?P=b)\]\s*,\s*{escaped}\[(?P=a)\]\s*$"
        )
        return bool(pattern.match(source_line))

    def _extract_array(self, value: Any) -> list[Any] | None:
        if isinstance(value, list):
            return copy.deepcopy(value)
        if isinstance(value, tuple):
            return list(value)
        return None

    def _extract_highlights(self, local_vars: dict[str, Any], array_length: int) -> list[int]:
        highlights: list[int] = []
        for name in ("i", "j"):
            value = local_vars.get(name)
            if isinstance(value, int):
                if array_length > 0:
                    clamped = min(max(value, 0), array_length - 1)
                    if clamped not in highlights:
                        highlights.append(clamped)
                elif value not in highlights:
                    highlights.append(value)
        return highlights

    def _snapshot_locals(self, local_vars: dict[str, Any]) -> dict[str, Any]:
        snapshot: dict[str, Any] = {}
        for key, value in local_vars.items():
            if key.startswith("__"):
                continue
            snapshot[key] = self._sanitize_value(value)
        return snapshot

    def _sanitize_value(self, value: Any) -> Any:
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        if isinstance(value, list):
            return [self._sanitize_value(item) for item in value]
        if isinstance(value, tuple):
            return [self._sanitize_value(item) for item in value]
        if isinstance(value, dict):
            return {str(key): self._sanitize_value(val) for key, val in value.items()}
        return repr(value)
