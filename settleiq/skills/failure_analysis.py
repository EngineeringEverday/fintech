"""UC8 - Failure diagnostics with contextual CTAs."""

from __future__ import annotations

from . import _db
from agents.router import RouterEnvelope


CTA_MAP = {
    "R01": "Account had insufficient funds — re-attempt after 2 business days OR switch payout rail to RTP/FedNow.",
    "R03": "Account number invalid — re-collect routing/account details from merchant onboarding flow.",
    "R04": "Account number invalid — re-collect routing/account details from merchant onboarding flow.",
    "R07": "Authorization revoked — pause auto-payouts and request fresh ACH authorization.",
    "R10": "Customer claims unauthorized — open dispute case in Risk console, freeze related batch.",
    "BANK_TIMEOUT": "Acquiring bank timeout — check bank downtime tool for active outage windows.",
    "RAIL_REJECT": "Payment rail rejected — verify rail eligibility for the corridor and amount limits.",
}


def _fmt_usd(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return "—"


def run(env: RouterEnvelope) -> dict:
    m = env.merchant
    rc = env.return_code

    conn = _db.connect()
    where_parts = ["status IN ('failed','returned')"]
    params: list = []
    if m:
        where_parts.append("merchant_id = ?")
        params.append(m["mid"])
    if rc:
        where_parts.append("return_code = ?")
        params.append(rc.upper())
    if env.date_range:
        where_parts.append("initiated_at BETWEEN ? AND ?")
        params.append(env.date_range["start"][:19].replace("T", " "))
        params.append(env.date_range["end"][:19].replace("T", " "))
    where = " AND ".join(where_parts)
    rows = conn.execute(
        f"SELECT return_code, COUNT(*) c, SUM(amount_usd) amt "
        f"FROM settlement_events WHERE {where} GROUP BY return_code "
        f"ORDER BY c DESC",
        params,
    ).fetchall()
    sample = conn.execute(
        f"SELECT * FROM settlement_events WHERE {where} "
        "ORDER BY initiated_at DESC LIMIT 10",
        params,
    ).fetchall()
    conn.close()

    if not rows:
        scope = f"`{m['name']}`" if m else "all merchants"
        return {
            "title": "No failures detected",
            "body": f"No failed/returned settlements found for {scope}"
                    + (f" with code `{rc}`" if rc else "")
                    + (f" in window **{env.date_range.get('description')}**" if env.date_range else "") + ".",
            "cta": None,
            "metrics": {"failure_count": 0},
        }

    total_fail = sum(r["c"] for r in rows)
    total_amt = sum(r["amt"] or 0 for r in rows)
    title = "Failure Diagnostics"
    if m:
        title += f" — {m['name']}"
    if rc:
        title += f" • {rc}"

    lines = [
        f"**Failure events:** {total_fail}  •  **Exposure:** {_fmt_usd(total_amt)}",
        "",
        "| Return code | Count | $ exposure |",
        "|---|---|---|",
    ]
    for r in rows:
        lines.append(f"| `{r['return_code'] or '—'}` | {r['c']} | {_fmt_usd(r['amt'])} |")
    lines += [
        "",
        "**Recent failed events:**",
        "",
        "| Settlement | MID | Rail | Code | Reason | Amount |",
        "|---|---|---|---|---|---|",
    ]
    for r in sample:
        lines.append(
            f"| {r['settlement_id']} | {r['merchant_id']} | {r['payment_rail']} | "
            f"`{r['return_code'] or '—'}` | {r['failure_reason_text'] or '—'} | {_fmt_usd(r['amount_usd'])} |"
        )

    # Choose best CTA: explicit return code wins, else top-frequency code
    chosen_code = rc.upper() if rc else (rows[0]["return_code"] or "")
    cta = CTA_MAP.get(chosen_code, "Review the failure breakdown and contact Risk Operations for triage.")

    return {
        "title": title,
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {
            "failure_count": total_fail,
            "max_amount_usd": max((s["amount_usd"] for s in sample), default=0),
            "exposure_usd": total_amt,
            "by_code": {r["return_code"] or "_none_": r["c"] for r in rows},
        },
    }
