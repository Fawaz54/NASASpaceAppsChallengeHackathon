"""Everything the app remembers while it runs.

Only the profile is saved to disk (in private/, which Git ignores), so a
restart keeps the crew member's details but clears check-ins and messages.
"""
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PRIVATE = ROOT / "private"
PROFILE_FILE = PRIVATE / "profile.json"
WATCH_FILE = PRIVATE / "watch_baseline.json"

# Where the crew is: one-way signal delay and background radiation dose rate.
# Sources are in docs/sources.md (Curiosity RAD for Mars and transit, the
# Chang'e 4 lander for the Moon and station, NTRS 20220013418 for Mars delays).
ENVIRONMENTS = {
    "station": {"label": "Space station, low Earth orbit", "delay_seconds": 0, "dose_rate": 0.7},
    "lunar": {"label": "Lunar base", "delay_seconds": 1.3, "dose_rate": 1.4},
    "transit": {"label": "Spacecraft in transit to Mars", "delay_seconds": 600, "dose_rate": 1.8},
    "mars": {"label": "Mars base", "delay_seconds": 1140, "dose_rate": 0.67},
}

PROFILE_FIELDS = {
    "name": "", "role": "", "age": None, "sex": "", "height_cm": None, "weight_kg": None,
    "resting_hr": None, "systolic_bp": None, "sleep_hours": None,
    "conditions": "", "medications": "", "allergies": "",
    "environment": "mars", "mission_name": "", "mission_start": "",
}

profile = None          # dict once the crew member has filled in the profile
checkin = None          # latest daily check-in
checkin_date = None     # ISO date of that check-in
manual = {}             # metric -> value typed in by the crew member
manual_dates = {}       # metric -> ISO date it was entered
messages = []           # Earth link, both directions
emergency = None        # active emergency, or None
ticks = {}              # protocol id -> list of ticked step numbers
last_alert = None       # protocol id of the alert already reported to Earth
completed_reported = set()


def load_json(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def load_profile():
    global profile
    profile = load_json(PROFILE_FILE)


def save_profile(values):
    global profile
    clean = dict(PROFILE_FIELDS)
    for key in PROFILE_FIELDS:
        if key in values and values[key] not in ("", None):
            clean[key] = values[key]
    if clean["environment"] not in ENVIRONMENTS:
        clean["environment"] = "mars"
    profile = clean
    PRIVATE.mkdir(exist_ok=True)
    PROFILE_FILE.write_text(json.dumps(clean, indent=2))
    return clean


def watch_baseline():
    """Averages from an imported Apple Watch export, or None."""
    return load_json(WATCH_FILE)


def environment():
    key = (profile or {}).get("environment", "mars")
    return {"id": key, **ENVIRONMENTS[key]}


def mission_day():
    start = (profile or {}).get("mission_start")
    try:
        return max(1, (date.today() - date.fromisoformat(start)).days + 1)
    except (TypeError, ValueError):
        return 1


def today():
    return date.today().isoformat()
