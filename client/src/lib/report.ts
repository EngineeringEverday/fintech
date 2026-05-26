import type { Audit, Clause, Framework, Override, Remediation } from "./types";
import { computeScore } from "./score";

interface ReportArgs {
  clauses: Clause[];
  audits: Audit[];
  remediations: Remediation[];
  overrides: Record<string, Override>;
  frameworks: Framework[];
  source: "live" | "demo" | null;
}

export function buildReport(a: ReportArgs): string {
  const score = computeScore(a.audits, a.overrides);
  const hi = a.audits.filter((x) => x.risk_level === "High").length;
  const med = a.audits.filter((x) => x.risk_level === "Med").length;
  const low = a.audits.filter((x) => x.risk_level === "Low").length;
  const nonCompliant = a.audits.filter((x) => x.verdict === "non-compliant").length;
  const needsReview = a.audits.filter((x) => x.verdict === "needs-review").length;
  const compliant = a.audits.filter((x) => x.verdict === "compliant").length;
  const accepted = Object.values(a.overrides).filter((o) => o.decision === "accept-rewrite").length;

  const date = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`CLAUSEGUARD — CONTRACT COMPLIANCE BRIEF`);
  lines.push(`Generated: ${date}`);
  lines.push(`Analysis source: ${a.source === "live" ? "Claude (live)" : "deterministic demo data"}`);
  lines.push("");
  lines.push(`EXECUTIVE SUMMARY`);
  lines.push(`-----------------`);
  lines.push(`Compliance score:   ${score} / 100`);
  lines.push(`Total clauses:      ${a.clauses.length}`);
  lines.push(`Frameworks audited: ${a.frameworks.join(", ")}`);
  lines.push(`Verdicts:           ${compliant} compliant · ${needsReview} needs-review · ${nonCompliant} non-compliant`);
  lines.push(`Risk distribution:  ${hi} High · ${med} Medium · ${low} Low`);
  lines.push(`Remediations:       ${a.remediations.length} drafted · ${accepted} accepted by reviewer`);
  lines.push("");
  lines.push(`Disclaimer: For screening purposes only. Does not constitute legal advice.`);
  lines.push("");
  lines.push("");
  lines.push(`FINDINGS`);
  lines.push(`========`);
  for (const c of a.clauses) {
    const audit = a.audits.find((x) => x.clause_id === c.clause_id);
    const remedy = a.remediations.find((x) => x.clause_id === c.clause_id);
    const ov = a.overrides[c.clause_id];
    lines.push("");
    lines.push(`[${c.clause_id}] ${c.clause_type}`);
    lines.push(wrap(c.clause_text, 96));
    if (audit) {
      lines.push("");
      lines.push(`  Verdict:        ${audit.verdict.toUpperCase()}`);
      lines.push(`  Risk level:     ${audit.risk_level}`);
      lines.push(`  Confidence:     ${audit.confidence_score}/100`);
      lines.push(`  Framework:      ${audit.framework_triggered}`);
      if (audit.violated_rules.length) {
        lines.push(`  Violated rules: ${audit.violated_rules.join("; ")}`);
      }
      lines.push(`  Explanation:    ${wrap(audit.explanation, 92, "                  ").trim()}`);
    }
    if (remedy) {
      lines.push("");
      lines.push(`  AI Rewrite:`);
      lines.push(wrap(remedy.compliant_alternative, 92, "    "));
      lines.push(`  Change summary: ${remedy.change_summary}`);
    }
    if (ov) {
      lines.push("");
      lines.push(`  Reviewer decision: ${ov.decision.toUpperCase()}`);
      if (ov.note) lines.push(`  Reviewer note:     ${ov.note}`);
    }
    lines.push("");
    lines.push(`  ----`);
  }
  lines.push("");
  lines.push(`END OF REPORT`);
  return lines.join("\n");
}

function wrap(text: string, width: number, indent = ""): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = indent;
  for (const w of words) {
    if ((line + (line === indent ? "" : " ") + w).length > width) {
      out.push(line);
      line = indent + w;
    } else {
      line += (line === indent ? "" : " ") + w;
    }
  }
  if (line.trim()) out.push(line);
  return out.join("\n");
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export async function copyText(content: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = content;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}
