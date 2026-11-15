"""Everything the app remembers while it runs.

Accounts (and each astronaut's profile) are saved in private/accounts.json,
which Git ignores. Check-ins, messages and emergencies live in memory and
are cleared when the app restarts.

Several people can be signed in at once. Each request names its user, and
activate() points the module-level variables below (profile, checkin, ...)
at that user's own state for the length of the request.
"""
import json
import re
import threading
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PRIVATE = ROOT / "private"
ACCOUNTS_FILE = PRIVATE / "accounts.json"
OLD_PROFILE_FILE = PRIVATE / "profile.json"
WATCH_FILE = PRIVATE / "watch_baseline.json"

# Where the crew is: one-way signal delay, background radiation dose rate and
# gravity. Sources are in docs/sources.md (Curiosity RAD for Mars and transit,
# the Chang'e 4 lander for the Moon and station, NTRS 20220013418 for delays).
ENVIRONMENTS = {
    "station": {"label": "Space station, low Earth orbit", "delay_seconds": 0, "dose_rate": 0.7, "gravity_g": 0},
    "lunar": {"label": "Lunar base", "delay_seconds": 1.3, "dose_rate": 1.4, "gravity_g": 0.17},
    "transit": {"label": "Spacecraft in transit to Mars", "delay_seconds": 600, "dose_rate": 1.8, "gravity_g": 0},
    "mars": {"label": "Mars base", "delay_seconds": 1140, "dose_rate": 0.67, "gravity_g": 0.38},
}

PROFILE_FIELDS = {
    "name": "", "role": "", "age": None, "sex": "", "height_cm": None, "weight_kg": None,
    "resting_hr": None, "systolic_bp": None, "sleep_hours": None,
    "conditions": "", "medications": "", "allergies": "",
    "environment": "mars", "mission_name": "", "mission_start": "",
    "height_unit": "cm", "weight_unit": "kg",   # how the profile form shows them; stored values are metric
}
# Sensible ranges; a number outside its range is ignored.
PROFILE_RANGES = {"age": (18, 80), "height_cm": (100, 230), "weight_kg": (30, 200),
                  "resting_hr": (30, 120), "systolic_bp": (70, 200), "sleep_hours": (3, 12)}

lock = threading.RLock()   # one request at a time touches the state below
accounts = {}              # username -> {"role", "full_name", "profile"}
messages = []              # Earth link, all crew members, both directions
_states = {}               # username -> that person's working state
current = None             # username of the request being handled

# The active user's state (see activate).
profile = None
checkin = None
checkin_date = None
assessments = {}
assessments_date = None
manual = {}
manual_dates = {}
emergency = None
ticks = {}
last_alert = None
completed_reported = set()


def _blank():
    return {"checkin": None, "checkin_date": None, "assessments": {}, "assessments_date": None,
            "manual": {}, "manual_dates": {}, "emergency": None, "ticks": {}, "last_alert": None,
            "completed_reported": set()}


def activate(username):
    """Point the module-level state at this user. Call with the lock held."""
    global current, profile
    account = accounts.get(username)
    current = username if account else None
    profile = account["profile"] if account and account["role"] == "astronaut" else None
    state = _states.setdefault(username, _blank()) if account else _blank()
    globals().update(state)


def deactivate():
    """Save the module-level state back to the user it belongs to."""
    global current
    if current in _states:
        for key in _blank():
            _states[current][key] = globals()[key]
    current = None


def reset_states():
    _states.clear()
    messages.clear()
    globals().update(_blank())


def load_json(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


def clean_profile(values, existing=None):
    clean = dict(existing or PROFILE_FIELDS)
    for key in PROFILE_FIELDS:
        value = values.get(key)
        if value in ("", None):
            continue
        if key in PROFILE_RANGES:
            low, high = PROFILE_RANGES[key]
            if not isinstance(value, (int, float)) or not low <= value <= high:
                continue
        clean[key] = value
    if clean["environment"] not in ENVIRONMENTS:
        clean["environment"] = "mars"
    return clean


def _save_accounts():
    PRIVATE.mkdir(exist_ok=True)
    ACCOUNTS_FILE.write_text(json.dumps(accounts, indent=2))


def load_accounts():
    accounts.clear()
    accounts.update(load_json(ACCOUNTS_FILE, {}))
    old = load_json(OLD_PROFILE_FILE)   # profile saved by the earlier single-user version
    if not accounts and old and old.get("name"):
        accounts[slug(old["name"])] = {"role": "astronaut", "full_name": old["name"],
                                       "profile": clean_profile(old)}
        _save_accounts()


def create_account(role, full_name, username, values):
    """Returns (username, error)."""
    username, full_name = slug(username), (full_name or "").strip()
    if role not in ("astronaut", "doctor"):
        return None, "Choose astronaut or doctor."
    if not full_name:
        return None, "Enter your full name."
    if not 3 <= len(username) <= 20:
        return None, "Choose a username of 3 to 20 letters or numbers."
    if username in accounts:
        return None, "That username is taken. Choose another."
    account = {"role": role, "full_name": full_name, "profile": None}
    if role == "astronaut":
        account["profile"] = clean_profile({**values, "name": full_name})
    accounts[username] = account
    _save_accounts()
    return username, None


def save_profile(values):
    """Update the active astronaut's profile."""
    global profile
    account = accounts[current]
    account["profile"] = profile = clean_profile(values, account["profile"])
    account["full_name"] = profile["name"] or account["full_name"]
    _save_accounts()
    return profile


def profile_of(username=None):
    if username is None:
        return profile
    account = accounts.get(username)
    return account["profile"] if account else None


def watch_baseline():
    """Averages from an imported Apple Watch export, or None."""
    return load_json(WATCH_FILE)


def environment(username=None):
    key = (profile_of(username) or {}).get("environment", "mars")
    return {"id": key, **ENVIRONMENTS[key]}


def mission_day(username=None):
    start = (profile_of(username) or {}).get("mission_start")
    try:
        return max(1, (date.today() - date.fromisoformat(start)).days + 1)
    except (TypeError, ValueError):
        return 1


def today():
    return date.today().isoformat()
