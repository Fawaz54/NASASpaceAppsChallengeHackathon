"""Owner: Backend A. Generates fake crew readings in the docs/contract.md format.

All numbers here are illustrative, not medical reference values.
"""
import random
from datetime import datetime, timezone

# metric: (normal value, unit, random wobble)
BASELINE = {
    "dose_rate": (0.7, "mSv/day", 0.05),
    "heart_rate": (62, "bpm", 2),
    "systolic_bp": (118, "mmHg", 3),
    "exercise_pct": (92, "%", 0),
    "sleep_hours": (7.2, "h", 0),
    "mood": (4, "1-5", 0),
}

# scenario name: metrics it overrides
SCENARIOS = {
    "none": {},
    "radiation": {"dose_rate": 4.2},
    "heart": {"heart_rate": 78, "systolic_bp": 138},
    "behavioral": {"sleep_hours": 5.4, "mood": 2},
}

_scenario = "none"


def get_scenario():
    return _scenario


def set_scenario(name):
    global _scenario
    if name not in SCENARIOS:
        return False
    _scenario = name
    return True


def current_readings():
    """One reading per metric, right now."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    overrides = SCENARIOS[_scenario]
    readings = []
    for metric, (normal, unit, wobble) in BASELINE.items():
        value = overrides.get(metric, normal) + random.uniform(-wobble, wobble)
        readings.append({"time": now, "metric": metric, "value": round(value, 1), "unit": unit})
    return readings


# TODO (Backend A):
# - ramp scenario values over time instead of jumping
# - keep a 30-day history per metric for the trend screen
# - replay a real DONKI event for the radiation scenario (see nasa_data/donki.py)
