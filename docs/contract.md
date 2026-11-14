# Data contract

This is the agreement between backend and frontend. Change it only after
telling the whole team, and update `frontend/mock/state.json` in the same commit.

## Endpoints

| Method | Path | Owner | Purpose |
|---|---|---|---|
| GET | `/api/state` | Backend B | Everything the home screen needs (shape below) |
| POST | `/api/scenario` | Backend A | Body `{"name": "none" \| "radiation" \| "heart" \| "behavioral"}` switches the demo scenario |
| POST | `/api/checkin` | Backend B | TODO: body `{"mood": 1-5, "sleep_quality": 1-5, "pain": [{"region": "Lower back", "severity": 1-10}]}` |
| POST | `/api/ask` | Backend B | TODO: body `{"question": "..."}`, returns `{"answer": "...", "protocol_id": "RAD-01"}` |

## A reading

```json
{"time": "2026-11-14T18:00:00Z", "metric": "heart_rate", "value": 62, "unit": "bpm"}
```

Metrics in use:

| metric | unit | health area |
|---|---|---|
| `dose_rate` | mSv/day | radiation |
| `heart_rate` | bpm | heart |
| `systolic_bp` | mmHg | heart |
| `exercise_pct` | % of prescribed plan | bone |
| `sleep_hours` | h | mind |
| `mood` | 1-5 | mind |

## The state object (`GET /api/state`)

```json
{
  "crew": {"id": "crew-1", "name": "A. Kim", "mission_day": 142},
  "scenario": "radiation",
  "readings": [ { "time": "...", "metric": "dose_rate", "value": 4.2, "unit": "mSv/day" } ],
  "areas": [
    {"id": "radiation", "label": "Radiation", "status": "act", "value": 4.2, "unit": "mSv/day"}
  ],
  "alert": {
    "area": "radiation",
    "protocol_id": "RAD-01",
    "title": "Solar particle event in progress",
    "steps": ["Stop current task and secure equipment", "..."]
  },
  "earth_link": {"delay_minutes": 19, "summary_sent": true, "reply_eta_minutes": 31}
}
```

- `areas` always has four entries, in this order: `radiation`, `heart`, `bone`, `mind`.
- `status` is one of `ok`, `watch`, `act`.
- `alert` is `null` when every area is `ok` or `watch`.

## Body map regions

`Head`, `Neck`, `Chest`, `Abdomen`, `Upper back`, `Lower back`, `Left arm`,
`Right arm`, `Left leg`, `Right leg`.
