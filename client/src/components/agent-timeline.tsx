// Three-step agent progress strip. Each pill shows status, progress bar,
// and a tiny shimmer while running.

import { Check, Loader2 } from "lucide-react";
import type { AgentRunState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentTimeline({ agents }: { agents: AgentRunState[] }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
      data-testid="agent-timeline"
    >
      {agents.map((a, i) => (
        <AgentPill key={a.name} agent={a} index={i + 1} />
      ))}
    </div>
  );
}

function AgentPill({ agent, index }: { agent: AgentRunState; index: number }) {
  const running = agent.status === "running";
  const done = agent.status === "done";
  return (
    <div
      className={cn(
        "relative rounded-md border bg-card px-4 py-3 overflow-hidden",
        running && "border-primary/50",
        done && "border-border",
      )}
      data-testid={`agent-pill-${index}`}
    >
      {running && <div className="absolute inset-x-0 top-0 h-px shimmer" />}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "h-6 w-6 grid place-items-center rounded-full text-[11px] font-semibold shrink-0",
              done && "bg-primary text-primary-foreground",
              running && "bg-primary/15 text-primary",
              agent.status === "idle" && "bg-muted text-muted-foreground",
              agent.status === "error" && "bg-destructive/20 text-destructive",
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" /> : running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{agent.name}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {labelFor(agent)}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums tabular-nums shrink-0">
          {Math.round(agent.progress * 100)}%
        </div>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            done ? "bg-primary" : running ? "bg-primary/80" : "bg-muted-foreground/30",
          )}
          style={{ width: `${Math.max(2, agent.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function labelFor(a: AgentRunState): string {
  switch (a.status) {
    case "idle":
      return "Queued";
    case "running":
      return "Working…";
    case "done":
      if (a.startedAt && a.endedAt) return `Done · ${((a.endedAt - a.startedAt) / 1000).toFixed(1)}s`;
      return "Done";
    case "error":
      return a.message ?? "Error";
  }
}
