"""Owner: Backend A. Real solar particle events from NASA's DONKI API.

No API key needed. The date window must be 60 days or less.
Run directly to try it:  python3 backend/nasa_data/donki.py
"""
import json
import urllib.request

URL = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate={start}&endDate={end}"


def fetch_sep_events(start, end):
    """Dates as YYYY-MM-DD. Returns the list of solar energetic particle events."""
    with urllib.request.urlopen(URL.format(start=start, end=end), timeout=60) as response:
        return json.loads(response.read() or b"[]")


# TODO (Backend A):
# - pick one real event and save it to data/ so the demo works offline
# - turn its timeline into dose_rate readings for the radiation scenario

if __name__ == "__main__":
    for event in fetch_sep_events("2026-08-06", "2026-10-04"):
        print(event.get("eventTime"))
