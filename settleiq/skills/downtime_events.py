"""UC6 - Bank / rail downtime lookup."""

from __future__ import annotations

import re

from . import _db
from agents.router import RouterEnvelope

RAIL_ALIASES = {
    "ACH": ["ach"],
    "Fedwire": ["fedwire", "wire"],
    "RTP": ["rtp"],
    "FedNow": ["fednow"],
    "Card_Network": ["card", "visa", "mastercard", "network"],
}


def _detect_rail(query: str) -> str | None:
    lq = query.lower()
    for rail, aliases in RAIL_ALIASES.items():
        if any(a in lq for a in aliases):
            return rail
    return None


def run(env: RouterEnvelope) -> dict:
    rail = _detect_rail(env.raw_query)
    conn = _db.connect()
    if rail:
        rows = conn.execute(
            "SELECT * FROM bank_downtime_events WHERE rail = ? ORDER BY start_ts DESC",
            (rail,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM bank_downtime_events ORDER BY start_ts DESC"
        ).fetchall()
    conn.close()

    if not rows:
        return {
            "title": "No downtime events",
            "body": f"No recorded outage windows{' for ' + rail if rail else ''} in the lookback.",
            "cta": None,
            "metrics": {"events": 0},
        }

    lines = [
        f"**Outage windows** {'• rail ' + rail if rail else '• all rails'}",
        "",
        "| Rail | Provider | Start (ET) | End (ET) | Duration | Note |",
        "|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['rail']} | {r['provider']} | {r['start_ts']} | {r['end_ts']} | "
            f"{r['duration_min']} min | {r['note']} |"
        )
    cta = "Cross-reference impacted MIDs by running: `Failures last 24 hours on {0}`.".format(rail or "ACH")
    return {
        "title": "Bank / Rail Downtime",
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {"events": len(rows), "rail_filter": rail},
    }
