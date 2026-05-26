// Core domain types for ClauseGuard

export type ClauseType =
  | "Data Collection"
  | "Retention"
  | "Sharing"
  | "Security"
  | "User Rights"
  | "Liability"
  | "Other";

export const CLAUSE_TYPES: ClauseType[] = [
  "Data Collection",
  "Retention",
  "Sharing",
  "Security",
  "User Rights",
  "Liability",
  "Other",
];

export type Framework = "GDPR" | "HIPAA" | "SOC2" | "CCPA";
export const FRAMEWORKS: Framework[] = ["GDPR", "HIPAA", "SOC2", "CCPA"];

export type Verdict = "compliant" | "non-compliant" | "needs-review";
export type RiskLevel = "High" | "Med" | "Low";

export interface Clause {
  clause_id: string;
  clause_text: string;
  clause_type: ClauseType;
  /** Character range in the original contract text (inclusive start, exclusive end). */
  range?: [number, number];
}

export interface Audit {
  clause_id: string;
  verdict: Verdict;
  violated_rules: string[];
  risk_level: RiskLevel;
  explanation: string;
  confidence_score: number;
  framework_triggered: Framework | string;
}

export interface Remediation {
  clause_id: string;
  compliant_alternative: string;
  change_summary: string;
  what_was_wrong: string;
}

export interface Override {
  clause_id: string;
  decision: "accept-rewrite" | "reject" | "note";
  note?: string;
  at: number;
}

export type AgentName = "Clause Extractor" | "Compliance Auditor" | "Remediation Writer";

export interface AgentRunState {
  name: AgentName;
  status: "idle" | "running" | "done" | "error";
  progress: number; // 0..1
  startedAt?: number;
  endedAt?: number;
  message?: string;
}

export interface AnalysisState {
  contractText: string;
  frameworks: Framework[];
  clauses: Clause[];
  audits: Audit[];
  remediations: Remediation[];
  overrides: Record<string, Override>;
  agents: AgentRunState[];
  source: "live" | "demo" | null;
  startedAt?: number;
  endedAt?: number;
}
