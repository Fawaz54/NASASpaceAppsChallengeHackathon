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
for windows:
```bash
py backend/main.py
```

Then open http://localhost:8000. 

Create an astronaut account or a flight
surgeon account (username only, no passwords) and sign in. This is a dummy account to separate
data from other people on the crew. 
Nothing to install; it uses only the Python standard library and works offline.



## What it does

| Situation | What happens |
|---|---|
| First launch | Sign in, or create an account. Astronauts fill in a profile: pre-flight baseline, medical notes |
| Every day | Six short assessments (vitals, mind and sleep, vision, body and pain, exercise, food and water). When all are done, the day's report goes to the medical officer (medical professional on Earth). All-green reports are acknowledged automatically; the rest wait for the doctor's feedback, and the report shows Sent, Delivered, then Reviewed |
| A reading goes out of range | The home screen alerts immediately, shows a checklist, and tells Earth |
| "I need help" | Built-in emergency mitigation system. Alerts the crew medical officer and Earth at once, asks what happened and injury-specific questions plus fixed danger signs, shows steps, and sends the assessment |

The home screen shows a 3D body figure whose organs are coloured by status of vitals,
small vitals tiles (colored and updated in real time), and a Mission card with radiation (today and the mission
total against NASA's career limit), exercise rings and mood. Mood and
exercise are never shown in amber or red; the flight surgeon still sees
their real status.

The local AI explains readings and checklists and reads a typed description
of symptoms. It never decides what the crew member should do: fixed rules
and written checklists do that.

The flight surgeon's screen also shows a mission control overview of a
simulated corps of 100 astronauts (`data/crew_dataset.json`).

## Where things are

| Path | What |
|---|---|
| `backend/main.py` | Server and all endpoints |
| `backend/simulator/` | Simulated readings, demo scenarios, Apple Watch import |
| `backend/rules/` | Status rules, drift detection, emergency questions |
| `backend/crew.py` | The simulated corps of 100 |
| `backend/comms.py` | Earth link with signal delay |
| `backend/cloud.py` | Earth-side archive in Microsoft Azure |
| `backend/ai/explain.py` | Ollama calls and their fallbacks |
| `backend/ai/speech.py`, `frontend/js/speech.js` | Speech to text with Whisper, offline |
| `backend/nasa_data/donki.py` | NASA DONKI solar event fetcher |
| `data/` | Limits, checklists and explanations as editable JSON |
| `frontend/` | The screens (plain HTML, CSS and JavaScript) |
| `frontend/js/organs.js`, `frontend/models/` | The 3D body on the home screen (three.js) |
| `tools/build_body.py` | Rebuilds the 3D body's point cloud (needs numpy) |
| `private/` | Accounts, profiles, smartwatch data and the Azure link; ignored by Git |

More detail: [docs/contract.md](docs/contract.md), [docs/demo.md](docs/demo.md).


Installs to make changes to the code:

- **Local AI:** install [Ollama](https://ollama.com) and pull one small model.
  The app uses whichever model is installed and falls back to written
  explanations when none is running.
- **Apple Watch baseline:** put a Health export in `private/` and run
  `python3 backend/simulator/watch_import.py private/export.zip`.
- **Speaking instead of typing:** offline speech-to-text with Whisper on the
  emergency and Ask screens. Setup is in [docs/speech.md](docs/speech.md).
- **Azure archive:** the Earth side can keep every report in Microsoft Azure
  Blob Storage. Setup is in [docs/azure.md](docs/azure.md).
- **Real NASA event:** `python3 backend/nasa_data/donki.py` refreshes the saved
  solar particle event (needs internet once).