"""Generates the crew member's readings.

Real sensors would replace this file. Values are simulated around the
personal baseline from the profile (and the Apple Watch import, if present).
Scenario numbers are illustrative, not medical reference values.
"""
import random
import time
from datetime import datetime, timezone

import store

# metric: (fallback baseline, unit, random wobble, decimals)
METRICS = {
    "dose_rate": (0.7, "mSv/day", 0.04, 2),
    "heart_rate": (62, "bpm", 1.5, 0),
    "systolic_bp": (118, "mmHg", 2, 0),
    "spo2": (97.6, "%", 0.4, 0),
    "body_temp": (36.8, "°C", 0.1, 1),
    "fluid_l": (2.4, "L", 0, 1),
    "blood_sugar": (92, "mg/dL", 3, 0),
    "exercise_pct": (92, "%", 0, 0),
    "sleep_hours": (7.2, "h", 0, 1),
    "mood": (4, "of 5", 0, 0),
}

# Each scenario: how fast it develops, and the target per metric as
# ("abs", value) or ("mul", multiple of the personal baseline).
SCENARIOS = {
    "none": {"label": "Normal day", "speed": "fast", "targets": {}},
    "radiation": {"label": "Solar particle event", "speed": "fast", "targets": {"dose_rate": ("abs", 8.0)}},
    "oxygen": {"label": "Low blood oxygen", "speed": "fast", "targets": {"spo2": ("abs", 90.5), "heart_rate": ("mul", 1.1)}},
    "fever": {"label": "Fever", "speed": "fast", "targets": {"body_temp": ("abs", 38.6), "heart_rate": ("mul", 1.14)}},
    "heart": {"label": "Heart drift", "speed": "slow",
              "targets": {"heart_rate": ("mul", 1.16), "systolic_bp": ("mul", 1.11)}},
    "behavioral": {"label": "Sleep and mood decline", "speed": "slow",
                   "targets": {"sleep_hours": ("abs", 5.2), "mood": ("abs", 2)}},
    "exercise": {"label": "Missed exercise", "speed": "slow", "targets": {"exercise_pct": ("abs", 55)}},
}
RAMP_SECONDS = 40   # how long a fast scenario takes to reach its peak
DRIFT_DAYS = 7      # how many days a slow scenario has been building

_scenario = "none"
_started = 0.0


def exercise_streak():
    """Days in a row with exercise done (simulated)."""
    return 0 if _scenario == "exercise" else 12


def get_scenario():
    return _scenario


def set_scenario(name):
    global _scenario, _started
    if name not in SCENARIOS:
        return False
    _scenario, _started = name, time.time()
    store.manual.clear()
    store.manual_dates.clear()
    return True


def baseline(metric):
    """What is normal for this crew member."""
    profile = store.profile or {}
    if metric == "dose_rate":
        return store.environment()["dose_rate"]
    if metric == "heart_rate":
        return profile.get("resting_hr") or METRICS[metric][0]
    if metric == "sleep_hours":
        return profile.get("sleep_hours") or METRICS[metric][0]
    if metric == "systolic_bp":
        return profile.get("systolic_bp") or METRICS[metric][0]
    return METRICS[metric][0]


def _target(metric):
    spec = SCENARIOS[_scenario]["targets"].get(metric)
    if spec is None:
        return None
    kind, amount = spec
    return amount if kind == "abs" else baseline(metric) * amount


def simulated(metric):
    """What the sensors alone would say, ignoring values the crew member entered."""
    target = _target(metric)
    return baseline(metric) if target is None else target


def _steady_value(metric):
    """Today's value without the random wobble."""
    if metric in store.manual:
        return store.manual[metric]
    base, target = baseline(metric), _target(metric)
    if target is None:
        return base
    if SCENARIOS[_scenario]["speed"] == "slow":
        return target
    progress = min(1.0, (time.time() - _started) / RAMP_SECONDS)
    return base + (target - base) * progress


def current_readings():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    readings = []
    for metric, (_, unit, wobble, decimals) in METRICS.items():
        value = _steady_value(metric)
        if metric not in store.manual:
            value += random.uniform(-wobble, wobble)
        readings.append({
            "time": now, "metric": metric, "unit": unit,
            "value": round(value, decimals) if decimals else int(round(value)),
            "source": "entered" if metric in store.manual else "sensor",
        })
    return readings


def history(metric, days=30):
    """One value per day, oldest first, ending with today."""
    _, _, wobble, decimals = METRICS[metric]
    base, target = baseline(metric), _target(metric)
    rng = random.Random(f"history-{metric}")
    spread = max(wobble, abs(base) * 0.015)
    values = [base + rng.uniform(-spread, spread) for _ in range(days)]

    # Real daily values from the Apple Watch import, where we have them.
    watch = store.watch_baseline() or {}
    watch_key = {"heart_rate": "resting_hr", "sleep_hours": "sleep_hours"}.get(metric)
    uses_watch = watch_key and (store.profile or {}).get(watch_key) == watch.get(watch_key)
    daily = watch.get("daily", {}).get(metric) if uses_watch else None
    if daily:
        tail = daily[-days:]
        shift = base - sum(tail) / len(tail)  # centre the real pattern on this person's baseline
        values[-len(tail):] = [v + shift for v in tail]

    if target is not None and SCENARIOS[_scenario]["speed"] == "slow":
        for step in range(DRIFT_DAYS):
            index = days - DRIFT_DAYS + step
            values[index] = base + (target - base) * (step + 1) / DRIFT_DAYS + rng.uniform(-spread, spread) / 2
    values[-1] = _steady_value(metric)
    return [round(v, max(decimals, 1)) for v in values]
