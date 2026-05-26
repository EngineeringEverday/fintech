// Sequential three-agent runner. Calls Claude when an API key is present and
// CORS-permitted, otherwise falls back to a deterministic demo path so the
// whole pipeline completes in under 60 seconds.

import { callClaudeJSON } from "./claude";
import { AUDITOR_PROMPT, EXTRACTOR_PROMPT, REMEDIATION_PROMPT } from "./prompts";
import {
  buildSampleClauses,
  SAMPLE_AUDITS,
  SAMPLE_CONTRACT,
  SAMPLE_REMEDIATIONS,
} from "./sample";
import type {
  AgentName,
  Audit,
  Clause,
  Framework,
  Remediation,
} from "./types";

export interface AgentCallbacks {
  onAgentStart: (name: AgentName) => void;
  onProgress: (name: AgentName, p: number) => void;
  onAgentDone: (name: AgentName, source: "live" | "demo") => void;
  onClauses: (clauses: Clause[]) => void;
  onAudits: (audits: Audit[]) => void;
  onRemediations: (remediations: Remediation[]) => void;
  onLog?: (msg: string) => void;
}

export interface RunArgs {
  contract: string;
  frameworks: Framework[];
  apiKey?: string;
  /** When true, skip live calls and go straight to the demo path. */
  forceDemo?: boolean;
  callbacks: AgentCallbacks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Smoothly drive a progress bar from `from` to `to` over `ms` milliseconds. */
async function animateProgress(
  name: AgentName,
  from: number,
  to: number,
  ms: number,
  cb: AgentCallbacks,
) {
  const steps = Math.max(4, Math.floor(ms / 80));
  for (let i = 1; i <= steps; i++) {
    cb.onProgress(name, from + ((to - from) * i) / steps);
    await sleep(ms / steps);
  }
}

export async function runPipeline(args: RunArgs): Promise<{ source: "live" | "demo" }> {
  const { contract, frameworks, apiKey, forceDemo, callbacks: cb } = args;
  const useLive = !forceDemo && !!apiKey;

  // ---------- AGENT 1: Clause Extractor ----------
  cb.onAgentStart("Clause Extractor");
  let clauses: Clause[] = [];
  let liveOk = false;

  if (useLive) {
    const progressP = animateProgress("Clause Extractor", 0, 0.85, 6000, cb);
    const result = await callClaudeJSON<any[]>({
      apiKey: apiKey!,
      systemPrompt: EXTRACTOR_PROMPT,
      userContent: contract,
      maxTokens: 4096,
    });
    await progressP;
    if (result.ok && Array.isArray(result.data)) {
      clauses = normalizeClauses(result.data, contract);
      liveOk = clauses.length > 0;
    } else {
      cb.onLog?.(`Extractor live call failed: ${result.error ?? "unknown"} — falling back to demo.`);
    }
  }

  if (!liveOk) {
    // Demo path. Progressive reveal so the UI never feels static.
    await animateProgress("Clause Extractor", 0, 0.4, 600, cb);
    clauses = buildSampleClauses(contract.includes("MASTER SERVICES AGREEMENT") ? contract : SAMPLE_CONTRACT);
    // If the input differed from the sample, still emit a synthetic split.
    if (clauses.length === 0) clauses = synthSplit(contract);
    await animateProgress("Clause Extractor", 0.4, 1, 900, cb);
  } else {
    cb.onProgress("Clause Extractor", 1);
  }
  cb.onClauses(clauses);
  cb.onAgentDone("Clause Extractor", liveOk ? "live" : "demo");

  // Tiny breather between agents (keeps the visible-progress narrative)
  await sleep(150);

  // ---------- AGENT 2: Compliance Auditor ----------
  cb.onAgentStart("Compliance Auditor");
  let audits: Audit[] = [];
  let liveAuditOk = false;

  if (useLive && liveOk) {
    const progressP = animateProgress("Compliance Auditor", 0, 0.85, 8000, cb);
    const payload =
      `Selected frameworks: ${frameworks.join(", ")}\n\nClauses:\n` +
      JSON.stringify(clauses.map(({ clause_id, clause_text, clause_type }) => ({ clause_id, clause_text, clause_type })), null, 2);
    const result = await callClaudeJSON<any[]>({
      apiKey: apiKey!,
      systemPrompt: AUDITOR_PROMPT,
      userContent: payload,
      maxTokens: 6000,
    });
    await progressP;
    if (result.ok && Array.isArray(result.data)) {
      audits = normalizeAudits(result.data);
      liveAuditOk = audits.length > 0;
    } else {
      cb.onLog?.(`Auditor live call failed: ${result.error ?? "unknown"} — falling back to demo.`);
    }
  }
  if (!liveAuditOk) {
    await animateProgress("Compliance Auditor", 0, 0.4, 700, cb);
    audits = clauses.map((c) => SAMPLE_AUDITS.find((a) => a.clause_id === c.clause_id) ?? synthAudit(c));
    await animateProgress("Compliance Auditor", 0.4, 1, 1100, cb);
  } else {
    cb.onProgress("Compliance Auditor", 1);
  }
  cb.onAudits(audits);
  cb.onAgentDone("Compliance Auditor", liveAuditOk ? "live" : "demo");

  // Allow the Hero ring to render before Agent 3 kicks off
  await sleep(450);

  // ---------- AGENT 3: Remediation Writer ----------
  cb.onAgentStart("Remediation Writer");
  let remediations: Remediation[] = [];
  let liveRemedyOk = false;

  const targets = audits.filter((a) => a.verdict !== "compliant");

  if (useLive && liveAuditOk && targets.length > 0) {
    const progressP = animateProgress("Remediation Writer", 0, 0.85, 7000, cb);
    const payload =
      `Rewrite each of the following non-compliant or needs-review clauses.\n\n` +
      JSON.stringify(
        targets.map((a) => {
          const c = clauses.find((x) => x.clause_id === a.clause_id);
          return {
            clause_id: a.clause_id,
            clause_text: c?.clause_text ?? "",
            verdict: a.verdict,
            violated_rules: a.violated_rules,
            explanation: a.explanation,
          };
        }),
        null,
        2,
      );
    const result = await callClaudeJSON<any[]>({
      apiKey: apiKey!,
      systemPrompt: REMEDIATION_PROMPT,
      userContent: payload,
      maxTokens: 6000,
    });
    await progressP;
    if (result.ok && Array.isArray(result.data)) {
      remediations = normalizeRemediations(result.data);
      liveRemedyOk = remediations.length > 0;
    } else {
      cb.onLog?.(`Remediation live call failed: ${result.error ?? "unknown"} — falling back to demo.`);
    }
  }

  if (!liveRemedyOk) {
    await animateProgress("Remediation Writer", 0, 0.5, 700, cb);
    remediations = targets.map(
      (a) => SAMPLE_REMEDIATIONS.find((r) => r.clause_id === a.clause_id) ?? synthRemedy(a.clause_id),
    );
    await animateProgress("Remediation Writer", 0.5, 1, 1000, cb);
  } else {
    cb.onProgress("Remediation Writer", 1);
  }
  cb.onRemediations(remediations);
  cb.onAgentDone("Remediation Writer", liveRemedyOk ? "live" : "demo");

  const overallSource: "live" | "demo" = liveOk && liveAuditOk && liveRemedyOk ? "live" : "demo";
  return { source: overallSource };
}

// ---------- Helpers ----------

function normalizeClauses(raw: any[], contract: string): Clause[] {
  const allowed: Clause["clause_type"][] = [
    "Data Collection",
    "Retention",
    "Sharing",
    "Security",
    "User Rights",
    "Liability",
    "Other",
  ];
  return raw
    .map((r, i): Clause | null => {
      const text = String(r.clause_text ?? "").trim();
      if (!text) return null;
      const id = String(r.clause_id ?? `C${i + 1}`);
      let type = String(r.clause_type ?? "Other") as Clause["clause_type"];
      if (!allowed.includes(type)) type = "Other";
      const start = contract.indexOf(text.slice(0, Math.min(40, text.length)));
      const range: [number, number] | undefined =
        start >= 0 ? [start, start + text.length] : undefined;
      return { clause_id: id, clause_text: text, clause_type: type, range };
    })
    .filter(Boolean) as Clause[];
}

function normalizeAudits(raw: any[]): Audit[] {
  return raw
    .map((r): Audit | null => {
      if (!r?.clause_id) return null;
      const verdict = String(r.verdict ?? "needs-review") as Audit["verdict"];
      const risk = String(r.risk_level ?? "Med") as Audit["risk_level"];
      return {
        clause_id: String(r.clause_id),
        verdict: ["compliant", "non-compliant", "needs-review"].includes(verdict) ? verdict : "needs-review",
        violated_rules: Array.isArray(r.violated_rules) ? r.violated_rules.map(String) : [],
        risk_level: ["High", "Med", "Low"].includes(risk) ? risk : "Med",
        explanation: String(r.explanation ?? ""),
        confidence_score: clamp(Number(r.confidence_score ?? 70), 0, 100),
        framework_triggered: String(r.framework_triggered ?? "GDPR"),
      };
    })
    .filter(Boolean) as Audit[];
}

function normalizeRemediations(raw: any[]): Remediation[] {
  return raw
    .map((r): Remediation | null => {
      if (!r?.clause_id) return null;
      return {
        clause_id: String(r.clause_id),
        compliant_alternative: String(r.compliant_alternative ?? ""),
        change_summary: String(r.change_summary ?? ""),
        what_was_wrong: String(r.what_was_wrong ?? ""),
      };
    })
    .filter(Boolean) as Remediation[];
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function synthSplit(contract: string): Clause[] {
  // Last-resort splitter when the input isn't the sample and the live extractor
  // failed. Splits on blank lines, capping at 12 clauses.
  const blocks = contract
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
    .slice(0, 12);
  return blocks.map((text, i) => {
    const start = contract.indexOf(text);
    return {
      clause_id: `C${i + 1}`,
      clause_text: text,
      clause_type: "Other" as const,
      range: start >= 0 ? ([start, start + text.length] as [number, number]) : undefined,
    };
  });
}

function synthAudit(c: Clause): Audit {
  return {
    clause_id: c.clause_id,
    verdict: "needs-review",
    violated_rules: ["Heuristic flag — clause requires human review"],
    risk_level: "Med",
    explanation:
      "Demo fallback verdict generated because the live auditor was unavailable. Treat as a placeholder.",
    confidence_score: 55,
    framework_triggered: "GDPR",
  };
}

function synthRemedy(clauseId: string): Remediation {
  return {
    clause_id: clauseId,
    compliant_alternative:
      "[Demo rewrite] Replace with a clause that explicitly identifies lawful basis, purpose, retention period, and data subject rights, and incorporates the relevant 2021 SCC/UK IDTA + audit-on-cause language.",
    change_summary: "Demo fallback — restructured for explicit obligations.",
    what_was_wrong: "Demo fallback — original lacked statutory specificity.",
  };
}
