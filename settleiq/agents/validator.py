"""Agent 4 - Sanity validation.

Applies deterministic guard rules to the analyst output. Each rule produces
a finding with severity in {info, warning, critical}. If any critical
finding fires, the orchestrator REPLACES the user-facing response with the
Risk Operations Team Alerted banner.

Rules:
  * amount > $10M           -> critical (anomalous payout)
  * negative reserve        -> critical (data integrity)
  * latency > 10s (response build time)  -> warning
  * settlement avg time > 6h -> info
"""

from __future__ import annotations

from typing import Any


CRITICAL_BANNER = (
    "🚨 **Risk Operations Team Alerted**\n\n"
    "An anomaly threshold was tripped on this query and the response was "
    "automatically suppressed. The on-call risk analyst has been notified "
    "via PagerDuty (mock). Reference will be available in the audit log."
)


def validate(analyst_out: dict[str, Any], latency_ms: int) -> dict[str, Any]:
    findings: list[dict] = []

    # Amount > $10M
    metrics = analyst_out.get("metrics", {}) or {}
    max_amt = metrics.get("max_amount_usd") or 0
    total_amt = metrics.get("total_amount_usd") or 0
    if max_amt and max_amt > 10_000_000:
        findings.append({
            "severity": "critical",
            "rule": "amount_over_10m",
            "detail": f"Detected single settlement amount ${max_amt:,.2f} > $10M.",
        })

    # Negative reserve
    reserve = metrics.get("reserve_balance_usd")
    if reserve is not None and reserve < 0:
        findings.append({
            "severity": "critical",
            "rule": "negative_reserve",
            "detail": f"Reserve balance is ${reserve:,.2f} (negative).",
        })

    # Latency
    if latency_ms > 10_000:
        findings.append({
            "severity": "warning",
            "rule": "latency_over_10s",
            "detail": f"Pipeline latency {latency_ms} ms exceeds 10s threshold.",
        })

    avg_settle = metrics.get("avg_settlement_seconds")
    if avg_settle and avg_settle > 6 * 3600:
        findings.append({
            "severity": "info",
            "rule": "avg_settlement_over_6h",
            "detail": f"Avg settlement time {avg_settle/3600:.1f}h > 6h.",
        })

    has_critical = any(f["severity"] == "critical" for f in findings)
    status = "critical" if has_critical else ("warning" if any(f["severity"] == "warning" for f in findings) else "ok")

    return {
        "status": status,
        "findings": findings,
        "blocked": has_critical,
        "banner": CRITICAL_BANNER if has_critical else None,
    }
