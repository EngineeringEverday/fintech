// Browser-side Claude client. Calls the Anthropic Messages API directly with
// the dangerous browser flag — for LOCAL DEMO USE ONLY. The Settings panel
// surfaces the security note prominently.

import { CLAUDE_MODEL } from "./prompts";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export interface ClaudeCallArgs {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
  /** Caller can cap output tokens. */
  maxTokens?: number;
}

export interface ClaudeResult<T> {
  ok: boolean;
  data?: T;
  rawText?: string;
  error?: string;
}

/**
 * Calls Claude and returns the parsed JSON array.
 * Strips any markdown fences if present (the prompt asks for raw JSON but we
 * defensively handle ```json blocks).
 */
export async function callClaudeJSON<T>(args: ClaudeCallArgs): Promise<ClaudeResult<T>> {
  if (!args.apiKey || !args.apiKey.startsWith("sk-ant-")) {
    return { ok: false, error: "Missing or invalid Anthropic API key." };
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: args.maxTokens ?? 4096,
        system: args.systemPrompt,
        messages: [{ role: "user", content: args.userContent }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Anthropic API ${res.status}: ${text.slice(0, 200)}` };
    }
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text =
      body.content?.map((b) => b.text ?? "").join("\n").trim() ?? "";
    const parsed = parseJSONArray<T>(text);
    if (!parsed) return { ok: false, rawText: text, error: "Could not parse model output as JSON array." };
    return { ok: true, data: parsed, rawText: text };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error (likely CORS in this environment)." };
  }
}

function parseJSONArray<T>(raw: string): T | null {
  if (!raw) return null;
  // Strip code fences if present
  let s = raw.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) s = fenced[1].trim();
  // Sometimes the model returns objects-with-array; try direct parse first.
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }
  // Try to find the first '[' ... last ']' span
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}
