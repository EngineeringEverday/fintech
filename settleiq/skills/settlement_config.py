"""UC4 - Settlement schedule / config + hardcoded rail timing rules."""

from __future__ import annotations

from . import _db
from agents.router import RouterEnvelope

RAIL_TIMING_RULES = """
**US Payment Rail Timing Rules**

| Rail | Cutoff (ET) | Credit posted (ET) | Notes |
|---|---|---|---|
| ACH T+0 same-day | 2:30 PM | 5:00 PM same business day | Same-day ACH window |
| ACH T+1 | 5:00 PM | 8:30 AM next business day | Standard ACH |
| ACH twice-daily — batch 1 | 10:00 AM | 1:00 PM | Intraday morning cycle |
| ACH twice-daily — batch 2 | 3:00 PM | 5:00 PM | Intraday afternoon cycle |
| Fedwire | M-F 9:00 AM – 6:00 PM | Real-time | No weekends/holidays |
| RTP (The Clearing House) | 24/7/365 | Typically ≤30 seconds | Irrevocable, push only |
""".strip()


def run(env: RouterEnvelope) -> dict:
    m = env.merchant
    if not m:
        # Return the rules even without a merchant - useful concept lookup
        return {
            "title": "Settlement Configuration",
            "body": RAIL_TIMING_RULES,
            "cta": "Add a merchant for a per-MID schedule (e.g. `Uber settlement schedule`).",
            "metrics": {},
        }

    conn = _db.connect()
    row = conn.execute(
        "SELECT * FROM merchant_registry WHERE mid = ?", (m["mid"],)
    ).fetchone()
    conn.close()
    if not row:
        return {"title": "Not found", "body": f"`{m['mid']}` missing.", "cta": None, "metrics": {}}

    body = (
        f"**{row['business_name']}** (`{row['mid']}`)\n\n"
        f"- Settlement type: **{row['settlement_type']}**\n"
        f"- Settlement schedule: **{row['settlement_schedule']}**\n"
        f"- Settlement frequency: **{row['settlement_frequency']}**\n"
        f"- Acquiring bank: {row['acquiring_bank']}\n"
        f"- Routing #: `{row['linked_routing_number']}` • Acct **** {row['linked_account_number_last4']}\n\n"
        + RAIL_TIMING_RULES
    )
    cta = "Need to change cadence? Open a request in the Settlement Config console."
    return {
        "title": f"Settlement Config — {row['business_name']}",
        "body": body,
        "cta": cta,
        "metrics": {
            "settlement_schedule": row["settlement_schedule"],
            "settlement_frequency": row["settlement_frequency"],
        },
    }
