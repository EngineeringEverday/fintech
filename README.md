# ClauseGuard

A senior-AI-PM portfolio piece: a three-agent AI pipeline that extracts, audits, and rewrites SaaS-vendor-contract clauses against GDPR, HIPAA, SOC2, and CCPA.

Dark-mode-first enterprise audit dashboard. React + Vite + Tailwind + Recharts. No backend — the browser calls Claude directly when an Anthropic API key is provided, with a deterministic demo fallback so the whole UI works offline.

## Run

```bash
npm install
npm run dev          # http://localhost:5000
npm run build        # outputs static bundle to dist/public/
```

`dist/public/` is the static deploy target.

## Key files

- `client/src/pages/home.tsx` — the entire dashboard composition
- `client/src/lib/agents.ts` — sequential three-agent pipeline + live/demo fallback
- `client/src/lib/prompts.ts` — exact, locked agent prompts (do not edit)
- `client/src/lib/sample.ts` — sample contract + deterministic audits/rewrites
- `client/src/lib/storage.ts` — guarded localStorage with in-memory fallback
- `client/src/lib/score.ts` — compliance score + ring color thresholds
- `client/src/lib/report.ts` — PM-ready text report generator (download + copy)
- `client/src/components/score-ring.tsx` — animated SVG compliance score ring
- `client/src/components/risk-heatmap.tsx` — Recharts stacked bar
- `client/src/components/clause-review.tsx` — two-column annotated review
- `client/src/components/methodology.tsx` — internal PM doc
- `client/src/components/settings-panel.tsx` — Claude API key + frameworks
- `client/src/components/logo.tsx` — inline SVG logo

## Design

- Dark-first, audit-grade neutrals (slate background ~ #0E1116) + teal `#2DD4BF` accent
- Three risk colors: red `--risk-high`, amber `--risk-med`, green `--risk-low` — used consistently for ring, heatmap, and inline highlights
- Satoshi (Fontshare) for UI, JetBrains Mono for contract text and code-ish labels
- Disclaimer banner fixed top, exact text per brief

## Security note

Browser-side Anthropic API keys are exposed to anyone with access to the browser session. The Settings panel surfaces this in a red call-out. Production deployments must proxy LLM calls through a server with non-exportable credentials.
