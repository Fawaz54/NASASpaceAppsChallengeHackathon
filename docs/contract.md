# Data contract

What the backend sends and accepts. The screens depend on these shapes, so
change them only together with the frontend code that uses them.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | Everything the crew screens need (shape below) |
| GET | `/api/profile` | `{profile, suggested, environments}`; `suggested` is the Apple Watch baseline if imported |
| POST | `/api/profile` | Save the profile |
| GET | `/api/indicators` | Plain-language text for each metric, from `data/indicators.json` |
| GET | `/api/history?metric=heart_rate` | `{metric, label, unit, baseline, band: [low, high], values: [30 daily values]}` |
| POST | `/api/checkin` | `{mood, sleep_hours, measurements: {systolic_bp, blood_sugar, body_temp}, pain: [{region, severity}], notes}`; sends the daily report |
| POST | `/api/steps` | `{protocol_id, done: [step numbers]}`; remembers ticked checklist steps |
| POST | `/api/ask` | `{question}` returns `{answer, based_on, used_ai}` |
| GET | `/api/triage` | The emergency questions: `{regions, onsets, signs}` |
| POST | `/api/emergency/start` | Alerts crew and Earth; returns the emergency |
| POST | `/api/emergency/describe` | `{description}`; pre-fills answers from the crew member's words |
| POST | `/api/emergency/answer` | `{regions, severity, onset, signs}`; chooses the checklist and sends the assessment |
| POST | `/api/emergency/resolve` | Closes the emergency |
| GET | `/api/doctor` | What has reached Earth: `{profile, environment, delay_label, messages, in_transit}` |
| POST | `/api/doctor/reply` | `{text}`; flight surgeon's feedback, delivered after the delay |
| POST | `/api/scenario` | `{name}`; demo only. One of `none`, `radiation`, `fever`, `heart`, `behavioral`, `exercise` |
| POST | `/api/reset` | Demo only. Clears check-ins, messages and the scenario |

## Metrics

| metric | unit | health area | how it arrives |
|---|---|---|---|
| `dose_rate` | mSv/day | radiation | sensor |
| `heart_rate` | bpm | heart | sensor |
| `systolic_bp` | mmHg | heart | sensor, or entered in the check-in |
| `body_temp` | °C | general | sensor, or entered |
| `blood_sugar` | mg/dL | general | sensor, or entered |
| `sleep_hours` | h | mind | sensor, or entered |
| `mood` | 1 to 5 | mind | entered |
| `exercise_pct` | % of plan | bone | sensor |

"Sensor" values are simulated. A value entered in the check-in replaces the
simulated one until the scenario changes.

## The state object

```json
{
  "profile": {"name": "...", "environment": "mars", "resting_hr": 58},
  "environment": {"id": "mars", "label": "Mars base", "delay_label": "19 min each way", "delay_demo_seconds": 19.0},
  "mission_day": 167,
  "scenario": "radiation",
  "scenarios": {"none": "Normal day", "radiation": "Solar particle event"},
  "readings": [{"time": "...", "metric": "dose_rate", "value": 6.4, "unit": "mSv/day", "source": "sensor"}],
  "areas": [{
    "id": "radiation", "label": "Radiation", "status": "act", "note": "",
    "metrics": [{"metric": "dose_rate", "label": "Radiation dose rate", "value": 6.4, "unit": "mSv/day",
                 "source": "sensor", "status": "act", "note": "", "protocol": "RAD-01"}]
  }],
  "alert": {"area": "radiation", "metric": "dose_rate", "protocol_id": "RAD-01", "title": "...", "why": "...", "steps": ["..."]},
  "all_green": false,
  "nasa_event": {"id": "...", "event_time": "..."},
  "ticks": [0, 1],
  "emergency": null,
  "messages": [{"id": 3, "from": "ship", "kind": "alert", "title": "...", "body": "...",
                "arrived": false, "eta_seconds": 12, "eta_real_minutes": 12.0}],
  "reminders": [{"text": "Daily check-in due", "href": "checkin.html"}],
  "pain": [{"region": "Lower back", "severity": 6}],
  "ai": {"available": false, "model": null}
}
```

- `areas` always has five entries in order of urgency: `radiation`, `heart`, `general`, `mind`, `bone`.
- `status` is `ok`, `watch` or `act`. `alert` is `null` unless an area is `act`.
- `profile` is `null` until the profile is saved; the screens then redirect to `profile.html`.
- Message `kind` is `daily_report`, `alert`, `emergency`, `update`, `auto_ack` or `feedback`; `from` is `ship` or `earth`.

## Signal delay

Each location has a one-way delay (`backend/store.py`). For the demo it is
sped up 60 times, so 19 minutes plays as 19 seconds.

## Body regions

`Head`, `Neck`, `Chest`, `Abdomen`, `Upper back`, `Lower back`, `Left arm`,
`Right arm`, `Left leg`, `Right leg`.
