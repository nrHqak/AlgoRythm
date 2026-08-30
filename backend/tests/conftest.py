from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Tests must not read developer-local .env files.
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
