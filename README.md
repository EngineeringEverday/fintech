# PayCommander -- Multi-Agent Payment Analytics Pipeline

PayCommander is a portfolio prototype of a recruiter-friendly, **deterministic-first** multi-agent system for US payment analytics. A single natural-language question ("What is DoorDash's authorization rate on Visa cards this week?") flows through **six specialized agents** -- classifier, router, data analyst, sanity gate, response formatter, auditor -- and returns a clean markdown answer alongside a live observer-portal trace showing every step's status, latency, mock token cost, and full JSON payload. The system ships with 80+ realistic US merchants, seven days of ACH CSVs, a 100K-row SQLite card warehouse, an audit log table, a Slack-style chat UI, and a downloadable daily MIS PDF report -- **zero API keys, runs offline by default**.

---

## Architecture

```
                                 +----------------------+
                                 |   User query (chat)  |
                                 +----------+-----------+
                                            |
                                            v
+--------------+   +--------------+   +--------------+   +-----------------+
|  Agent 1     |   |  Agent 2     |   |  Agent 3     |   |   Agent 4       |
|  Main        |-->|  Query       |-->|  Data        |-->|   Sanity        |
|  Classifier  |   |  Router      |   |  Analyst     |   |   Validation    |
|              |   |              |   |              |   |   Gate          |
| - regex      |   | - dates      |   | - lazy-load  |   | - 60-99.9% auth |
|   gate       |   | - fuzzy MIDs |   |   skill file |   | - $50M/day GPV  |
| - injection  |   | - route ACH  |   | - SQL / CSV  |   | - no negatives  |
|   block      |   |   vs Card    |   | - formulas   |   | - alert banner  |
+------+-------+   +------+-------+   +------+-------+   +--------+--------+
       |hard-stop                                                  | anomaly
       v          +------------------------------+                 v
+--------------+  |    skills/domains/*.py        |          +-------------+
| Safe message |  | authorization_rate.py         |          | Block +     |
| + audit log  |  | payment_volume.py             |          | CRITICAL    |
+--------------+  | decline_analysis.py           |          | event       |
                  | chargeback_rate.py            |          +------+------+
                  | fraud_signals.py              |                 |
                  +-------------------------------+                 |
                                                                    v
                  +---------------+   +-----------------+   +-----------------+
                  |  Agent 5      |   |  Agent 6        |   |  pipeline_      |
                  |  Response     |-->|  Auditor        |-->|  events table   |
                  |  Formatter    |   |  Logger         |   |  (SQLite)       |
                  | (markdown,    |   | (trace + hash + |   +-----------------+
                  |  USD/%/delta) |   |  token cost +   |
                  +---------------+   |  latency)       |
                                      +-----------------+

Data sources:
  data/mock/card_analytics.db    -- card_analytics_dwh (100K+ rows) + pipeline_events
  data/mock/ach_tx_YYYY_MM_DD.csv-- seven daily ACH CSVs
  data/mock/merchant_profile.json-- 85 US merchants -> MIDs
  data/mock/DOMAIN_REGISTRY.json -- metric -> skill file mapping
```

---

## Quick start (3 commands)

```bash
pip install -r requirements.txt
uvicorn dashboard.api:app --port 8000 &
streamlit run dashboard/app.py --server.port 8501
```

Then open <http://localhost:8501>.

The mock data is generated automatically on first API import (deterministic seed; ~5 seconds the first time). To regenerate explicitly, run `python data/generate_mock_data.py`.

### One-command launcher

```bash
python run_local.py
```

starts both servers and prints the URL.

---

## Project layout

```
paycommander/
  agents/
    agent1_main_classifier.py     # regex/keyword pre-LLM gate
    agent2_query_router.py        # dates, fuzzy MIDs, route, metric
    agent3_data_analyst.py        # lazy-loads skill files, queries DWH / ACH
    agent4_sanity_gate.py         # numeric plausibility checks
    agent5_response_formatter.py  # markdown w/ USD, %, deltas, arrows
    agent6_auditor_logger.py      # full trace -> SQLite + in-memory dict
  skills/
    domains/
      authorization_rate.py
      payment_volume.py
      decline_analysis.py
      chargeback_rate.py
      fraud_signals.py
  data/
    generate_mock_data.py
    mock/                         # auto-generated on first run
  dashboard/
    api.py                        # FastAPI backend
    app.py                        # Streamlit frontend
  tests/
    test_pipeline.py              # smoke tests for the 6 preset queries
  pipeline_runner.py              # orchestrator + CLI: python pipeline_runner.py "..."
  requirements.txt
  .env.example
  README.md
```

---

## Why deterministic-first?

| Concern         | Pure-LLM agent stack                | PayCommander (deterministic-first)        |
| --------------- | ----------------------------------- | ----------------------------------------- |
| Reproducibility | Stochastic; same query, two answers | Identical output every run                |
| Latency         | 2-10 s per agent x 6 = 12-60 s      | <1 s end-to-end (no API hops)             |
| Cost            | $0.01-$0.50 / query                 | $0 / query (mock token meter for display) |
| Injection risk  | Mitigated, never eliminated         | Hard-stopped by Agent 1 regex gate        |
| Sanity errors   | "Hallucinated 142% auth rate"       | Blocked at Agent 4 with audit-log alert   |
| Recruiter demo  | Needs API keys + internet           | Zero-config, runs on a laptop offline     |

The architecture **does not exclude LLMs** -- Agents 1, 2 and 5 are designed as clean swap-in points where an LLM can replace or augment the deterministic logic via `PAYCOMMANDER_USE_LLM=1` and the Anthropic/OpenAI envs in `.env.example`. The default path keeps the recruiter-facing demo bullet-proof: every preset query produces the same answer, every time, with zero external dependencies.

---

## Tech stack

| Layer            | Choice                                                    |
| ---------------- | --------------------------------------------------------- |
| Backend          | Python 3.10+, FastAPI, Uvicorn                            |
| Frontend         | Streamlit (Slack-style chat + observer portal)            |
| Data warehouse   | SQLite (file-backed, zero ops)                            |
| ACH source       | Daily CSVs (one per day, last 7 days)                     |
| Fuzzy matching   | rapidfuzz (sub-ms merchant -> MID resolution)             |
| MIS export       | reportlab (PDF generated server-side)                     |
| Audit log        | SQLite `pipeline_events` table                            |

---

## Testing

```bash
python -m pytest tests/ -v
```

The test suite runs each of the six preset queries through the full pipeline and asserts the expected agent buckets and routes.

---

## Notes

- The `[your-handle]` in the footer is a placeholder. Replace once the repo URL is final.
- `data/mock/` is regenerated automatically if any required file is missing. Delete the directory to start fresh.
- The Anthropic / OpenAI integration is stubbed; the default deterministic path is the recommended one for the demo.

---

Built by **Prabhjot Singh Ahluwalia** | Georgia Tech MSCS (AI Specialization) | PayCommander Architecture Demo | `github.com/PrabhjotAhluwalia`
