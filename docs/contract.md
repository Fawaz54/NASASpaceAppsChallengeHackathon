# Data contract

What the backend sends and accepts. The screens depend on these shapes, so
change them only together with the frontend code that uses them.

Every request carries the signed-in username in an `X-User` header. There
are no passwords in this demo. Crew endpoints answer `{"error": "signin"}`
when the header does not name an astronaut account.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | `{username}` returns `{username, role, full_name}` |
| POST | `/api/signup` | `{role: "astronaut" or "doctor", full_name, username, ...profile fields}` |
| GET / POST | `/api/profile` | Read or save the astronaut's profile. GET also returns `suggested`, `environments` and `ranges` |
| GET | `/api/state` | Everything the crew screens need (shape below) |
| GET | `/api/indicators` | Plain-language text for each reading, from `data/indicators.json` |
| GET | `/api/history?metric=heart_rate` | `{metric, label, unit, baseline, band: [low, high], values: [30 daily values], crew_average}` |
| GET | `/api/assessments` | The daily check-in: `{assessments, done, sent, defaults, regions}` |
| POST | `/api/assessment` | `{id, data}` saves one assessment. When all are done the daily report is sent; returns `{saved, done, report_sent, all_clear}` |
| POST | `/api/feeling-better` | The crew member says they feel better during an alert; tells the flight surgeon |
| POST | `/api/nudge` | `{id: "mood"}` asks the flight surgeon for a private call |
| POST | `/api/steps` | `{protocol_id, done: [step numbers]}` remembers ticked checklist steps |
| POST | `/api/speech` | Body is a 16 kHz mono WAV recording; returns `{text}` or `{error}`. `state.speech.available` says whether it is set up |
| POST | `/api/ask` | `{question}` returns `{answer, based_on, used_ai}` |
| GET | `/api/triage` | Emergency questions: `{types, regions, onsets, signs}` |
| POST | `/api/emergency/start` | Alerts crew and Earth; returns the emergency |
| POST | `/api/emergency/describe` | `{description}` pre-fills answers from the crew member's words |
| POST | `/api/emergency/answer` | `{type, details, regions, severity, onset, signs}` chooses the checklist and sends the assessment |
| POST | `/api/emergency/resolve` | Closes the emergency |
| GET | `/api/doctor` | Earth side: `{astronauts, messages, in_transit, cloud}` |
| POST | `/api/doctor/reply` | `{text, crew, reply_to}`; `reply_to` is a daily report's id and marks it reviewed |
| GET | `/api/crew` | The simulated corps of 100: `{total, flagged, phases, crew}` |
| POST | `/api/scenario` | Demo only. `{name}`: `none`, `radiation`, `oxygen`, `fever`, `heart`, `behavioral`, `exercise` |
| POST | `/api/reset` | Demo only. Clears check-ins, messages and the scenario (accounts are kept) |

## Readings

| metric | unit | body area | shown as |
|---|---|---|---|
| `body_temp` | °C | general | vitals tile |
| `heart_rate` | bpm | heart | vitals tile |
| `systolic_bp` | mmHg | heart | vitals tile |
| `spo2` | % | lungs | vitals tile |
| `sleep_hours` | h | mind | vitals tile |
| `fluid_l` | L | general | vitals tile |
| `blood_sugar` | mg/dL | general | vitals tile |
| `dose_rate` | mSv/day | radiation | separate radiation statistic; an alert only in a solar storm |
| `exercise_pct` | % of plan | bone | progress bar, never amber or red ("quiet") |
| `mood` | 1 to 5 | mind | neutral number, never amber or red ("quiet") |

"Sensor" values are simulated. A value entered in the check-in replaces the
simulated one until the scenario changes.

Each reading in the state looks like:

```json
{"metric": "heart_rate", "label": "Heart rate", "area": "heart", "value": 69, "unit": "bpm",
 "source": "sensor", "quiet": false, "status": "watch", "report_status": "watch",
 "note": "Heart rate up 13% from your usual level this week", "protocol": null}
```

`status` is what the crew member sees: `ok`, `watch`, `act`, or `neutral` for
quiet readings. `report_status` is the real status sent to the flight surgeon.

## The state object

```json
{
  "user": {"username": "mkelly", "full_name": "M. Kelly"},
  "profile": {"name": "M. Kelly", "environment": "mars"},
  "environment": {"id": "mars", "label": "Mars base", "delay_label": "19 min each way", "gravity_g": 0.38},
  "mission_day": 167,
  "scenario": "none", "scenarios": {"none": "Normal day"},
  "vitals": ["seven readings, in tile order"],
  "areas": {"heart": {"label": "Heart", "status": "ok", "report_status": "ok"}},
  "radiation": {"value": 0.69, "status": "ok", "mission_total": 111.9, "career_limit": 600, "percent_of_limit": 18.6},
  "exercise": {"value": 90, "today": {"cardio": 40, "resistance": 50}, "today_total": 90, "today_percent": 75, "target_minutes": 120, "streak_days": 13},
  "mood": {"value": 4, "week": [4, 4, 4, 4, 4, 4, 4]},
  "alert": null,
  "nudges": [{"id": "mood", "text": "...", "action": "Request a private call with the flight surgeon", "requested": false}],
  "all_green": true,
  "ticks": [], "emergency": null, "nasa_event": null,
  "messages": ["Earth link, newest first"],
  "checkin": {"done": ["vitals", "mind"], "total": 6, "sent": false},
  "felt_better": false,
  "pain": [{"region": "Lower back", "severity": 6}],
  "ai": {"available": true, "model": "llama3.2:latest"}
}
```

`areas` has six entries: `radiation`, `lungs`, `heart`, `general`, `mind`, `bone`.

## Messages

```json
{"id": 3, "from": "ship", "kind": "daily_report", "crew": "mkelly",
 "title": "2026-11-14_mkelly_dailyreport", "body": "...", "all_green": false,
 "report_status": "Reviewed", "feedback": "Flight surgeon's reply text",
 "arrived": true, "eta_seconds": 0, "eta_real_minutes": 0, "reply_to": null, "cloud": "stored",
 "context": {"crew": "M. Kelly", "username": "mkelly", "mission_day": 167, "location": "Mars base",
             "signal_delay_seconds": 1140, "background_dose_rate_msv_per_day": 0.67, "gravity_g": 0.38}}
```

- `kind` is `daily_report`, `alert`, `emergency`, `update`, `auto_ack` or `feedback`; `from` is `ship` or `earth`.
- A daily report's `report_status` goes Sent, Delivered, Reviewed.
- `context` is locked in at the moment of sending.

## Signal delay

Each location has a one-way delay (`backend/store.py`). For the demo it is
sped up 60 times, so 19 minutes plays as 19 seconds.

## Body regions (for marking pain)

`Head`, `Neck`, `Chest`, `Abdomen`, `Upper back`, `Lower back`, `Left arm`,
`Right arm`, `Left leg`, `Right leg`.
