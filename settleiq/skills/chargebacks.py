"""UC11 - Chargeback / dispute lookup by MID or transaction ID."""

from __future__ import annotations

from . import _db
from agents.router import RouterEnvelope


def _fmt_usd(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return "—"


def run(env: RouterEnvelope) -> dict:
    conn = _db.connect()
    if env.transaction_id:
        rows = conn.execute(
            "SELECT * FROM chargebacks WHERE transaction_id = ?",
            (env.transaction_id,),
        ).fetchall()
    elif env.merchant:
        rows = conn.execute(
            "SELECT * FROM chargebacks WHERE merchant_id = ? ORDER BY opened_at DESC",
            (env.merchant["mid"],),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM chargebacks ORDER BY opened_at DESC LIMIT 30"
        ).fetchall()
    conn.close()

    if not rows:
        scope = env.transaction_id or (env.merchant or {}).get("name") or "(no scope)"
        return {
            "title": "No chargebacks found",
            "body": f"No disputes recorded for **{scope}**.",
            "cta": None,
            "metrics": {"chargebacks": 0},
        }

    total = sum(r["amount_usd"] for r in rows)
    statuses: dict[str, int] = {}
    for r in rows:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1

    head = env.transaction_id or (env.merchant or {}).get("name") or "All merchants"
    lines = [
        f"**Scope:** {head}  •  Disputes: **{len(rows)}**  •  Total: **{_fmt_usd(total)}**",
        f"Status mix: " + ", ".join(f"`{k}`={v}" for k, v in statuses.items()),
        "",
        "| Chargeback | MID | Transaction | Amount | Code | Reason | Status | Opened |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in rows[:20]:
        lines.append(
            f"| {r['chargeback_id']} | {r['merchant_id']} | {r['transaction_id']} | "
            f"{_fmt_usd(r['amount_usd'])} | `{r['reason_code']}` | {r['reason_label']} | "
            f"{r['status']} | {r['opened_at']} |"
        )
    cta = "Upload evidence for `pending_evidence` rows or mark `open` cases for representment."
    return {
        "title": "Chargeback Summary",
        "body": "\n".join(lines),
        "cta": cta,
        "metrics": {
            "chargebacks": len(rows),
            "total_amount_usd": total,
            "max_amount_usd": max(r["amount_usd"] for r in rows),
            "by_status": statuses,
        },
    }
