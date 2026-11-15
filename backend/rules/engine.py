"""Turns readings into a status per reading and per body area, and picks the checklist.

Limits come from data/thresholds.json, checklists from data/protocols.json
and the plain-language text from data/indicators.json, so they can be
edited without touching this file. The AI never makes these decisions.

"Quiet" readings (mood and exercise) are never shown to the crew member in
amber or red and never raise an alert, because colouring a self-rating adds
pressure and invites people to under-report. Their real status still goes
to the flight surgeon as report_status.
"""
from statistics import mean

import store
from simulator import simulator

AREAS = [  # in order of urgency
    ("radiation", "Radiation"),
    ("lungs", "Breathing"),
    ("heart", "Heart"),
    ("general", "Body"),
    ("mind", "Sleep and mind"),
    ("bone", "Bone and muscle"),
]
RANK = {"neutral": 0, "ok": 0, "watch": 1, "act": 2}
DRIFT_FRACTION = 0.08  # a move of 8% from the personal baseline counts as drift


def _data(name):
    return {k: v for k, v in store.load_json(store.DATA / name, {}).items() if not k.startswith("_")}


def indicators():
    return _data("indicators.json")


def protocols():
    return _data("protocols.json")


def limits(metric, threshold):
    """Resolve a threshold entry to absolute numbers for this crew member."""
    base = simulator.baseline(metric)
    resolved = {}
    for side, sign in (("low", -1), ("high", 1)):
        spec = threshold.get(side)
        if not spec:
            continue
        if "watch_pct" in spec:
            resolved[side] = {
                "watch": base * (1 + sign * spec["watch_pct"] / 100),
                "act": base * (1 + sign * spec["act_pct"] / 100),
                "protocol": spec.get("protocol"),
            }
        else:
            resolved[side] = spec
    return resolved


def band(metric):
    """The normal range drawn on charts: between the two 'watch' lines."""
    threshold = _data("thresholds.json").get(metric, {})
    resolved = limits(metric, threshold)
    base = simulator.baseline(metric)
    low = resolved["low"]["watch"] if "low" in resolved else base * 0.9
    high = resolved["high"]["watch"] if "high" in resolved else base * 1.1
    return [round(low, 2), round(high, 2)]


def _classify(value, resolved):
    for level in ("act", "watch"):
        if "high" in resolved and value >= resolved["high"][level]:
            return level, "high"
        if "low" in resolved and value <= resolved["low"][level]:
            return level, "low"
    return "ok", None


def _drift(metric, resolved):
    """Has the last few days moved away from this person's usual level?"""
    values = simulator.history(metric)
    usual, recent = mean(values[:20]), mean(values[-3:])
    if not usual:
        return None
    change = (recent - usual) / usual
    if "high" in resolved and change >= DRIFT_FRACTION:
        return "high", change
    if "low" in resolved and change <= -DRIFT_FRACTION:
        return "low", change
    return None


def evaluate(readings):
    """Returns (metrics, areas, alert).

    metrics: one entry per reading, with the status shown to the crew
             ("neutral" for quiet readings) and report_status for the doctor.
    areas:   {area id: {"label", "status", "report_status"}} for the body figure.
    alert:   the most urgent checklist, or None.
    """
    thresholds = _data("thresholds.json")
    info = indicators()
    metrics = []

    for reading in readings:
        metric = reading["metric"]
        threshold = thresholds.get(metric)
        if not threshold:
            continue
        resolved = limits(metric, threshold)
        status, side = _classify(reading["value"], resolved)
        label = info.get(metric, {}).get("label", metric)
        note = ""
        if threshold.get("drift"):
            drift = _drift(metric, resolved)
            if drift:
                drift_side, change = drift
                note = f"{label} {'up' if change > 0 else 'down'} {abs(change) * 100:.0f}% from your usual level this week"
                if status == "ok":
                    status, side = "watch", drift_side
        quiet = bool(threshold.get("quiet"))
        metrics.append({
            "metric": metric, "label": label, "area": threshold["area"],
            "value": reading["value"], "unit": reading["unit"], "source": reading["source"],
            "quiet": quiet, "status": "neutral" if quiet else status, "report_status": status, "note": note,
            "protocol": resolved.get(side, {}).get("protocol") if side and not quiet else None,
        })

    areas, alert = {}, None
    for area_id, label in AREAS:
        mine = [m for m in metrics if m["area"] == area_id]
        shown = [m for m in mine if not m["quiet"]]
        worst = max(shown, key=lambda m: RANK[m["status"]], default=None)
        areas[area_id] = {
            "label": label,
            "status": worst["status"] if worst else "neutral",
            "report_status": max((m["report_status"] for m in mine), key=RANK.get, default="ok"),
        }
        if alert is None and worst and worst["status"] == "act" and worst["protocol"]:
            protocol = protocols().get(worst["protocol"])
            if protocol:
                alert = {"area": area_id, "metric": worst["metric"], "protocol_id": worst["protocol"], **protocol}
    return metrics, areas, alert
