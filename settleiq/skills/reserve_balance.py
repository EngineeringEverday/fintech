"""UC5 - Reserve account balance lookup."""

from __future__ import annotations

from . import _db
from agents.router import RouterEnvelope


def _fmt_usd(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return "—"


def run(env: RouterEnvelope) -> dict:
    m = env.merchant
    if not m:
        return {
            "title": "Merchant required",
            "body": "Add a merchant name or MID to look up reserve balance.",
            "cta": "Example: `Reserve balance for Coinbase`",
            "metrics": {},
        }
    conn = _db.connect()
    row = conn.execute(
        "SELECT * FROM merchant_registry WHERE mid = ?", (m["mid"],)
    ).fetchone()
    conn.close()
    if not row:
        return {"title": "Merchant not found", "body": f"`{m['mid']}` not in registry.", "cta": None, "metrics": {}}

    bal = row["reserve_account_balance_usd"]
    badge = "🟢" if bal > 50_000 else ("🟡" if bal > 0 else "🔴")
    note = ""
    if bal < 0:
        note = "\n\n⚠️ **Reserve balance is negative.** Risk Operations alerting will fire."
    elif bal < 10_000:
        note = "\n\n_Reserve below safety floor — consider top-up._"
    body = (
        f"**{row['business_name']}** (`{row['mid']}`)\n\n"
        f"Reserve balance: {badge} **{_fmt_usd(bal)}**\n\n"
        f"Risk tier: `{row['risk_tier']}` • Settlement type: `{row['settlement_type']}`{note}"
    )
    cta = "Top up reserve" if bal < 10_000 else "No action required"
    return {
        "title": "Reserve Balance",
        "body": body,
        "cta": cta,
        "metrics": {"reserve_balance_usd": bal},
    }
