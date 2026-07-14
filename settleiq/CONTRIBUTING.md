# Contributing to SettleIQ

This is a portfolio prototype. Contributions are not expected, but here is the development workflow for anyone who wants to extend it.

---

## Local setup

```bash
git clone https://github.com/YOUR_USERNAME/settleiq.git
cd settleiq
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python data/mock_generator.py   # seed the database
```

## Verify everything works

```bash
python pipeline_runner.py --demo          # UC1–UC12, all should pass
python -m py_compile dashboard/app.py     # syntax check
```

## Adding a new skill (new domain)

1. Create `skills/your_skill.py` with a `run(env: RouterEnvelope) -> dict` function. The returned dict must include `title`, `body`, `cta`, and `metrics`.
2. Add an entry to `data/DOMAIN_REGISTRY.json`:
   ```json
   "your_domain": {
     "skill_path": "skills.your_skill",
     "entry": "run",
     "description": "Short description"
   }
   ```
3. Add routing keywords to `DOMAIN_KEYWORDS` in `agents/router.py`.
4. Add at least one test query to `docs/SAMPLE_QUERIES.md`.

## Adding new merchants or events

Edit and re-run `data/mock_generator.py`. It is idempotent (drops and recreates all tables on each run).

## Connecting a real LLM

Set `USE_REAL_LLM=true` in your `.env` file (copy from `.env.example`) and add your API key. The formatter in `agents/formatter.py` is the natural hook point — replace the deterministic Markdown assembly with an LLM call.

## Code style

- Python 3.10+, standard library preferred.
- Type hints on all public functions.
- Each agent module is independently importable — avoid circular imports.
- No external dependencies beyond `streamlit`.
