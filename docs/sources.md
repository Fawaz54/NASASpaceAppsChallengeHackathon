# Sources

Every limit, checklist, explanation and dataset the app uses should be
listed here. Judges score scientific validity, so this file is what turns
the drafts in `data/` into something defensible.

## Current status

| File | Status |
|---|---|
| `data/thresholds.json` | Draft. Blood pressure, temperature and blood sugar limits are general clinic values, not spaceflight limits. The rest are placeholders chosen so the demo runs. |
| `data/protocols.json` | Draft checklists written by the team. Not medical advice. |
| `data/indicators.json` | Draft explanations. Each statement needs checking against a NASA source. |
| `backend/store.py` (locations) | Illustrative signal delays and background dose rates per location. |
| `data/donki_event.json` | Real. Fetched from NASA DONKI. |

## Where to look

- NASA Human Research Program (the five hazards of human spaceflight)
- NASA-STD-3001, NASA's spaceflight human health standard
- NASA Technical Reports Server: https://ntrs.nasa.gov
- NASA Open Science Data Repository: https://osdr.nasa.gov
- DONKI space weather events: https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP
- Curiosity RAD radiation data: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/

## Datasets used

| Dataset | Used for | Exact record |
|---|---|---|
| NASA DONKI, solar energetic particle events | The radiation scenario names a real event. Its timing is real; dose values are simulated. | See `data/donki_event.json` |

## Limits to source

| Metric | Watch | Act | Source (document, page, link) |
|---|---|---|---|
| dose_rate | | | |
| heart_rate | | | |
| systolic_bp | | | |
| body_temp | | | |
| blood_sugar | | | |
| sleep_hours | | | |
| mood | | | |
| exercise_pct | | | |

## Checklists to source

| Protocol | Based on | Link |
|---|---|---|
| RAD-01 | | |
| HRT-01, HRT-02 | | |
| GEN-01 to GEN-04 | | |
| MND-01 | | |
| BON-01 | | |
| EMG-* (emergency) | | |

## Location values to source

| Location | One-way delay | Background dose rate | Source |
|---|---|---|---|
| Space station | | | |
| Lunar base | | | |
| In transit to Mars | | | |
| Mars base | | | |
