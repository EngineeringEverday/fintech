import type { Audit, Override } from "./types";

/** Weighted compliance score 0..100. Higher = better. */
export function computeScore(audits: Audit[], overrides: Record<string, Override>): number {
  if (audits.length === 0) return 0;
  const RISK_WEIGHT = { High: 12, Med: 6, Low: 2 } as const;
  let penalty = 0;
  for (const a of audits) {
    const o = overrides[a.clause_id];
    if (o?.decision === "accept-rewrite") continue; // remediated, no penalty
    if (a.verdict === "compliant") continue;
    const w = RISK_WEIGHT[a.risk_level] ?? 6;
    const verdictMult = a.verdict === "non-compliant" ? 1 : 0.45;
    penalty += w * verdictMult;
  }
  // Cap penalty so a small contract with one violation isn't crushed.
  const denom = Math.max(40, audits.length * 8);
  const ratio = Math.min(1, penalty / denom);
  return Math.round((1 - ratio) * 100);
}

export function ringColor(score: number): { stroke: string; bg: string; label: string } {
  if (score < 60) return { stroke: "hsl(var(--risk-high))", bg: "hsl(var(--risk-high) / 0.12)", label: "High Risk" };
  if (score < 80) return { stroke: "hsl(var(--risk-med))", bg: "hsl(var(--risk-med) / 0.12)", label: "Needs Work" };
  return { stroke: "hsl(var(--risk-low))", bg: "hsl(var(--risk-low) / 0.12)", label: "Compliant" };
}
