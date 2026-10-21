PYTHON ?= python3
VENV ?= .venv
VENV_PYTHON := $(VENV)/bin/python
VENV_PIP := $(VENV)/bin/pip

.PHONY: setup dev-backend dev-frontend lint test test-context build check context context-check context-strict

setup: $(VENV_PYTHON)
	$(VENV_PIP) install -r backend/requirements-dev.txt
	npm --prefix frontend ci

$(VENV_PYTHON):
	$(PYTHON) -m venv $(VENV)

dev-backend: $(VENV_PYTHON)
	cd backend && ../$(VENV_PYTHON) -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	npm --prefix frontend run dev

lint: $(VENV_PYTHON)
	$(VENV_PYTHON) -m ruff check backend frontend/src/runtime scripts tests
	npm --prefix frontend run lint

test: $(VENV_PYTHON)
	$(VENV_PYTHON) -m pytest
	npm --prefix frontend run test
	$(MAKE) test-context

test-context:
	$(PYTHON) -m unittest discover -s tests -p 'test_context_*.py'

build: $(VENV_PYTHON)
	$(VENV_PYTHON) -m py_compile backend/main.py backend/mentor.py backend/classifier.py frontend/src/runtime/tracer.py frontend/src/runtime/browser_trace.py
	npm --prefix frontend run build

check: lint test build context-check

context:
	$(PYTHON) scripts/context_map.py --write

context-check:
	$(PYTHON) scripts/context_map.py --check

context-strict:
	$(PYTHON) scripts/context_map.py --strict
