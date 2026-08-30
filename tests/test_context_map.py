from __future__ import annotations

import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/context_map.py"


def load_context_map():
    spec = importlib.util.spec_from_file_location("context_map", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load context_map.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


context_map = load_context_map()


class ContextMapTests(unittest.TestCase):
    def test_generation_is_deterministic(self):
        self.assertEqual(context_map.generate(), context_map.generate())

    def test_generated_content_contains_routes_but_not_local_secret_value(self):
        secret_value = "context-map-must-not-leak-this-value"
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            secret_path = Path(temporary) / ".env"
            secret_path.write_text(f"DO_NOT_EMIT={secret_value}\n", encoding="utf-8")
            generated = context_map.generate()

        self.assertIn("`/analyze`", generated)
        self.assertNotIn(secret_value, generated)
        self.assertNotIn("DO_NOT_EMIT", generated)

    def test_index_links_exist(self):
        self.assertEqual(context_map.validate_index_links(), [])

    def test_check_warns_without_failing_when_output_drifts(self):
        with mock.patch.object(context_map, "OUTPUT") as output:
            output.exists.return_value = True
            output.read_text.return_value = "stale\n"
            with mock.patch.object(sys, "argv", [str(SCRIPT), "--check"]):
                with redirect_stderr(io.StringIO()):
                    self.assertEqual(context_map.main(), 0)

    def test_strict_fails_when_output_drifts(self):
        with mock.patch.object(context_map, "OUTPUT") as output:
            output.exists.return_value = True
            output.read_text.return_value = "stale\n"
            with mock.patch.object(sys, "argv", [str(SCRIPT), "--strict"]):
                with redirect_stderr(io.StringIO()):
                    self.assertEqual(context_map.main(), 1)

    def test_real_cli_check_does_not_receive_environment_values(self):
        environment = os.environ.copy()
        environment["UNTRACKED_TEST_SECRET"] = "never-render-this"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--check"],
            cwd=ROOT,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertNotIn(environment["UNTRACKED_TEST_SECRET"], result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
