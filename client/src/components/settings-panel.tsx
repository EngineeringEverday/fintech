// Settings — Claude API key field (browser-side), framework selectors,
// and a prominent security note.

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRAMEWORKS, type Framework } from "@/lib/types";
import { storageBackend } from "@/lib/storage";

interface Props {
  apiKey: string;
  setApiKey: (k: string) => void;
  frameworks: Framework[];
  setFrameworks: (f: Framework[]) => void;
  onClose: () => void;
  onClearAll: () => void;
}

export function SettingsPanel({
  apiKey,
  setApiKey,
  frameworks,
  setFrameworks,
  onClose,
  onClearAll,
}: Props) {
  const [show, setShow] = useState(false);
  const backend = storageBackend();

  const toggle = (f: Framework) => {
    if (frameworks.includes(f)) setFrameworks(frameworks.filter((x) => x !== f));
    else setFrameworks([...frameworks, f]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm grid place-items-center px-4" data-testid="settings-panel">
      <div className="w-full max-w-lg rounded-lg border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-semibold tracking-tight">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-[13px]"
            data-testid="btn-close-settings"
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* API key */}
          <div>
            <label className="text-[12px] font-medium text-foreground/90">
              Anthropic API key
            </label>
            <div className="mt-1.5 flex items-stretch gap-2">
              <div className="relative flex-1">
                <input
                  type={show ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-…"
                  className="w-full rounded border bg-background px-2.5 py-1.5 pr-9 text-[12.5px] font-mono"
                  data-testid="input-api-key"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide key" : "Show key"}
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground leading-[1.55]">
              Used only by your browser to call Claude (model{" "}
              <code className="font-mono">claude-sonnet-4-20250514</code>) directly.
              If no key is provided or the call is blocked by CORS, ClauseGuard falls back to a
              built-in deterministic demo dataset so the full UI still functions.
            </p>
            <div className="mt-2 flex items-start gap-2 rounded border border-destructive/40 bg-destructive/[0.07] px-2.5 py-2">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-destructive/90 leading-[1.5]">
                <strong>Security note:</strong> browser-side API keys are for local demo only.
                Anyone with access to this browser session can read the key. For production,
                proxy LLM calls through a server-side endpoint with a non-exportable key.
              </p>
            </div>
          </div>

          {/* Frameworks */}
          <div>
            <div className="text-[12px] font-medium text-foreground/90 mb-1.5">
              Audit frameworks
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FRAMEWORKS.map((f) => {
                const on = frameworks.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggle(f)}
                    className={
                      "px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors " +
                      (on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-foreground/80 border-border hover:border-primary/50")
                    }
                    data-testid={`btn-framework-${f}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session */}
          <div className="rounded border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-medium">Session storage</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  Backend:{" "}
                  <span className="font-mono">
                    {backend === "local" ? "localStorage" : "in-memory (sandbox fallback)"}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11.5px]"
                onClick={onClearAll}
                data-testid="btn-clear-session"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear session
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
