"""Agent 5 - Response formatter.

Turns the analyst's structured output into a polished Markdown response
with USD formatting, %, trend arrows, status badges, contextual CTAs and
an ET timestamp footer.

The formatter never fetches data itself - it works only with what the
analyst (and router context) provide.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")


def usd(n) -> str:
    try:
        return f"${float(n):,.2f}"
    except (TypeError, ValueError):
        return "—"


def pct(n) -> str:
    try:
        return f"{float(n):.1f}%"
    except (TypeError, ValueError):
        return "—"


def arrow(delta: float | None) -> str:
    if delta is None:
        return "→"
    if delta > 0.5:
        return "🔺"
    if delta < -0.5:
        return "🔻"
    return "→"


def status_badge(status: str) -> str:
    return {
        "settled": "🟢 Settled",
        "pending": "🟡 Pending",
        "failed": "🔴 Failed",
        "returned": "🟠 Returned",
        "provisional": "🔵 Provisional",
        "frozen": "🛑 Frozen",
        "on_hold": "⏸ On Hold",
        "active": "🟢 Active",
    }.get((status or "").lower(), f"⚪ {status}")


def now_et_str() -> str:
    return datetime.now(ET).strftime("%Y-%m-%d %H:%M:%S ET")


def format_response(analyst_out: dict, env_dict: dict) -> str:
    """Build a Markdown response from the analyst output.

    The analyst is expected to provide:
        title:   short headline
        body:    pre-rendered Markdown (skill is responsible for tables etc.)
        cta:     optional call-to-action line
        metrics: dict (for downstream validator + analytics)
    """
    if "error" in analyst_out:
        return f"⚠️ **Unable to process query**\n\n{analyst_out['error']}\n\n_{now_et_str()}_"

    title = analyst_out.get("title", "SettleIQ Response")
    body = analyst_out.get("body", "_(no content)_")
    cta = analyst_out.get("cta")

    parts = [f"### {title}", "", body]
    if cta:
        parts += ["", f"**Next step:** {cta}"]
    parts += ["", f"_Generated {now_et_str()} • domain: `{env_dict.get('domain', '—')}`_"]
    return "\n".join(parts)
