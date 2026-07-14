# ClauseGuard

**AI compliance auditor for vendor contracts and privacy policies.** Paste a SaaS contract or privacy policy, pick the frameworks you need (GDPR / HIPAA / SOC2 / CCPA), and watch three sequential AI agents extract every clause, audit it against the rulebook, and propose compliant rewrites — with a PM-ready report you can export.

ClauseGuard is a senior-AI-PM portfolio piece. The product surface, agent design, prompts, and audit UX are the deliverable; the codebase is React + Vite + Tailwind on top of the Anthropic Claude API, no backend.

**Live demo:** https://clauseguard-gamma.vercel.app

---

## Why this exists

Procurement, security, and legal teams routinely review the same vendor contracts and privacy policies against the same regulations. The bottleneck is almost never finding the clauses — it's reading them, mapping them to a framework, and writing a defensible rewrite. ClauseGuard models that workflow as three specialized agents and gives the reviewer an audit-grade dashboard, not a chat transcript.

For a senior AI PM portfolio, the goal is to show:

- A real product opinion about where LLMs add leverage (multi-agent decomposition, deterministic JSON contracts, progressive UI) versus where humans stay in the loop (overrides, methodology disclosures, exportable artifacts).
- An interface that looks like a tool an enterprise reviewer would actually use, not a wrapped chat.
- A defensible methodology tab, framework selection, and a disclaimer that takes the legal posture seriously.

---

## Core flow

1. Paste a contract or privacy policy into the editor (a representative sample is loaded by default).
2. Toggle the frameworks to audit against — GDPR, HIPAA, SOC2, CCPA — in any combination.
3. Click **Run Audit**. Three agents run sequentially with live progress bars:
   - **Extractor** splits the document into typed clauses.
   - **Auditor** scores each clause against the selected frameworks.
   - **Remediator** drafts a compliant replacement for every non-compliant or needs-review clause.
4. Results stream into the dashboard progressively — score ring, risk heatmap, and side-by-side clause review fill in as each agent finishes.
5. Accept, reject, or edit any remediation. Export a PM-ready report.

---

## Key features

- **Animated compliance score ring** — single-glance health metric with threshold-driven colors (green / amber / red).
- **Recharts risk heatmap** — stacked bar of High / Med / Low risk per framework, so a reviewer can see *where* the contract fails, not just how badly.
- **Side-by-side clause review** — original clause, audit verdict, violated rules, and a confidence score in one row; the proposed rewrite sits next to it.
- **Remediation rewrites** — every non-compliant clause gets a drafted compliant alternative with a plain-English change summary and a "what was wrong" note.
- **Human override with localStorage** — accept / reject / edit any remediation; decisions persist across reloads with an in-memory fallback when storage is blocked.
- **PM-ready export** — copy or download a structured text report covering scope, score, framework triggers, accepted edits, and outstanding risks.
- **Methodology tab** — an in-app PM doc that explains the agent contract, prompts, scoring, and intentional limitations. Recruiters can read it without leaving the app.
- **Disclaimer banner** — pinned at the top, exact text per the legal brief, so the audit posture is unambiguous.

---

## Tech stack

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** with a dark-first audit palette (slate `#0E1116`, teal `#2DD4BF` accent, red / amber / green risk tokens)
- **Recharts** for the risk heatmap
- **Anthropic Claude API** — model `claude-sonnet-4-20250514`, called directly from the browser
- **localStorage** (with in-memory fallback) for human overrides and API key persistence
- **Frontend-only — no backend.** The static bundle in `dist/public/` is the entire deploy target.

---

## AI agent architecture

Three agents run in a strict sequence. Each has a locked system prompt and a JSON output contract — no free-form prose, no preamble — so the UI can render every stage deterministically.

| Agent | Role | Output contract |
|---|---|---|
| **Extractor** | Legal document analyst. Splits the input into distinct clauses and types each one (Data Collection / Retention / Sharing / Security / User Rights / Liability / Other). | `[{clause_id, clause_text, clause_type}]` |
| **Auditor** | Regulatory compliance expert across GDPR, HIPAA, SOC2, CCPA. Returns a verdict, violated rules, risk level, confidence, and the framework that triggered the finding. | `[{clause_id, verdict, violated_rules, risk_level, explanation, confidence_score, framework_triggered}]` |
| **Remediator** | Legal copywriter. For every non-compliant or needs-review clause, drafts a compliant replacement with a change summary and a "what was wrong" note. | `[{clause_id, compliant_alternative, change_summary, what_was_wrong}]` |

Prompts are in `client/src/lib/prompts.ts` and are treated as the contract between the app and the model.

---

## Demo mode and API-key behavior

ClauseGuard works with or without an Anthropic API key:

- **No key (demo mode)** — the three agents run against a deterministic sample audit so the entire pipeline, animations, and UI complete in under a minute. Every screenshot in the repo was captured against demo mode.
- **With a key** — the browser calls the Claude API directly. If the network fails or CORS blocks the request, ClauseGuard transparently falls back to the demo path for that agent so the audit always completes.

**Browser-side key security note.** Any API key entered into the Settings panel is held in `localStorage` and sent directly from the browser to Anthropic. That is fine for a local portfolio demo, but anyone with access to the browser session can read the key. The Settings panel surfaces this in a red call-out. A production deployment must proxy LLM calls through a server with non-exportable credentials.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5000
npm run build        # static bundle in dist/public/
```

The static bundle is the deploy target — drop it on any static host (Vercel, Netlify, S3, GitHub Pages).

---

## Repository layout

- `client/src/pages/home.tsx` — the entire dashboard composition
- `client/src/lib/agents.ts` — sequential three-agent pipeline + live/demo fallback
- `client/src/lib/prompts.ts` — locked agent prompts
- `client/src/lib/sample.ts` — sample contract + deterministic audits / rewrites
- `client/src/lib/storage.ts` — guarded localStorage with in-memory fallback
- `client/src/lib/score.ts` — compliance score + ring color thresholds
- `client/src/lib/report.ts` — PM-ready text report generator
- `client/src/components/score-ring.tsx` — animated SVG compliance score ring
- `client/src/components/risk-heatmap.tsx` — Recharts stacked risk bar
- `client/src/components/clause-review.tsx` — side-by-side annotated clause review
- `client/src/components/methodology.tsx` — in-app PM doc
- `client/src/components/settings-panel.tsx` — API key + framework selection

---

## Product / PM notes

- **Why three agents, not one prompt.** Single-prompt audits hallucinate clause boundaries and merge verdicts with rewrites. Splitting the pipeline into extract → audit → remediate lets each agent specialize, gives the UI clean handoffs to animate, and makes failure modes legible (a bad audit is easy to spot when the rewrite contradicts it).
- **Why JSON-only contracts.** Free-form LLM output cannot be rendered into an audit dashboard reliably. Locking each agent to a JSON schema is what makes the score ring, heatmap, and clause review possible.
- **Why progressive results.** A 60-second audit feels frozen if nothing renders until the last token. Streaming each agent's results into the UI as it finishes turns the latency into a feature — the reviewer sees the system working.
- **Why human override is first-class.** Compliance is a judgment call. The product is wrong if it pretends the LLM is the source of truth; it's right if it makes the reviewer's decision faster and exportable.

## Limitations

- Not a substitute for a qualified attorney or a SOC2 auditor.
- Scope is contract and privacy-policy text; the agents do not reason about your actual data flows, vendor configuration, or contractual amendments.
- Browser-side API keys are not safe for shared environments.
- Framework coverage is GDPR / HIPAA / SOC2 / CCPA only.

## Legal disclaimer

ClauseGuard is a portfolio demonstration. It does not provide legal advice and its output is not a compliance certification. Do not rely on it for regulatory decisions. Engage qualified counsel and your auditors for any production review.
