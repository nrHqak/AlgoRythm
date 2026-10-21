#!/usr/bin/env python3
"""Generate a deterministic, secret-safe structural map of the repository."""

from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/context/REPOSITORY_MAP.md"
OUTPUT_RELATIVE = OUTPUT.relative_to(ROOT).as_posix()

EXCLUDED_PARTS = {
    ".git",
    ".idea",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
    "venv",
}
EXCLUDED_SUFFIXES = {
    ".DS_Store",
    ".coverage",
    ".jpg",
    ".jpeg",
    ".lockb",
    ".pkl",
    ".png",
    ".pyc",
    ".svg",
    ".webp",
}
HTTP_METHODS = {"delete", "get", "head", "options", "patch", "post", "put"}
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def repository_files() -> list[Path]:
    """Return tracked and non-ignored working-tree files in stable order."""
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    paths: list[Path] = []
    for raw_path in result.stdout.decode().split("\0"):
        if not raw_path or raw_path == OUTPUT_RELATIVE:
            continue
        relative = Path(raw_path)
        if any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if relative.suffix.lower() in EXCLUDED_SUFFIXES or relative.name in EXCLUDED_SUFFIXES:
            continue
        absolute = ROOT / relative
        if absolute.is_file() and not is_secret_file(relative):
            paths.append(relative)
    return sorted(paths, key=lambda path: path.as_posix())


def is_secret_file(path: Path) -> bool:
    name = path.name.lower()
    if name.endswith(".env.example"):
        return False
    return name == ".env" or name.endswith(".env")


def read_text(relative: Path) -> str:
    return (ROOT / relative).read_text(encoding="utf-8", errors="replace")


def render_top_level(files: list[Path]) -> list[str]:
    counts = Counter(path.parts[0] for path in files)
    lines = ["## Repository shape", ""]
    for name in sorted(counts):
        suffix = "/" if (ROOT / name).is_dir() else ""
        lines.append(f"- `{name}{suffix}`: {counts[name]} mapped file(s)")
    return lines


def render_entrypoints(files: list[Path]) -> list[str]:
    candidates = [
        ("Frontend mount", "frontend/src/main.jsx"),
        ("Frontend routes/providers", "frontend/src/App.jsx"),
        ("Backend application", "backend/main.py"),
        ("Browser execution adapter", "frontend/src/execution/browserEngine.js"),
        ("Python worker", "frontend/src/runtime/python.worker.js"),
        ("Browser execution tracer", "frontend/src/runtime/tracer.py"),
        ("Algorithm classifier", "backend/classifier.py"),
        ("Mentor provider boundary", "backend/mentor.py"),
        ("Frontend deployment", "frontend/vercel.json"),
        ("Backend deployment", "render.yaml"),
    ]
    available = {path.as_posix() for path in files}
    lines = ["## Entrypoints", ""]
    lines.extend(f"- {label}: `{path}`" for label, path in candidates if path in available)
    return lines


def decorator_route(decorator: ast.expr) -> tuple[str, str] | None:
    if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
        return None
    method = decorator.func.attr.lower()
    if method not in HTTP_METHODS or not decorator.args:
        return None
    route_arg = decorator.args[0]
    if not isinstance(route_arg, ast.Constant) or not isinstance(route_arg.value, str):
        return None
    return method.upper(), route_arg.value


def annotation_name(annotation: ast.expr | None) -> str:
    if isinstance(annotation, ast.Name):
        return annotation.id
    if isinstance(annotation, ast.Subscript):
        return annotation_name(annotation.value)
    if isinstance(annotation, ast.Attribute):
        return annotation.attr
    return ""


def extract_backend(files: list[Path]) -> tuple[list[tuple[str, str, str, str]], dict[str, list[str]]]:
    routes: list[tuple[str, str, str, str]] = []
    models: dict[str, list[str]] = {}
    for relative in files:
        if relative.parent != Path("backend") or relative.suffix != ".py":
            continue
        try:
            tree = ast.parse(read_text(relative))
        except SyntaxError:
            continue
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and any(annotation_name(base) == "BaseModel" for base in node.bases):
                fields = [
                    child.target.id
                    for child in node.body
                    if isinstance(child, ast.AnnAssign) and isinstance(child.target, ast.Name)
                ]
                models[node.name] = fields
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                payload_types = [
                    annotation_name(argument.annotation)
                    for argument in [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
                ]
                request_model = next(
                    (name for name in payload_types if name != "Request" and name.endswith("Request")),
                    "—",
                )
                for decorator in node.decorator_list:
                    route = decorator_route(decorator)
                    if route:
                        routes.append((route[0], route[1], node.name, request_model))
    return sorted(routes, key=lambda item: (item[1], item[0])), dict(sorted(models.items()))


def render_backend(files: list[Path]) -> list[str]:
    routes, models = extract_backend(files)
    lines = [
        "## Backend HTTP surface",
        "",
        "| Method | Path | Handler | Request model |",
        "| --- | --- | --- | --- |",
    ]
    lines.extend(f"| `{method}` | `{path}` | `{handler}` | `{model}` |" for method, path, handler, model in routes)
    lines.extend(["", "### Pydantic request fields", ""])
    lines.extend(f"- `{name}`: {', '.join(f'`{field}`' for field in fields)}" for name, fields in models.items())
    return lines


def render_frontend(files: list[Path]) -> list[str]:
    source_files = [
        path
        for path in files
        if path.as_posix().startswith("frontend/src/") and path.suffix in {".js", ".jsx"}
    ]
    routes: set[str] = set()
    exports: list[tuple[str, list[str]]] = []
    route_re = re.compile(r"\bpath=[\"']([^\"']+)[\"']")
    export_re = re.compile(r"\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*)")
    for relative in source_files:
        text = read_text(relative)
        routes.update(route_re.findall(text))
        names = sorted(set(export_re.findall(text)))
        if names:
            exports.append((relative.as_posix(), names))
    lines = ["## Frontend surface", "", "### Routes", ""]
    lines.extend(f"- `{route}`" for route in sorted(routes))
    lines.extend(["", "### Exported modules", ""])
    lines.extend(f"- `{path}`: {', '.join(f'`{name}`' for name in names)}" for path, names in exports)
    return lines


def render_migrations(files: list[Path]) -> list[str]:
    migrations = [path for path in files if path.as_posix().startswith("supabase/") and path.suffix == ".sql"]
    table_re = re.compile(r"\bpublic\.([a-zA-Z_][a-zA-Z0-9_]*)\b", re.IGNORECASE)
    lines = ["## Supabase SQL", ""]
    for relative in migrations:
        tables = sorted(set(table_re.findall(read_text(relative))))
        rendered = ", ".join(f"`{table}`" for table in tables) or "no explicit `public.*` table reference"
        lines.append(f"- `{relative.as_posix()}`: {rendered}")
    return lines


def environment_names(files: list[Path]) -> dict[str, set[str]]:
    names: dict[str, set[str]] = {"Backend": set(), "Frontend": set(), "Other": set()}
    patterns = [
        re.compile(r"os\.environ\.get\(\s*[\"']([A-Z][A-Z0-9_]*)[\"']"),
        re.compile(r"os\.getenv\(\s*[\"']([A-Z][A-Z0-9_]*)[\"']"),
        re.compile(r"import\.meta\.env\.([A-Z][A-Z0-9_]*)"),
    ]
    example_re = re.compile(r"^([A-Z][A-Z0-9_]*)=", re.MULTILINE)
    for relative in files:
        if relative.suffix not in {".js", ".jsx", ".py"} and not relative.name.endswith(".env.example"):
            continue
        text = read_text(relative)
        found = set(example_re.findall(text))
        for pattern in patterns:
            found.update(pattern.findall(text))
        bucket = "Frontend" if relative.parts[0] == "frontend" else "Backend" if relative.parts[0] == "backend" else "Other"
        names[bucket].update(found)
    return names


def render_environment(files: list[Path]) -> list[str]:
    names = environment_names(files)
    lines = [
        "## Environment variable names",
        "",
        "> Names only. The generator never reads ignored `.env` files or emits values.",
        "",
    ]
    for bucket in ("Backend", "Frontend", "Other"):
        if names[bucket]:
            lines.append(f"- {bucket}: {', '.join(f'`{name}`' for name in sorted(names[bucket]))}")
    return lines


def render_commands(files: list[Path]) -> list[str]:
    lines = ["## Commands", ""]
    package_path = ROOT / "frontend/package.json"
    if Path("frontend/package.json") in files:
        scripts = json.loads(package_path.read_text(encoding="utf-8")).get("scripts", {})
        lines.append("### Frontend npm scripts")
        lines.append("")
        lines.extend(f"- `npm --prefix frontend run {name}` → `{command}`" for name, command in sorted(scripts.items()))
    makefile = ROOT / "Makefile"
    if Path("Makefile") in files:
        target_re = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):(?:\s|$)", re.MULTILINE)
        targets = sorted(set(target_re.findall(makefile.read_text(encoding="utf-8"))))
        lines.extend(["", "### Root Make targets", ""])
        lines.extend(f"- `make {target}`" for target in targets)
    return lines


def validate_index_links() -> list[str]:
    index = ROOT / "AI_CONTEXT.md"
    if not index.exists():
        return ["AI_CONTEXT.md is missing"]
    errors: list[str] = []
    for target in MARKDOWN_LINK_RE.findall(index.read_text(encoding="utf-8")):
        if target.startswith(("http://", "https://", "#")):
            continue
        clean_target = target.split("#", 1)[0]
        if clean_target == OUTPUT_RELATIVE:
            continue
        if clean_target and not (ROOT / clean_target).exists():
            errors.append(f"AI_CONTEXT.md link target does not exist: {clean_target}")
    return errors


def generate() -> str:
    files = repository_files()
    sections = [
        [
            "# Repository map",
            "",
            "> Generated by `scripts/context_map.py`. Do not edit by hand. No secret values are read or emitted.",
            "",
        ],
        render_top_level(files),
        render_entrypoints(files),
        render_backend(files),
        render_frontend(files),
        render_migrations(files),
        render_environment(files),
        render_commands(files),
    ]
    return "\n\n".join("\n".join(section).rstrip() for section in sections) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="write the generated map (default)")
    mode.add_argument("--check", action="store_true", help="warn on drift and exit successfully")
    mode.add_argument("--strict", action="store_true", help="fail on drift")
    args = parser.parse_args()

    link_errors = validate_index_links()
    if link_errors:
        for error in link_errors:
            print(f"context error: {error}", file=sys.stderr)
        return 1

    expected = generate()
    current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
    drifted = current != expected

    if args.check:
        if drifted:
            print("WARNING: docs/context/REPOSITORY_MAP.md is stale; run `make context`.", file=sys.stderr)
        else:
            print("Context map is current.")
        return 0

    if args.strict:
        if drifted:
            print("ERROR: docs/context/REPOSITORY_MAP.md is stale; run `make context`.", file=sys.stderr)
            return 1
        print("Context map is current.")
        return 0

    if drifted:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(expected, encoding="utf-8")
        print(f"Updated {OUTPUT_RELATIVE}.")
    else:
        print(f"Unchanged {OUTPUT_RELATIVE}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
