"""UC1 / UC2 / UC3 / UC9 / UC10 - Settlement status, payouts, freeze, phone lookup, provisional.

Returns: {title, body (Markdown), cta, metrics}
"""

from __future__ import annotations

from . import _db
from agents.router import RouterEnvelope


def _fmt_usd(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return "—"


def _disambiguation(env: RouterEnvelope) -> dict:
    rows = env.phone_matches
    listing = "\n".join(
        f"- **{r['name']}** — `{r['mid']}`" for r in rows
    )
    body = (
        f"That phone number `{rows[0]['phone']}` is linked to **{len(rows)} merchant accounts**. "
        "Please confirm which one you meant:\n\n" + listing
    )
    return {
        "title": "Disambiguation Required",
        "body": body,
        "cta": "Reply with the MID (e.g. `MID01005`) to continue.",
        "metrics": {"phone_matches": len(rows)},
    }


def _payout_journey(env: RouterEnvelope) -> dict:
    payout_id = env.payout_id
    conn = _db.connect()
    rows = conn.execute(
        """SELECT * FROM settlement_events WHERE payout_id = ?
           ORDER BY initiated_at""",
        (payout_id,),
    ).fetchall()
    conn.close()
    if not rows:
        return {
            "title": f"Payout {payout_id} not found",
            "body": f"No settlement events were found under `{payout_id}`. Double-check the ID or search by MID.",
            "cta": "Try the MID-based query: `settlements for MID01005 last 7 days`.",
            "metrics": {},
        }

    total_amt = sum(r["amount_usd"] for r in rows)
    total_net = sum(r["net_amount_usd"] or 0 for r in rows)
    statuses: dict[str, int] = {}
    for r in rows:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    rails = {r["payment_rail"] for r in rows}

    lines = [
        f"**Payout ID:** `{payout_id}`  |  **Events:** {len(rows)}  |  **Rails:** {', '.join(sorted(rails))}",
        f"**Gross:** {_fmt_usd(total_amt)}  |  **Net after fees:** {_fmt_usd(total_net)}",
        "",
        "| Settlement | MID | Status | Amount | Net | Trace # | Rail |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows[:25]:
        lines.append(
            f"| {r['settlement_id']} | {r['merchant_id']} | {r['status']} | "
            f"{_fmt_usd(r['amount_usd'])} | {_fmt_usd(r['net_amount_usd'])} | "
            f"`{r['settlement_trace_number']}` | {r['payment_rail']} |"
        )
    return {
        "title": f"Payout Journey — {payout_id}",
        "body": "\n".join(lines),
        "cta": "Need failure-level drill-down? Try: `Why did payout {0} fail?`".format(payout_id),
        "metrics": {
            "total_amount_usd": total_amt,
            "net_amount_usd": total_net,
            "events": len(rows),
            "max_amount_usd": max(r["amount_usd"] for r in rows),
            "by_status": statuses,
        },
    }


def _freeze_status(env: RouterEnvelope) -> dict:
    m = env.merchant
    if not m:
        return {
            "title": "Merchant required",
            "body": "Please include a merchant name or MID to check freeze/on-hold status.",
            "cta": "Example: `Is Starbucks frozen?`",
            "metrics": {},
        }
    conn = _db.connect()
    row = conn.execute(
        "SELECT * FROM merchant_registry WHERE mid = ?", (m["mid"],)
    ).fetchone()
    conn.close()
    if not row:
        return {"title": "Not found", "body": f"MID {m['mid']} not in registry.", "cta": None, "metrics": {}}
    status = row["status"]
    badge = {"frozen": "🛑 **Frozen**", "on_hold": "⏸ **On Hold**", "active": "🟢 **Active**"}.get(status, status)
    reason = ""
    if status == "frozen":
        reason = "Account flagged by Risk Operations — settlements suspended pending KYB review."
    elif status == "on_hold":
        reason = "Temporary hold (likely funding/compliance verification). Payouts auto-resume on clearance."
    else:
        reason = "Account in good standing. No active holds."
    body = (
        f"**{row['business_name']}** (`{row['mid']}`)\n\n"
        f"Status: {badge}\n\nRisk tier: `{row['risk_tier']}` • Acquiring bank: {row['acquiring_bank']}\n\n"
        f"_{reason}_"
    )
    cta = "Open Risk Operations ticket" if status in ("frozen", "on_hold") else "No action required"
    return {
        "title": "Merchant Hold Status",
        "body": body,
        "cta": cta,
        "metrics": {"status": status, "risk_tier": row["risk_tier"]},
    }


def _provisional_check(env: RouterEnvelope) -> dict:
    m = env.merchant
    if not m:
        return {
            "title": "Merchant required",
            "body": "Add a merchant or MID for provisional credit lookup.",
            "cta": "Example: `Starbucks provisional credits this week`",
            "metrics": {},
        }
    conn = _db.connect()
    rows = conn.execute(
        """SELECT * FROM settlement_events
           WHERE merchant_id = ? AND is_provisional_credit = 1
           ORDER BY initiated_at DESC LIMIT 20""",
        (m["mid"],),
    ).fetchall()
    conn.close()
    if not rows:
        return {
            "title": f"Provisional credits — {m['name']}",
            "body": f"No provisional credits in the lookback window for `{m['mid']}`.",
            "cta": None,
            "metrics": {"provisional_count": 0},
        }
    confirmed = sum(1 for r in rows if r["credit_confirmed_at"])
    total = sum(r["amount_usd"] for r in rows)
    lines = [
        f"**{m['name']}** (`{m['mid']}`) — {len(rows)} provisional credits, "
        f"{confirmed} confirmed, total {_fmt_usd(total)}",
        "",
        "| Settlement | Amount | Initiated | Confirmed at | Rail |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['settlement_id']} | {_fmt_usd(r['amount_usd'])} | {r['initiated_at']} | "
            f"{r['credit_confirmed_at'] or '_pending_'} | {r['payment_rail']} |"
        )
    cta = "Reconcile any rows still marked _pending_ in the daily MIS report."
    return {
        "title": f"Provisional Credit Status — {m['name']}",
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {
            "provisional_count": len(rows),
            "confirmed_count": confirmed,
            "total_amount_usd": total,
            "max_amount_usd": max(r["amount_usd"] for r in rows),
        },
    }


def _settlement_details(env: RouterEnvelope) -> dict:
    m = env.merchant
    if not m:
        return {
            "title": "Merchant required",
            "body": "Provide a merchant name, MID, or phone to pull settlement details.",
            "cta": "Example: `Settlement for MID01010 last 7 days`",
            "metrics": {},
        }

    dr = env.date_range
    params: list = [m["mid"]]
    where = "merchant_id = ?"
    if dr:
        where += " AND initiated_at BETWEEN ? AND ?"
        # SQLite text comparison works for ISO format; trim TZ
        params.append(dr["start"][:19].replace("T", " "))
        params.append(dr["end"][:19].replace("T", " "))
    conn = _db.connect()
    rows = conn.execute(
        f"SELECT * FROM settlement_events WHERE {where} "
        "ORDER BY initiated_at DESC LIMIT 50",
        params,
    ).fetchall()
    summary = conn.execute(
        f"""SELECT
              COUNT(*) AS total,
              SUM(amount_usd) AS gross,
              SUM(net_amount_usd) AS net,
              SUM(fee_deducted_usd) AS fees,
              MAX(amount_usd) AS max_amt,
              SUM(CASE WHEN status='settled' THEN 1 ELSE 0 END) AS settled,
              SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status='returned' THEN 1 ELSE 0 END) AS returned,
              SUM(CASE WHEN is_provisional_credit=1 THEN 1 ELSE 0 END) AS prov
            FROM settlement_events WHERE {where}""",
        params,
    ).fetchone()
    conn.close()

    if not summary or summary["total"] == 0:
        return {
            "title": f"No settlements — {m['name']}",
            "body": f"No settlement events found for `{m['mid']}`"
                    + (f" in window **{dr['description']}**" if dr else " (open range)") + ".",
            "cta": "Try widening the date window or removing date filters.",
            "metrics": {},
        }

    window = dr.get("description", "open range")
    settle_rate = 100.0 * (summary["settled"] or 0) / summary["total"]

    lines = [
        f"**{m['name']}** (`{m['mid']}`) • Window: **{window}**",
        "",
        f"- Total settlements: **{summary['total']}**",
        f"- Gross: **{_fmt_usd(summary['gross'])}**  |  Net after fees: **{_fmt_usd(summary['net'])}**  |  Fees: {_fmt_usd(summary['fees'])}",
        f"- Settlement rate: **{settle_rate:.1f}%**",
        f"- Breakdown: 🟢 settled {summary['settled']} • 🟡 pending {summary['pending']} • 🔴 failed {summary['failed']} • 🟠 returned {summary['returned']} • 🔵 provisional {summary['prov']}",
        "",
        "**Recent events (most recent 15):**",
        "",
        "| Settlement | Status | Amount | Net | Trace # | Provisional | Failure |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows[:15]:
        prov = "✔" if r["is_provisional_credit"] else ""
        fail = r["return_code"] or ""
        lines.append(
            f"| {r['settlement_id']} | {r['status']} | {_fmt_usd(r['amount_usd'])} | "
            f"{_fmt_usd(r['net_amount_usd'])} | `{r['settlement_trace_number']}` | {prov} | {fail} |"
        )
    cta = "Drill into failures → ask: `Why did {0} settlements fail last week?`".format(m["name"])
    return {
        "title": f"Settlement Details — {m['name']}",
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {
            "total_events": summary["total"],
            "total_amount_usd": summary["gross"],
            "net_amount_usd": summary["net"],
            "fees_usd": summary["fees"],
            "max_amount_usd": summary["max_amt"],
            "settlement_rate_pct": settle_rate,
            "by_status": {
                "settled": summary["settled"], "pending": summary["pending"],
                "failed": summary["failed"], "returned": summary["returned"],
                "provisional": summary["prov"],
            },
        },
    }


def run(env: RouterEnvelope) -> dict:
    # Order of precedence
    if env.intent_flags.get("disambiguation_needed"):
        return _disambiguation(env)
    if env.intent_flags.get("freeze_check"):
        return _freeze_status(env)
    if env.intent_flags.get("provisional_check"):
        return _provisional_check(env)
    if env.payout_id:
        return _payout_journey(env)
    # If user gave a phone with exactly one match, treat as MID and continue
    if env.phone_matches and len(env.phone_matches) == 1 and not env.merchant:
        env.merchant = {"mid": env.phone_matches[0]["mid"], "name": env.phone_matches[0]["name"], "method": "phone"}
    return _settlement_details(env)
