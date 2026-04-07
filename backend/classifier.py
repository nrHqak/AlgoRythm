# classifier.py
# Place this file and algo_classifier.pkl in your FastAPI backend folder.
#
# Usage in main.py:
#   from classifier import classify_algorithm
#   result = classify_algorithm(req.code)
#   # result = { "algorithm": "bubble_sort", "confidence": 0.94, "probabilities": {...} }

import ast
import numpy as np
import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "algo_classifier.pkl"
_bundle = None

FEATURE_NAMES = [
    "num_for_loops", "num_while_loops", "max_nesting_depth",
    "num_if_statements", "num_assignments", "num_augmented_assigns",
    "num_comparisons", "has_swap_tuple", "has_break",
    "num_subscripts", "has_floor_div", "has_range_len",
    "nested_loop_depth", "num_bool_ops", "num_function_calls",
    "lines_of_code"
]


def _load():
    global _bundle
    if _bundle is None and MODEL_PATH.exists():
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def _extract(code: str) -> list:
    f = dict.fromkeys(FEATURE_NAMES, 0)
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return list(f.values())

    f["lines_of_code"] = len([l for l in code.strip().split("\n") if l.strip()])

    def depth(n, c=0):
        m = c
        for ch in ast.iter_child_nodes(n):
            m = max(m, depth(ch, c + 1) if isinstance(ch, (ast.For, ast.While, ast.If)) else depth(ch, c))
        return m

    def ldepth(n, c=0):
        m = c
        for ch in ast.iter_child_nodes(n):
            m = max(m, ldepth(ch, c + 1) if isinstance(ch, (ast.For, ast.While)) else ldepth(ch, c))
        return m

    f["max_nesting_depth"] = depth(tree)
    f["nested_loop_depth"] = ldepth(tree)

    for node in ast.walk(tree):
        if isinstance(node, ast.For):
            f["num_for_loops"] += 1
            if (isinstance(node.iter, ast.Call) and
                    isinstance(node.iter.func, ast.Name) and node.iter.func.id == "range"):
                for a in node.iter.args:
                    if isinstance(a, ast.Call) and isinstance(a.func, ast.Name) and a.func.id == "len":
                        f["has_range_len"] = 1
        elif isinstance(node, ast.While):      f["num_while_loops"] += 1
        elif isinstance(node, ast.If):          f["num_if_statements"] += 1
        elif isinstance(node, ast.Assign):
            f["num_assignments"] += 1
            if (len(node.targets) == 1 and isinstance(node.targets[0], ast.Tuple)
                    and isinstance(node.value, ast.Tuple)):
                f["has_swap_tuple"] = 1
        elif isinstance(node, ast.AugAssign):  f["num_augmented_assigns"] += 1
        elif isinstance(node, ast.Compare):    f["num_comparisons"] += 1
        elif isinstance(node, ast.BoolOp):     f["num_bool_ops"] += 1
        elif isinstance(node, ast.Break):      f["has_break"] = 1
        elif isinstance(node, ast.Subscript):  f["num_subscripts"] += 1
        elif isinstance(node, ast.BinOp):
            if isinstance(node.op, ast.FloorDiv): f["has_floor_div"] = 1
        elif isinstance(node, ast.Call):       f["num_function_calls"] += 1

    return list(f.values())


def classify_algorithm(code: str) -> dict:
    """
    Predict algorithm type from Python source code.
    Returns: { "algorithm": str, "confidence": float, "probabilities": dict }
    Falls back gracefully if model file not found.
    """
    b = _load()
    if b is None:
        return {"algorithm": "unknown", "confidence": 0.0, "probabilities": {}}

    vec   = np.array(_extract(code)).reshape(1, -1)
    pred  = b["model"].predict(vec)[0]
    probs = b["model"].predict_proba(vec)[0]
    label = b["label_encoder"].inverse_transform([pred])[0]

    return {
        "algorithm":     label,
        "confidence":    round(float(probs.max()), 3),
        "probabilities": {
            b["label_encoder"].inverse_transform([i])[0]: round(float(p), 3)
            for i, p in enumerate(probs)
        },
    }
