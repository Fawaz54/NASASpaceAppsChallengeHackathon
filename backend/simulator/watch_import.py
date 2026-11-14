"""Turns an Apple Health export into a personal baseline for the app.

1. On the iPhone: Health app > profile picture > Export All Health Data.
2. Put the export.zip in this project's private/ folder (Git ignores it).
3. Run:   python3 backend/simulator/watch_import.py private/export.zip

It writes private/watch_baseline.json with averages only (resting heart
rate, sleep, exercise, height, weight, age). The raw export is never copied
and nothing here is committed to Git.
"""
import json
import sys
import zipfile
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from statistics import mean
from xml.etree import ElementTree

OUTPUT = Path(__file__).resolve().parent.parent.parent / "private" / "watch_baseline.json"
DAYS = 30
RESTING_HR = "HKQuantityTypeIdentifierRestingHeartRate"
SLEEP = "HKCategoryTypeIdentifierSleepAnalysis"
EXERCISE = "HKQuantityTypeIdentifierAppleExerciseTime"
WEIGHT = "HKQuantityTypeIdentifierBodyMass"
HEIGHT = "HKQuantityTypeIdentifierHeight"
TO_KG = {"kg": 1, "lb": 0.45359237, "g": 0.001}
TO_CM = {"cm": 1, "m": 100, "in": 2.54, "ft": 30.48}


def open_export(path):
    """Accepts export.zip or an already extracted export.xml."""
    path = Path(path)
    if path.suffix.lower() != ".zip":
        return open(path, "rb")
    archive = zipfile.ZipFile(path)
    names = [n for n in archive.namelist() if n.lower().endswith(".xml") and "cda" not in n.lower()]
    if not names:
        sys.exit("No export.xml found inside the zip.")
    return archive.open(max(names, key=lambda n: archive.getinfo(n).file_size))


def when(text):
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S %z")


def read(path):
    resting = defaultdict(list)                      # day -> values
    sleep = defaultdict(lambda: defaultdict(float))  # day -> source -> hours
    exercise = defaultdict(lambda: defaultdict(float))
    latest = {}                                      # type -> (date text, value, unit)
    me = {}

    with open_export(path) as stream:
        for _, node in ElementTree.iterparse(stream, events=("end",)):
            if node.tag == "Me":
                me = dict(node.attrib)
            elif node.tag == "Record":
                kind, start, end = node.get("type"), node.get("startDate"), node.get("endDate")
                try:
                    if kind == RESTING_HR:
                        resting[end[:10]].append(float(node.get("value")))
                    elif kind == SLEEP and "Asleep" in (node.get("value") or ""):
                        hours = (when(end) - when(start)).total_seconds() / 3600
                        sleep[end[:10]][node.get("sourceName")] += hours
                    elif kind == EXERCISE:
                        exercise[end[:10]][node.get("sourceName")] += float(node.get("value"))
                    elif kind in (WEIGHT, HEIGHT) and end > latest.get(kind, ("",))[0]:
                        latest[kind] = (end, float(node.get("value")), node.get("unit"))
                except (TypeError, ValueError):
                    pass  # skip a malformed record
            if node.tag in ("Record", "Workout", "ActivitySummary", "Correlation", "ClinicalRecord"):
                node.clear()
    return resting, sleep, exercise, latest, me


def last_days(per_day, combine):
    days = sorted(per_day)[-DAYS:]
    return [round(combine(per_day[day]), 1) for day in days]


def build(path):
    resting, sleep, exercise, latest, me = read(path)
    heart = last_days(resting, mean)
    # Several devices can record the same night; use the one that saw the most.
    nights = [hours for hours in last_days(sleep, lambda sources: max(sources.values())) if 2 <= hours <= 14]
    active = last_days(exercise, lambda sources: max(sources.values()))

    baseline = {
        "resting_hr": round(mean(heart)) if heart else None,
        "sleep_hours": round(mean(nights), 1) if nights else None,
        "exercise_minutes": round(mean(active)) if active else None,
        "daily": {"heart_rate": heart, "sleep_hours": nights},
        "days_of_heart_data": len(heart),
        "days_of_sleep_data": len(nights),
    }
    if WEIGHT in latest and latest[WEIGHT][2] in TO_KG:
        baseline["weight_kg"] = round(latest[WEIGHT][1] * TO_KG[latest[WEIGHT][2]], 1)
    if HEIGHT in latest and latest[HEIGHT][2] in TO_CM:
        baseline["height_cm"] = round(latest[HEIGHT][1] * TO_CM[latest[HEIGHT][2]])
    try:
        born = date.fromisoformat(me.get("HKCharacteristicTypeIdentifierDateOfBirth", ""))
        today = date.today()
        baseline["age"] = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except ValueError:
        pass
    sex = me.get("HKCharacteristicTypeIdentifierBiologicalSex", "")
    if sex.endswith("Female"):
        baseline["sex"] = "Female"
    elif sex.endswith("Male"):
        baseline["sex"] = "Male"
    return baseline


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 backend/simulator/watch_import.py private/export.zip")
    result = build(sys.argv[1])
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Wrote {OUTPUT}")
    print(f"Resting heart rate: {result['resting_hr']} bpm from {result['days_of_heart_data']} days")
    print(f"Sleep: {result['sleep_hours']} h from {result['days_of_sleep_data']} nights")
