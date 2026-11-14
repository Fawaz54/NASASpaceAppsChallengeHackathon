"""Real solar particle events from NASA's DONKI space weather database.

Run once while online to save an event for the demo:

    python3 backend/nasa_data/donki.py

It writes data/donki_event.json, so the radiation scenario can name a real
event and still work with the wifi off. DONKI gives the time of an event,
not the dose a crew would receive: the dose values stay simulated.
"""
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

URL = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate={start}&endDate={end}"
SAVED = Path(__file__).resolve().parent.parent.parent / "data" / "donki_event.json"


def fetch_sep_events(start, end):
    """Solar energetic particle events between two dates (at most 60 days apart)."""
    with urllib.request.urlopen(URL.format(start=start, end=end), timeout=60) as response:
        return json.loads(response.read() or b"[]")


def latest_event(windows=6):
    """Search back through 60-day windows until an event is found."""
    end = date.today()
    for _ in range(windows):
        start = end - timedelta(days=59)
        events = fetch_sep_events(start.isoformat(), end.isoformat())
        if events:
            return max(events, key=lambda e: e.get("eventTime", ""))
        end = start - timedelta(days=1)
    return None


def saved_event():
    try:
        return json.loads(SAVED.read_text())
    except (OSError, ValueError):
        return None


if __name__ == "__main__":
    event = latest_event()
    if not event:
        sys.exit("No solar particle events found in the last year.")
    record = {
        "source": "NASA DONKI (CCMC, Goddard Space Flight Center)",
        "api": "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP",
        "id": event.get("sepID"),
        "event_time": event.get("eventTime"),
        "instruments": [i.get("displayName") for i in event.get("instruments") or []],
        "link": event.get("link"),
    }
    SAVED.write_text(json.dumps(record, indent=2) + "\n")
    print(f"Saved {record['id']} ({record['event_time']}) to {SAVED}")
