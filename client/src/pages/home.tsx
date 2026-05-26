// Single-page composition: disclaimer banner, header, input,
// agent timeline, hero score + heatmap, clause review, methodology tab.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Beaker,
  Cog,
  Copy,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { AgentTimeline } from "@/components/agent-timeline";
import { ScoreRing } from "@/components/score-ring";
import { RiskHeatmap } from "@/components/risk-heatmap";
import { ClauseReview } from "@/components/clause-review";
import { Methodology } from "@/components/methodology";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { runPipeline } from "@/lib/agents";
import { computeScore } from "@/lib/score";
import { buildReport, copyText, downloadText } from "@/lib/report";
import { readJSON, storageBackend, writeJSON } from "@/lib/storage";
import { SAMPLE_CONTRACT } from "@/lib/sample";
import type {
  AgentName,
  AgentRunState,
  AnalysisState,
  Audit,
  Clause,
  Framework,
  Override,
  Remediation,
} from "@/lib/types";
import { FRAMEWORKS } from "@/lib/types";

const SESSION_KEY = "clauseguard:session:v1";
const KEY_KEY = "clauseguard:apikey:v1";

const initialAgents: AgentRunState[] = [
  { name: "Clause Extractor", status: "idle", progress: 0 },
  { name: "Compliance Auditor", status: "idle", progress: 0 },
  { name: "Remediation Writer", status: "idle", progress: 0 },
];

export default function Home() {
  const { toast } = useToast();

  const [tab, setTab] = useState<"audit" | "methodology">("audit");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => readJSON<string>(KEY_KEY, ""));
  const [frameworks, setFrameworks] = useState<Framework[]>(["GDPR", "HIPAA", "SOC2", "CCPA"]);
  const [contractInput, setContractInput] = useState<string>("");

  const [contract, setContract] = useState<string>("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [agents, setAgents] = useState<AgentRunState[]>(initialAgents);
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<"live" | "demo" | null>(null);
  const [runId, setRunId] = useState(0);
  const heroShown = audits.length > 0;
  const heroRef = useRef<HTMLDivElement | null>(null);

  // ---------- Hydrate from storage on mount ----------
  useEffect(() => {
    const saved = readJSON<AnalysisState | null>(SESSION_KEY, null);
    if (saved && saved.clauses?.length) {
      setContract(saved.contractText);
      setContractInput(saved.contractText);
      setClauses(saved.clauses);
      setAudits(saved.audits);
      setRemediations(saved.remediations);
      setOverrides(saved.overrides ?? {});
      setFrameworks(saved.frameworks ?? ["GDPR", "HIPAA", "SOC2", "CCPA"]);
      setSource(saved.source);
      setAgents(
        initialAgents.map((a) => ({ ...a, status: "done", progress: 1 })),
      );
      setRunId((x) => x + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Persist session ----------
  useEffect(() => {
    if (clauses.length === 0) return;
    const state: AnalysisState = {
      contractText: contract,
      frameworks,
      clauses,
      audits,
      remediations,
      overrides,
      agents,
      source,
    };
    writeJSON(SESSION_KEY, state);
  }, [contract, frameworks, clauses, audits, remediations, overrides, agents, source]);

  // Persist API key separately
  useEffect(() => {
    writeJSON(KEY_KEY, apiKey);
  }, [apiKey]);

  // ---------- Score & stats ----------
  const score = useMemo(() => computeScore(audits, overrides), [audits, overrides]);
  const stats = useMemo(() => {
    const hi = audits.filter((a) => a.risk_level === "High").length;
    return { total: clauses.length, high: hi, frameworks: frameworks.length };
  }, [audits, clauses.length, frameworks.length]);

  const clauseTypeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clauses) m[c.clause_id] = c.clause_type;
    return m;
  }, [clauses]);

  // ---------- Agent helpers ----------
  function setAgent(name: AgentName, patch: Partial<AgentRunState>) {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, ...patch } : a)),
    );
  }

  // ---------- Run pipeline ----------
  async function run(textOverride?: string, forceDemo = false) {
    const text = (textOverride ?? contractInput).trim();
    if (!text) {
      toast({
        title: "Add a contract",
        description: "Paste a contract or click 'Load sample' to try ClauseGuard.",
      });
      return;
    }
    if (running) return;

    setRunning(true);
    setContract(text);
    setClauses([]);
    setAudits([]);
    setRemediations([]);
    setOverrides({});
    setSource(null);
    setAgents(initialAgents.map((a) => ({ ...a, status: "idle", progress: 0 })));
    setRunId((x) => x + 1);

    try {
      const result = await runPipeline({
        contract: text,
        frameworks,
        apiKey,
        forceDemo,
        callbacks: {
          onAgentStart: (name) =>
            setAgent(name, { status: "running", progress: 0, startedAt: Date.now() }),
          onProgress: (name, p) => setAgent(name, { progress: p }),
          onAgentDone: (name, src) => {
            setAgent(name, { status: "done", progress: 1, endedAt: Date.now() });
            if (name === "Compliance Auditor") {
              // Snap to hero after Agent 2 completes.
              setTimeout(() => {
                heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 250);
            }
          },
          onClauses: setClauses,
          onAudits: setAudits,
          onRemediations: setRemediations,
          onLog: (msg) => console.info("[ClauseGuard]", msg),
        },
      });
      setSource(result.source);
      toast({
        title: result.source === "live" ? "Live analysis complete" : "Demo analysis complete",
        description:
          result.source === "live"
            ? "Verdicts and rewrites from Claude."
            : "No live API key or call blocked — showing deterministic demo data.",
      });
    } catch (e: any) {
      toast({
        title: "Pipeline failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  // ---------- Reviewer override handler ----------
  const handleOverride: React.ComponentProps<typeof ClauseReview>["onOverride"] = (
    id,
    decision,
    note,
  ) => {
    setOverrides((prev) => {
      const existing = prev[id];
      if (existing && existing.decision === decision && (decision !== "note" || existing.note === note)) {
        // Toggle off
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { clause_id: id, decision, note, at: Date.now() } };
    });
  };

  // ---------- Export ----------
  const onExportDownload = () => {
    const text = buildReport({
      clauses,
      audits,
      remediations,
      overrides,
      frameworks,
      source,
    });
    downloadText(`clauseguard-report-${Date.now()}.txt`, text);
    toast({ title: "Report downloaded", description: "PM-ready summary saved." });
  };

  const onExportCopy = async () => {
    const text = buildReport({
      clauses,
      audits,
      remediations,
      overrides,
      frameworks,
      source,
    });
    const ok = await copyText(text);
    toast({
      title: ok ? "Report copied" : "Copy failed",
      description: ok ? "PM-ready summary on your clipboard." : "Use the Download button instead.",
      variant: ok ? "default" : "destructive",
    });
  };

  const onClearAll = () => {
    setContract("");
    setContractInput("");
    setClauses([]);
    setAudits([]);
    setRemediations([]);
    setOverrides({});
    setSource(null);
    setAgents(initialAgents.map((a) => ({ ...a, status: "idle", progress: 0 })));
    setRunId((x) => x + 1);
    writeJSON(SESSION_KEY, null as any);
    setSettingsOpen(false);
    toast({ title: "Session cleared" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Disclaimer banner (fixed, exact text required) */}
      <div
        className="sticky top-0 z-40 w-full bg-amber-500/15 border-b border-amber-500/30 backdrop-blur"
        data-testid="banner-disclaimer"
      >
        <div className="mx-auto max-w-[1400px] px-5 py-1.5 flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-[11.5px] font-medium text-amber-200/90 tracking-wide">
            For screening purposes only. Does not constitute legal advice.
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b bg-card/40 backdrop-blur sticky top-[28px] z-30">
        <div className="mx-auto max-w-[1400px] px-5 py-3 flex items-center justify-between gap-4">
          <LogoMark />
          <div className="flex items-center gap-1.5">
            <div className="hidden md:flex items-center mr-1 rounded-md border bg-muted/30 p-0.5">
              <TabBtn active={tab === "audit"} onClick={() => setTab("audit")} testId="tab-audit">
                <FileText className="h-3.5 w-3.5" />
                Audit
              </TabBtn>
              <TabBtn
                active={tab === "methodology"}
                onClick={() => setTab("methodology")}
                testId="tab-methodology"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Methodology
              </TabBtn>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={() => setSettingsOpen(true)}
              data-testid="btn-settings"
            >
              <Cog className="h-3.5 w-3.5 mr-1.5" />
              Settings
              <span className="ml-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {apiKey ? "live" : "demo"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs body */}
      <main className="mx-auto max-w-[1400px] w-full px-5 py-6 flex-1">
        {tab === "audit" ? (
          <>
            {/* Input panel */}
            <section className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step 1
                  </span>
                  <span className="text-[13px] font-medium truncate">Paste a vendor contract</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11.5px]"
                    onClick={() => setContractInput(SAMPLE_CONTRACT)}
                    disabled={running}
                    data-testid="btn-load-sample"
                  >
                    <Beaker className="h-3 w-3 mr-1" />
                    Load sample
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11.5px]"
                    onClick={() => setContractInput("")}
                    disabled={running || !contractInput}
                    data-testid="btn-clear-input"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <textarea
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="Paste the vendor contract text here, or click 'Load sample' to try a SaaS data addendum with deliberate GDPR + CCPA violations."
                className="w-full bg-background min-h-[160px] max-h-[280px] resize-y border-0 outline-none px-5 py-3 font-mono text-[12.5px] leading-[1.65]"
                disabled={running}
                data-testid="input-contract"
              />
              <div className="flex items-center justify-between border-t px-4 py-2.5 bg-card/60">
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {contractInput.length.toLocaleString()} chars · Frameworks:{" "}
                  {frameworks.join(" · ")}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 text-[12px]"
                    onClick={() => run()}
                    disabled={running || !contractInput.trim()}
                    data-testid="btn-run"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Run audit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>

            {/* Agent timeline */}
            <section className="mt-5">
              <AgentTimeline agents={agents} />
            </section>

            {/* Hero — appears after Agent 2 */}
            {heroShown && (
              <section
                ref={heroRef}
                className="mt-7 rounded-2xl border bg-card relative overflow-hidden float-up"
                data-testid="hero-panel"
              >
                <div className="absolute inset-0 grid-bg opacity-[0.35] pointer-events-none" />
                <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-7 p-6 lg:p-8">
                  <div className="flex items-center justify-center">
                    <ScoreRing score={score} animationKey={runId} />
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Audit result
                    </div>
                    <h2 className="text-[24px] md:text-[28px] font-semibold tracking-tight mt-1 leading-tight">
                      {headlineFor(score, stats.high)}
                    </h2>
                    <p className="text-muted-foreground text-[13.5px] leading-[1.6] mt-1.5 max-w-xl">
                      {bodyFor(score, stats.high, source)}
                    </p>

                    <div className="mt-5 grid grid-cols-3 gap-3 max-w-2xl">
                      <StatPill label="Total Clauses" value={stats.total} testId="stat-total" />
                      <StatPill
                        label="High Risk"
                        value={stats.high}
                        accent={stats.high > 0 ? "hsl(var(--risk-high))" : undefined}
                        testId="stat-high"
                      />
                      <StatPill
                        label="Frameworks Checked"
                        value={stats.frameworks}
                        testId="stat-frameworks"
                      />
                    </div>

                    <div className="mt-5 flex items-center flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px]"
                        onClick={onExportDownload}
                        data-testid="btn-export-download"
                        disabled={running || audits.length === 0}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export report
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[12px]"
                        onClick={onExportCopy}
                        data-testid="btn-export-copy"
                        disabled={running || audits.length === 0}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy to clipboard
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Heatmap directly under the ring */}
                <div className="relative border-t px-6 lg:px-8 py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Risk Heatmap
                      </div>
                      <div className="text-[13px] font-medium mt-0.5">
                        Violations by clause type and risk level
                      </div>
                    </div>
                  </div>
                  <RiskHeatmap audits={audits} clauseTypes={clauseTypeMap} />
                </div>
              </section>
            )}

            {/* Clause review */}
            {audits.length > 0 && (
              <section className="mt-7">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Step 3
                    </div>
                    <div className="text-[15px] font-semibold tracking-tight">
                      Clause-by-clause review
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {Object.keys(overrides).length} of {audits.length} clauses with reviewer action
                  </div>
                </div>
                <ClauseReview
                  contract={contract}
                  clauses={clauses}
                  audits={audits}
                  remediations={remediations}
                  overrides={overrides}
                  onOverride={handleOverride}
                />
              </section>
            )}

            {/* Empty state */}
            {audits.length === 0 && !running && (
              <section className="mt-7 rounded-lg border border-dashed bg-card/40 p-10 text-center">
                <div className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  Awaiting input
                </div>
                <div className="text-[15px] font-medium mt-1.5">
                  Paste a contract or load the sample to start the three-agent audit.
                </div>
                <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-md mx-auto">
                  ClauseGuard chains a Clause Extractor, Compliance Auditor, and Remediation Writer.
                  Each agent runs visibly so you can audit the AI, not just the contract.
                </p>
              </section>
            )}

            {/* Footer */}
            <footer className="mt-12 border-t pt-5 pb-8 flex items-center justify-between text-[11px] text-muted-foreground">
              <div>
                Storage:{" "}
                <span className="font-mono">
                  {storageBackend() === "local" ? "localStorage" : "in-memory"}
                </span>{" "}
                · Model: <span className="font-mono">claude-sonnet-4-20250514</span>
              </div>
              <div>v0.4 · prototype</div>
            </footer>
          </>
        ) : (
          <section className="mt-2 rounded-lg border bg-card p-7 max-w-[900px]">
            <Methodology />
          </section>
        )}
      </main>

      {settingsOpen && (
        <SettingsPanel
          apiKey={apiKey}
          setApiKey={setApiKey}
          frameworks={frameworks}
          setFrameworks={(f) => setFrameworks(f.length === 0 ? FRAMEWORKS : f)}
          onClose={() => setSettingsOpen(false)}
          onClearAll={onClearAll}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium transition-colors " +
        (active
          ? "bg-card text-foreground border border-border shadow-xs"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function StatPill({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: number;
  accent?: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-lg border bg-background/60 px-4 py-3"
      data-testid={testId}
    >
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function headlineFor(score: number, high: number): string {
  if (score >= 80) return "Materially compliant. A few minor cleanups.";
  if (score >= 60) return `${high} high-risk clause${high === 1 ? "" : "s"} to remediate before signing.`;
  return "Do not sign as drafted. Multiple statutory violations.";
}

function bodyFor(score: number, high: number, src: "live" | "demo" | null): string {
  const liveTxt = src === "live" ? "Live Claude analysis." : "Deterministic demo dataset.";
  if (score >= 80)
    return `${liveTxt} The contract aligns with the selected frameworks on most material points; review the medium-risk items and ship.`;
  if (score >= 60)
    return `${liveTxt} ClauseGuard found gaps that procurement should not ignore. Use the rewrites as a redline starting point.`;
  return `${liveTxt} The vendor is asking for terms that breach core statutory obligations. Send the redlines back today.`;
}
