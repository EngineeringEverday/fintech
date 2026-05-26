// Two-column clause review: left = annotated contract with progressive highlights,
// right = audit + remediation cards with reviewer overrides.

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  StickyNote,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import type {
  Audit,
  Clause,
  Override,
  Remediation,
  Verdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  contract: string;
  clauses: Clause[];
  audits: Audit[];
  remediations: Remediation[];
  overrides: Record<string, Override>;
  onOverride: (clauseId: string, decision: Override["decision"], note?: string) => void;
}

export function ClauseReview({
  contract,
  clauses,
  audits,
  remediations,
  overrides,
  onOverride,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Progressive highlight reveal — fade them in one-by-one after mount.
  const [revealedCount, setRevealedCount] = useState(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const auditMap = useMemo(() => {
    const m: Record<string, Audit> = {};
    for (const a of audits) m[a.clause_id] = a;
    return m;
  }, [audits]);

  const sortedHighlighted = useMemo(() => {
    return [...clauses]
      .filter((c) => c.range && auditMap[c.clause_id])
      .sort((a, b) => (a.range![0] - b.range![0]));
  }, [clauses, auditMap]);

  useEffect(() => {
    setRevealedCount(0);
    if (sortedHighlighted.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealedCount(i);
      if (i >= sortedHighlighted.length) window.clearInterval(id);
    }, 140);
    return () => window.clearInterval(id);
  }, [sortedHighlighted.length]);

  const handleHighlightClick = (clauseId: string) => {
    setActiveId(clauseId);
    const el = cardRefs.current[clauseId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Build rendered contract with inline <mark> for each clause range.
  const segments = useMemo(() => {
    const parts: Array<{ kind: "text" | "hl"; text: string; clause?: Clause }> = [];
    let cursor = 0;
    const ordered = sortedHighlighted.slice(0, revealedCount);
    for (const c of ordered) {
      const [s, e] = c.range!;
      if (s > cursor) parts.push({ kind: "text", text: contract.slice(cursor, s) });
      parts.push({ kind: "hl", text: contract.slice(s, e), clause: c });
      cursor = e;
    }
    if (cursor < contract.length) parts.push({ kind: "text", text: contract.slice(cursor) });
    return parts;
  }, [contract, sortedHighlighted, revealedCount]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
      {/* LEFT — annotated contract */}
      <div className="relative rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Source Contract
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Legend color="hsl(var(--risk-high))" label="Non-compliant" />
            <Legend color="hsl(var(--risk-med))" label="Needs review" />
            <Legend color="hsl(var(--risk-low))" label="Compliant" />
          </div>
        </div>
        <div
          className="px-5 py-4 text-[13.5px] leading-[1.7] whitespace-pre-wrap font-mono max-h-[680px] overflow-y-auto"
          data-testid="contract-text"
        >
          {segments.map((seg, i) => {
            if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
            const a = auditMap[seg.clause!.clause_id];
            const cls = verdictClass(a.verdict);
            return (
              <span
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => handleHighlightClick(seg.clause!.clause_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleHighlightClick(seg.clause!.clause_id);
                  }
                }}
                className={cn("clause-hl clause-hl-appear", cls, activeId === seg.clause!.clause_id && "active")}
                data-testid={`highlight-${seg.clause!.clause_id}`}
                title={`Clause ${seg.clause!.clause_id} — ${a.verdict}`}
              >
                {seg.text}
              </span>
            );
          })}
        </div>
      </div>

      {/* RIGHT — audit cards */}
      <div className="flex flex-col gap-3 max-h-[744px] overflow-y-auto pr-1">
        {clauses.map((c) => {
          const a = auditMap[c.clause_id];
          const r = remediations.find((x) => x.clause_id === c.clause_id);
          if (!a) return null;
          return (
            <AuditCard
              key={c.clause_id}
              clause={c}
              audit={a}
              remediation={r}
              override={overrides[c.clause_id]}
              active={activeId === c.clause_id}
              ref={(el) => (cardRefs.current[c.clause_id] = el)}
              onSetActive={() => setActiveId(c.clause_id)}
              onOverride={onOverride}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

function verdictClass(v: Verdict) {
  switch (v) {
    case "non-compliant":
      return "clause-hl-high";
    case "needs-review":
      return "clause-hl-med";
    case "compliant":
      return "clause-hl-low";
  }
}

// ----- Audit card -----

interface CardProps {
  clause: Clause;
  audit: Audit;
  remediation?: Remediation;
  override?: Override;
  active: boolean;
  onSetActive: () => void;
  onOverride: (clauseId: string, decision: Override["decision"], note?: string) => void;
}

const AuditCard = forwardRef<HTMLDivElement, CardProps>(function AuditCard(
    { clause, audit, remediation, override, active, onSetActive, onOverride },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteText, setNoteText] = useState(override?.note ?? "");

    return (
      <div
        ref={ref}
        onClick={onSetActive}
        className={cn(
          "rounded-lg border bg-card p-4 transition-all duration-300",
          active && "ring-2 ring-primary/40 border-primary/40",
        )}
        data-testid={`audit-card-${clause.clause_id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <VerdictBadge v={audit.verdict} />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
              {clause.clause_id} · {clause.clause_type}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <RiskBadge level={audit.risk_level} />
            <ConfidenceBadge value={audit.confidence_score} />
          </div>
        </div>

        <div className="mt-2.5 text-[12.5px] text-foreground/85 leading-[1.6]">
          {audit.explanation}
        </div>

        {audit.violated_rules.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {audit.violated_rules.map((rule) => (
              <span
                key={rule}
                className="text-[10.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border"
              >
                {rule}
              </span>
            ))}
          </div>
        )}

        {remediation && (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/[0.06]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium text-primary"
              data-testid={`toggle-rewrite-${clause.clause_id}`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI compliant rewrite
              </span>
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-2.5">
                <div className="text-[12.5px] leading-[1.65] text-foreground/90 font-mono whitespace-pre-wrap">
                  {remediation.compliant_alternative}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  <span className="text-foreground/80 font-medium">What changed:</span>{" "}
                  {remediation.change_summary}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  <span className="text-foreground/80 font-medium">What was wrong:</span>{" "}
                  {remediation.what_was_wrong}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviewer overrides */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={override?.decision === "accept-rewrite" ? "default" : "outline"}
            disabled={!remediation}
            onClick={(e) => {
              e.stopPropagation();
              onOverride(clause.clause_id, "accept-rewrite");
            }}
            data-testid={`btn-accept-${clause.clause_id}`}
            className="h-7 text-[11.5px]"
          >
            <Check className="h-3 w-3 mr-1" />
            Accept rewrite
          </Button>
          <Button
            size="sm"
            variant={override?.decision === "reject" ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              onOverride(clause.clause_id, "reject");
            }}
            data-testid={`btn-reject-${clause.clause_id}`}
            className="h-7 text-[11.5px]"
          >
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            variant={override?.decision === "note" ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              setNoteOpen((v) => !v);
            }}
            data-testid={`btn-note-${clause.clause_id}`}
            className="h-7 text-[11.5px]"
          >
            <StickyNote className="h-3 w-3 mr-1" />
            {override?.note ? "Edit note" : "Add note"}
          </Button>
          {override && (
            <span className="ml-1 text-[11px] text-muted-foreground" data-testid={`override-status-${clause.clause_id}`}>
              · {override.decision === "accept-rewrite" ? "Accepted" : override.decision === "reject" ? "Rejected" : "Noted"}
            </span>
          )}
        </div>

        {noteOpen && (
          <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a reviewer note (e.g. 'flagged for outside counsel review')"
              className="w-full rounded border bg-background px-2.5 py-1.5 text-[12px] leading-relaxed min-h-[64px] font-mono"
              data-testid={`textarea-note-${clause.clause_id}`}
            />
            <div className="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11.5px]"
                onClick={() => setNoteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11.5px]"
                onClick={() => {
                  onOverride(clause.clause_id, "note", noteText.trim());
                  setNoteOpen(false);
                }}
                data-testid={`btn-save-note-${clause.clause_id}`}
              >
                Save note
              </Button>
            </div>
            {override?.note && (
              <div className="text-[11.5px] text-muted-foreground italic">
                Saved: "{override.note}"
              </div>
            )}
          </div>
        )}
      </div>
    );
  });

function VerdictBadge({ v }: { v: Verdict }) {
  const map: Record<Verdict, { icon: any; label: string; bg: string; color: string }> = {
    "non-compliant": {
      icon: ShieldAlert,
      label: "Non-compliant",
      bg: "hsl(var(--risk-high) / 0.16)",
      color: "hsl(var(--risk-high))",
    },
    "needs-review": {
      icon: ShieldQuestion,
      label: "Needs review",
      bg: "hsl(var(--risk-med) / 0.18)",
      color: "hsl(var(--risk-med))",
    },
    compliant: {
      icon: ShieldCheck,
      label: "Compliant",
      bg: "hsl(var(--risk-low) / 0.16)",
      color: "hsl(var(--risk-low))",
    },
  };
  const M = map[v];
  const Icon = M.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider"
      style={{ background: M.bg, color: M.color }}
    >
      <Icon className="h-3 w-3" />
      {M.label}
    </span>
  );
}

function RiskBadge({ level }: { level: "High" | "Med" | "Low" }) {
  const c =
    level === "High"
      ? "hsl(var(--risk-high))"
      : level === "Med"
      ? "hsl(var(--risk-med))"
      : "hsl(var(--risk-low))";
  return (
    <span
      className="text-[10.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border"
      style={{ color: c, borderColor: `${c}`, background: `${c.replace("hsl(", "hsl(").replace(")", " / 0.10)")}` }}
    >
      Risk · {level}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span
      className="text-[10.5px] font-mono px-1.5 py-0.5 rounded border bg-muted/40 tabular-nums text-muted-foreground"
      title="Model confidence"
    >
      {value}% conf
    </span>
  );
}
