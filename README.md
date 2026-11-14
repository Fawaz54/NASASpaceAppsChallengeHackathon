# NASASpaceAppsChallengeHackathon

NASA Space Apps Challenge 2026 team project: health monitoring software that
lets astronauts on long missions spot radiation, bone, heart and behavioral
health risks themselves and act on them before Earth can answer.

Crew data in this project is simulated.

## Run it

```bash
python3 backend/main.py
```

Then open http://localhost:8000. Nothing to install; it uses only the Python
standard library. The "Ask why" feature will also need [Ollama](https://ollama.com)
running with the model named in `backend/ai/explain.py`.

## Where things are

| Folder | What | Owner |
|---|---|---|
| `backend/simulator/`, `backend/nasa_data/` | Fake readings, scenarios, DONKI data | Abel (Backend A) |
| `backend/rules/`, `backend/ai/`, `backend/main.py` | Status rules, local AI, Earth link, server | Fawaz (Backend B) |
| `frontend/index.html`, `frontend/css/` | Home screen and shared styles | Mika (Frontend 1) |
| `frontend/checkin.html`, `frontend/trend.html` | Check-in, body map, trends | Srijana (Frontend 2) |
| `data/`, `docs/sources.md`, `frontend/ask.html` | Cited thresholds and protocols, "Ask why" | Mehek (Frontend 3) |
| `private/` | Smartwatch exports; git-ignored, never commit | |

Start with [docs/getting-started.md](docs/getting-started.md), then follow your own
guide from [docs/roles.md](docs/roles.md). The data format everyone builds against
is in [docs/contract.md](docs/contract.md).

## Working together

- One branch per task, merged into `main` by pull request.
- `main` must always start with the run command above.
- Stay in your own files; if you need a change in someone else's, ask them.
