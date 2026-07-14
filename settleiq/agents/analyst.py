"""Agent 3 - Data analyst.

Lazy-loads the appropriate skill module based on the router envelope and
runs it. Skills return structured dicts of metrics + a 'context' payload.

This module is intentionally thin - the SQL lives in each skill so they
can be reused independently.
"""

from __future__ import annotations

import importlib
from typing import Any

from agents.router import RouterEnvelope


def analyze(env: RouterEnvelope) -> dict[str, Any]:
    """Dispatch to the right skill module and return structured output."""
    try:
        mod = importlib.import_module(env.skill_path)
    except ModuleNotFoundError as e:
        return {"error": f"Skill module not found: {env.skill_path} ({e})"}
    fn = getattr(mod, env.skill_entry, None)
    if fn is None:
        return {"error": f"Entry '{env.skill_entry}' missing on {env.skill_path}"}
    try:
        return fn(env)
    except Exception as e:  # pragma: no cover - guard
        return {"error": f"Skill execution failed: {type(e).__name__}: {e}"}
