"""UC7 - 30-day rolling trend analysis with insight summary."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import _db
from agents.router import RouterEnvelope


def _fmt_pct(v) -> str:
    try:
        return f"{float(v):.1f}%"
    except Exception:
        return "—"


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
            "body": "Trend analysis needs a merchant name or MID.",
            "cta": "Example: `Airbnb settlement trend last 30 days`",
            "metrics": {},
        }

    # default 30 days
    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    conn = _db.connect()
    rows = conn.execute(
        """SELECT * FROM settlement_events
           WHERE merchant_id = ? AND initiated_at >= ?""",
        (m["mid"], start),
    ).fetchall()
    conn.close()

    if not rows:
        return {
            "title": f"No trend data — {m['name']}",
            "body": "No settlement activity in the last 30 days for this merchant.",
            "cta": None,
            "metrics": {},
        }

    total = len(rows)
    total_amt = sum(r["amount_usd"] for r in rows)

    settle_times = []
    for r in rows:
        if r["status"] == "settled" and r["settled_at"]:
            try:
                a = datetime.strptime(r["initiated_at"], "%Y-%m-%d %H:%M:%S")
                b = datetime.strptime(r["settled_at"], "%Y-%m-%d %H:%M:%S")
                settle_times.append((b - a).total_seconds())
            except Exception:
                pass
    avg_settle = sum(settle_times) / len(settle_times) if settle_times else 0

    codes: dict[str, int] = {}
    routing_fail: dict[str, int] = {}
    bank_fail: dict[str, int] = {}
    fails = 0
    prov_count = 0
    for r in rows:
        if r["status"] in ("failed", "returned"):
            fails += 1
            codes[r["return_code"] or "—"] = codes.get(r["return_code"] or "—", 0) + 1
            routing_fail[r["aba_routing_number"] or "—"] = routing_fail.get(r["aba_routing_number"] or "—", 0) + 1
        if r["is_provisional_credit"]:
            prov_count += 1
    failure_rate = 100.0 * fails / total

    # acquiring bank failure rate via join
    conn = _db.connect()
    bank_row = conn.execute(
        "SELECT acquiring_bank FROM merchant_registry WHERE mid = ?", (m["mid"],)
    ).fetchone()
    conn.close()
    bank = bank_row["acquiring_bank"] if bank_row else "—"
    bank_fail[bank] = fails

    top_codes = sorted(codes.items(), key=lambda x: -x[1])[:3]
    top_routes = sorted(routing_fail.items(), key=lambda x: -x[1])[:3]

    insight_bits = []
    if failure_rate > 10:
        insight_bits.append(f"⚠️ Failure rate **{failure_rate:.1f}%** is elevated (>10%).")
    elif failure_rate < 2:
        insight_bits.append(f"✅ Failure rate **{failure_rate:.1f}%** is healthy.")
    else:
        insight_bits.append(f"Failure rate **{failure_rate:.1f}%** is within normal range.")
    if avg_settle > 0:
        h = avg_settle / 3600
        if h > 4:
            insight_bits.append(f"🐢 Avg settlement time **{h:.1f}h** is slow.")
        else:
            insight_bits.append(f"⏱ Avg settlement time **{h:.1f}h**.")
    if prov_count / total > 0.10:
        insight_bits.append(f"🔵 Provisional rate **{100*prov_count/total:.1f}%** — investigate funding lag.")

    lines = [
        f"**{m['name']}** (`{m['mid']}`) — rolling 30-day trend  |  Acquiring bank: {bank}",
        "",
        f"- Settlement volume: **{total}** events  |  Gross: **{_fmt_usd(total_amt)}**",
        f"- Avg settlement time: **{(avg_settle/3600):.2f} hours**",
        f"- Failure rate: **{_fmt_pct(failure_rate)}**",
        f"- Provisional credits: **{prov_count}** ({100*prov_count/total:.1f}%)",
        "",
        "**Top return codes:**",
        "",
    ]
    if top_codes:
        lines.append("| Code | Count |")
        lines.append("|---|---|")
        for c, n in top_codes:
            lines.append(f"| `{c}` | {n} |")
    else:
        lines.append("_No failure codes in window._")
    lines += ["", "**Top routing numbers with failures:**", ""]
    if top_routes:
        lines.append("| Routing # | Failures |")
        lines.append("|---|---|")
        for rn, n in top_routes:
            lines.append(f"| `{rn}` | {n} |")
    else:
        lines.append("_No routing-level failures._")

    lines += ["", "**Insight summary:** " + " ".join(insight_bits)]

    cta = "Schedule weekly trend digest via the MIS report button on the Observer Portal."
    return {
        "title": f"30-Day Trend — {m['name']}",
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {
            "events": total,
            "total_amount_usd": total_amt,
            "max_amount_usd": max(r["amount_usd"] for r in rows),
            "avg_settlement_seconds": avg_settle,
            "failure_rate_pct": failure_rate,
            "provisional_rate_pct": 100 * prov_count / total,
        },
    }
