# Crew Health

NASA Space Apps Challenge 2026 team project (Snow Geeks): health monitoring
software that helps astronauts on long missions assess their own health and
act on it before Earth can answer.

Crew data in this project is simulated. The limits and checklists in `data/`
are drafts, not medical advice (see [docs/sources.md](docs/sources.md)).

## Run it

```bash
python3 backend/main.py
```

Then open http://localhost:8000 for the crew screen and
http://localhost:8000/doctor.html for the flight surgeon screen. Nothing to
install; it uses only the Python standard library and works offline.

Optional extras:

- **Local AI:** install [Ollama](https://ollama.com) and pull one small model.
  The app uses whichever model is installed and falls back to written
  explanations when none is running.
- **Apple Watch baseline:** put a Health export in `private/` and run
  `python3 backend/simulator/watch_import.py private/export.zip`.
- **Real NASA event:** `python3 backend/nasa_data/donki.py` refreshes the saved
  solar particle event (needs internet once).

## What it does

| Situation | What happens |
|---|---|
| First launch | The crew member fills in a profile: pre-flight baseline, medical notes, and where they are (which sets the Earth delay) |
| Every day | A ten-second check-in (mood, sleep, measurements, where anything hurts) sends a daily report to the flight surgeon. All-green reports are acknowledged automatically; anything else waits for the doctor's feedback |
| A reading goes out of range | The home screen alerts immediately, shows a checklist, and tells Earth |
| "I need help" | Alerts the crew medical officer and Earth at once, asks fixed questions, shows steps, and sends the assessment |

The home screen is a body figure coloured by status. Tapping a part shows
its readings, what they mean, why they matter in space, and a 30-day chart
against the crew member's own normal range.

The local AI explains readings and checklists and reads a typed description
of symptoms. It never decides what the crew member should do: fixed rules
and written checklists do that.

## Where things are

| Path | What |
|---|---|
| `backend/main.py` | Server and all endpoints |
| `backend/simulator/` | Simulated readings, demo scenarios, Apple Watch import |
| `backend/rules/` | Status rules, drift detection, emergency questions |
| `backend/comms.py` | Earth link with signal delay |
| `backend/ai/explain.py` | Ollama calls and their fallbacks |
| `backend/nasa_data/donki.py` | NASA DONKI solar event fetcher |
| `data/` | Limits, checklists and explanations as editable JSON |
| `frontend/` | The screens (plain HTML, CSS and JavaScript) |
| `private/` | Profile and smartwatch data; ignored by Git |

More detail: [docs/getting-started.md](docs/getting-started.md),
[docs/contract.md](docs/contract.md), [docs/demo.md](docs/demo.md).
