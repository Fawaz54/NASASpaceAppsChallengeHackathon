"""Owner: Backend B. Turns readings into a status per health area and picks the checklist.

Limits come from data/thresholds.json and checklists from data/protocols.json,
so Frontend 3 can edit them without touching this file.
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "data"

AREAS = [
    ("radiation", "Radiation", "dose_rate"),
    ("heart", "Heart", "heart_rate"),
    ("bone", "Bone and muscle", "exercise_pct"),
    ("mind", "Mind and sleep", "sleep_hours"),
]
RANK = {"ok": 0, "watch": 1, "act": 2}


def _load(name):
    return json.loads((DATA / name).read_text())


def _status(value, limit):
    beyond = (lambda v, edge: v >= edge) if limit["direction"] == "above" else (lambda v, edge: v <= edge)
    if beyond(value, limit["act"]):
        return "act"
    if beyond(value, limit["watch"]):
        return "watch"
    return "ok"


def evaluate(readings):
    """Returns (areas, alert) as described in docs/contract.md."""
    thresholds = _load("thresholds.json")
    latest = {r["metric"]: r for r in readings}

    worst = {area_id: "ok" for area_id, _, _ in AREAS}
    for metric, limit in thresholds.items():
        if metric in latest:
            status = _status(latest[metric]["value"], limit)
            if RANK[status] > RANK[worst[limit["area"]]]:
                worst[limit["area"]] = status

    areas = [
        {
            "id": area_id,
            "label": label,
            "status": worst[area_id],
            "value": latest[headline]["value"],
            "unit": latest[headline]["unit"],
        }
        for area_id, label, headline in AREAS
    ]

    alert = None
    acting = [a for a in areas if a["status"] == "act"]
    if acting:
        protocol = _load("protocols.json")[acting[0]["id"]]
        alert = {
            "area": acting[0]["id"],
            "protocol_id": protocol["id"],
            "title": protocol["title"],
            "steps": protocol["steps"],
        }
    return areas, alert


# TODO (Backend B):
# - drift detection: compare recent days with the personal baseline
# - use check-in answers and body map pain when choosing the protocol
# - when two areas need action, return the more urgent one and list the other
