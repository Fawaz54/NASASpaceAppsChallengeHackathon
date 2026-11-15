"""The wider astronaut corps, for mission control's overview and for
"compared with the crew" figures.

data/crew_dataset.json is a SIMULATED crew of 100 made by the team from
published ranges. It is not real astronaut data and must be labelled as
simulated wherever it is shown.
"""
from statistics import mean

import store

# The same review rules the dataset's own "Health Flag" column uses.
RULES = [
    ("heart_rate", lambda v: v > 100 or v < 50, "heart rate {} bpm"),
    ("systolic_bp", lambda v: v > 140, "blood pressure {} mmHg"),
    ("spo2", lambda v: v < 95, "blood oxygen {}%"),
    ("body_temp", lambda v: v > 38, "temperature {} °C"),
    ("sleep_hours", lambda v: v < 5, "sleep {} h"),
]
COMPARABLE = ["heart_rate", "systolic_bp", "spo2", "body_temp", "blood_sugar", "sleep_hours", "fluid_l", "dose_rate"]


def _crew():
    return (store.load_json(store.DATA / "crew_dataset.json") or {}).get("crew", [])


def averages():
    """Crew average for each reading the app also tracks."""
    crew = _crew()
    return {metric: round(mean(person[metric] for person in crew), 1) for metric in COMPARABLE} if crew else {}


def overview():
    crew = _crew()
    flagged, phases = [], {}
    for person in crew:
        reasons = [text.format(person[metric]) for metric, test, text in RULES if test(person[metric])]
        phase = phases.setdefault(person["phase"], {"phase": person["phase"], "count": 0, "flagged": 0, "dose": []})
        phase["count"] += 1
        phase["dose"].append(person["dose_rate"])
        if reasons:
            phase["flagged"] += 1
            flagged.append({**person, "reasons": reasons})
    return {
        "total": len(crew),
        "flagged": sorted(flagged, key=lambda p: -len(p["reasons"])),
        "phases": [{"phase": p["phase"], "count": p["count"], "flagged": p["flagged"],
                    "average_dose_rate": round(mean(p["dose"]), 2)} for p in phases.values()],
        "crew": crew,
    }
