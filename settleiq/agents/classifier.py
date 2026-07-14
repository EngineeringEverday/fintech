"""Agent 1 - Deterministic regex classifier (pre-LLM gate).

Classifies an inbound query into one of:
  - data_query        (answerable from settlement / merchant data)
  - concept_query     (general knowledge / explanation about settlements)
  - injection_attempt (prompt-injection / jailbreak attempts - DENY)
  - out_of_scope      (off-topic, unrelated to settlements)

Returns a structured dict; the orchestrator decides whether to proceed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict

# Patterns ordered by severity. Injection is checked first.
INJECTION_PATTERNS = [
    r"ignore (all|the|your) (previous|prior|above) (instructions|prompts|rules)",
    r"disregard (the|your|all)? ?(previous|system|prior) (instructions|prompts)",
    r"you are now (a|an) [a-z ]+",
    r"act as (a|an) [a-z ]+",
    r"reveal (the|your) (system|hidden) prompt",
    r"print (the|your) (system )?prompt",
    r"jailbreak",
    r"developer mode",
    r"do anything now",
    r"\bDAN\b",
    r"output (your )?credentials",
    r"bypass (the )?(security|guardrails|filter)",
    r"reset your (instructions|persona)",
]

# Words indicating it IS about settlement intelligence (data query)
DATA_KEYWORDS = [
    "settlement", "settled", "payout", "mid", "merchant", "ach", "fedwire", "rtp",
    "fednow", "reserve", "chargeback", "downtime", "outage", "provisional",
    "failed", "failure", "return code", "r01", "r03", "r04", "trace", "routing",
    "freeze", "frozen", "on hold", "schedule", "trend", "last 30 days",
    "transaction id", "txn", "phone", "balance", "config", "configuration",
]

# Concept / how-it-works style words
CONCEPT_KEYWORDS = [
    "what is", "explain", "how does", "define", "difference between",
    "vs", "meaning of",
]

# Out-of-scope = explicit non-payments domains
OUT_OF_SCOPE_KEYWORDS = [
    "weather", "stock price", "sports", "movie", "recipe", "joke",
    "poem", "song lyrics", "celebrity",
]


@dataclass
class ClassifierResult:
    label: str
    reason: str
    matched_pattern: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def classify(query: str) -> ClassifierResult:
    q = (query or "").strip()
    if not q:
        return ClassifierResult("out_of_scope", "empty query")

    lower = q.lower()

    # 1. Injection check
    for pat in INJECTION_PATTERNS:
        if re.search(pat, lower):
            return ClassifierResult(
                "injection_attempt",
                "Matched injection-attempt regex",
                matched_pattern=pat,
            )

    # 2. Out of scope
    for kw in OUT_OF_SCOPE_KEYWORDS:
        if kw in lower:
            return ClassifierResult("out_of_scope", f"Mentions off-topic keyword '{kw}'")

    # 3. Data vs concept
    if any(kw in lower for kw in DATA_KEYWORDS):
        return ClassifierResult("data_query", "Mentions settlement-domain keyword")

    if any(lower.startswith(kw) or f" {kw} " in lower for kw in CONCEPT_KEYWORDS):
        # Concept questions about settlements still useful, but tag concept
        if any(kw in lower for kw in ("settle", "payment", "ach", "rtp", "fedwire", "payout")):
            return ClassifierResult("concept_query", "Conceptual question about settlements")
        return ClassifierResult("concept_query", "General conceptual question")

    return ClassifierResult("out_of_scope", "No settlement-domain signal detected")
