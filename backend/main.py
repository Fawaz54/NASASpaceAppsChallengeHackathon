"""Starts the app. Run from the repo root:  python3 backend/main.py

Serves the frontend folder and the JSON endpoints listed in docs/contract.md.
Uses only the Python standard library, so there is nothing to install.
"""
import json
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import comms
import store
from ai import explain
from nasa_data import donki
from rules import triage
from rules.engine import band, evaluate, indicators
from simulator import simulator

PORT = 8000
MEASURED = {"systolic_bp": "Blood pressure", "blood_sugar": "Blood sugar", "body_temp": "Body temperature"}
STATUS_WORD = {"ok": "OK", "watch": "WATCH", "act": "ACT"}


# ---------- building what the screens show ----------

def snapshot():
    readings = simulator.current_readings()
    areas, alert, all_green = evaluate(readings)
    return readings, areas, alert, all_green


def area_lines(areas):
    lines = []
    for area in areas:
        values = ", ".join(f"{m['label'].lower()} {m['value']} {m['unit']}" for m in area["metrics"])
        note = f" [{area['note']}]" if area["note"] else ""
        lines.append(f"{area['label']}: {STATUS_WORD[area['status']]} ({values}){note}")
    return lines


def who():
    return (store.profile or {}).get("name") or "Crew member"


def report_alert(alert, areas):
    """Tell Earth once when a new alert appears."""
    protocol_id = alert["protocol_id"] if alert else None
    if protocol_id and protocol_id != store.last_alert:
        area = next(a for a in areas if a["id"] == alert["area"])
        comms.send("ship", "alert", f"Alert: {alert['title']}", "\n".join([
            f"Automatic alert for {who()}, mission day {store.mission_day()}.",
            *area_lines([area]),
            f"Checklist shown to crew member: {protocol_id} ({len(alert['steps'])} steps).",
        ]))
    store.last_alert = protocol_id


def reminders():
    if store.checkin_date != store.today():
        return [{"text": "Daily check-in due: mood, sleep and today's readings", "href": "checkin.html"}]
    return [{"text": f"{label} not measured today", "href": "checkin.html"}
            for metric, label in MEASURED.items() if store.manual_dates.get(metric) != store.today()]


def build_state():
    readings, areas, alert, all_green = snapshot()
    report_alert(alert, areas)
    env = store.environment()
    checked_in = store.checkin_date == store.today()
    return {
        "profile": store.profile,
        "environment": {**env, "delay_label": comms.delay_label(), "delay_demo_seconds": round(comms.delay_demo(), 1)},
        "mission_day": store.mission_day(),
        "scenario": simulator.get_scenario(),
        "scenarios": {key: value["label"] for key, value in simulator.SCENARIOS.items()},
        "readings": readings,
        "areas": areas,
        "alert": alert,
        "all_green": all_green,
        "nasa_event": donki.saved_event() if alert and alert["area"] == "radiation" else None,
        "ticks": store.ticks.get(alert["protocol_id"], []) if alert else [],
        "emergency": store.emergency,
        "messages": comms.ship_view()[:8],
        "reminders": reminders(),
        "pain": (store.checkin or {}).get("pain", []) if checked_in else [],
        "ai": {"available": bool(explain.model()), "model": explain.model()},
    }


# ---------- actions ----------

def save_checkin(body):
    pain = [p for p in body.get("pain") or [] if p.get("region") in triage.REGIONS]
    store.checkin = {"mood": body.get("mood"), "sleep_hours": body.get("sleep_hours"),
                     "pain": pain, "notes": (body.get("notes") or "").strip()[:500]}
    store.checkin_date = store.today()
    entered = {"mood": body.get("mood"), "sleep_hours": body.get("sleep_hours"), **(body.get("measurements") or {})}
    for metric, value in entered.items():
        if metric in simulator.METRICS and isinstance(value, (int, float)):
            store.manual[metric] = value
            store.manual_dates[metric] = store.today()

    _, areas, _, all_green = snapshot()
    worst_pain = max((p.get("severity", 0) for p in pain), default=0)
    all_clear = all_green and worst_pain < 4
    pain_text = ", ".join(f"{p['region']} {p.get('severity', '?')}/10" for p in pain) or "none reported"
    lines = [f"Daily report for {who()}, mission day {store.mission_day()}, {store.environment()['label']}.",
             *area_lines(areas), f"Pain: {pain_text}"]
    if store.checkin["notes"]:
        lines.append(f"Crew member's note: {store.checkin['notes']}")
    lines.append("Result: all indicators in range." if all_clear else "Result: needs flight surgeon review.")
    comms.send("ship", "daily_report", "Daily report", "\n".join(lines), all_green=all_clear)
    return {"saved": True, "all_clear": all_clear}


def start_emergency(body):
    if store.emergency:
        return store.emergency  # already called; do not alert twice
    description = (body.get("description") or "").strip()[:500]
    prefill, used_ai = ({"regions": [], "severity": None, "onset": None}, False)
    if description:
        prefill, used_ai = explain.read_description(description, triage.REGIONS, triage.ONSETS)
    _, areas, _, _ = snapshot()
    store.emergency = {"started_at": time.time(), "description": description, "prefill": prefill,
                       "prefill_by_ai": used_ai, "stage": "questions", "crew_alerted": True, "protocol": None}
    comms.send("ship", "emergency", "EMERGENCY: crew member needs help", "\n".join([
        f"{who()} pressed 'I need help' on mission day {store.mission_day()}.",
        f"In their words: {description}" if description else "No description given yet.",
        "Crew medical officer alerted on board.",
        "Readings at that moment:", *area_lines(areas),
    ]))
    return store.emergency


def describe_emergency(body):
    """Read the crew member's own words and pre-fill the questions."""
    if not store.emergency:
        return {"error": "no active emergency"}
    description = (body.get("description") or "").strip()[:500]
    prefill, used_ai = explain.read_description(description, triage.REGIONS, triage.ONSETS)
    store.emergency.update({"description": description, "prefill": prefill, "prefill_by_ai": used_ai})
    return store.emergency


def answer_emergency(body):
    if not store.emergency:
        return {"error": "no active emergency"}
    answers = {
        "regions": [r for r in body.get("regions") or [] if r in triage.REGIONS],
        "severity": body.get("severity"),
        "onset": body.get("onset") if body.get("onset") in triage.ONSETS else None,
        "signs": [s["id"] for s in triage.SIGNS if s["id"] in (body.get("signs") or [])],
    }
    protocol = triage.choose(answers)
    store.emergency.update({"stage": "steps", "answers": answers, "protocol": protocol})
    signs = [s["question"] for s in triage.SIGNS if s["id"] in answers["signs"]]
    comms.send("ship", "emergency", "Emergency assessment", "\n".join([
        f"Assessment for {who()}.",
        f"In their words: {store.emergency['description'] or 'no description given'}",
        f"Where: {', '.join(answers['regions']) or 'not specified'}",
        f"Severity: {answers['severity'] or '?'}/10",
        f"Started: {answers['onset'] or 'not specified'}",
        "Danger signs answered yes: " + ("; ".join(signs) if signs else "none"),
        f"Checklist shown to crew member: {protocol['protocol_id']} ({protocol['title']}).",
    ]))
    return store.emergency


def resolve_emergency(_body):
    if store.emergency:
        comms.send("ship", "emergency", "Emergency closed by crew member",
                   f"{who()} marked the emergency as under control.")
    store.emergency = None
    return {"resolved": True}


def save_ticks(body):
    protocol_id, done = body.get("protocol_id"), sorted(set(body.get("done") or []))
    store.ticks[protocol_id] = done
    _, _, alert, _ = snapshot()
    if (alert and alert["protocol_id"] == protocol_id and len(done) == len(alert["steps"])
            and protocol_id not in store.completed_reported):
        store.completed_reported.add(protocol_id)
        comms.send("ship", "update", f"Checklist {protocol_id} completed",
                   f"{who()} has completed all {len(done)} steps of {protocol_id}.")
    return {"saved": True}


def ask(body):
    _, areas, alert, _ = snapshot()
    answer, based_on, used_ai = explain.ask((body.get("question") or "")[:300], areas, alert, indicators())
    return {"answer": answer, "based_on": based_on, "used_ai": used_ai}


def set_scenario(body):
    name = body.get("name", "none")
    if not simulator.set_scenario(name):
        return {"error": f"unknown scenario: {name}"}
    store.ticks.clear()
    store.completed_reported.clear()
    return {"scenario": name}


def reset(_body):
    simulator.set_scenario("none")
    store.checkin = store.checkin_date = store.emergency = store.last_alert = None
    store.messages.clear()
    store.ticks.clear()
    store.completed_reported.clear()
    return {"reset": True}


def doctor_reply(body):
    text = (body.get("text") or "").strip()[:1000]
    if not text:
        return {"error": "empty reply"}
    comms.send("earth", "feedback", "Flight surgeon", text)
    return {"sent": True}


def history(query):
    metric = (query.get("metric") or [""])[0]
    if metric not in simulator.METRICS:
        return {"error": "unknown metric"}
    info = indicators().get(metric, {})
    return {"metric": metric, "label": info.get("label", metric), "unit": simulator.METRICS[metric][1],
            "baseline": simulator.baseline(metric), "band": band(metric), "values": simulator.history(metric)}


GET = {
    "/api/state": lambda q: build_state(),
    "/api/profile": lambda q: {"profile": store.profile, "suggested": store.watch_baseline(),
                               "environments": store.ENVIRONMENTS},
    "/api/indicators": lambda q: indicators(),
    "/api/triage": lambda q: triage.questions(),
    "/api/history": history,
    "/api/doctor": lambda q: {"profile": store.profile, "environment": store.environment(),
                              "delay_label": comms.delay_label(), "messages": comms.earth_view(),
                              "in_transit": comms.replies_in_transit()},
}
POST = {
    "/api/profile": lambda body: {"profile": store.save_profile(body)},
    "/api/scenario": set_scenario,
    "/api/checkin": save_checkin,
    "/api/steps": save_ticks,
    "/api/ask": ask,
    "/api/emergency/start": start_emergency,
    "/api/emergency/describe": describe_emergency,
    "/api/emergency/answer": answer_emergency,
    "/api/emergency/resolve": resolve_emergency,
    "/api/doctor/reply": doctor_reply,
    "/api/reset": reset,
}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # keep the terminal quiet

    def _send_json(self, payload):
        status = 400 if isinstance(payload, dict) and "error" in payload else 200
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path in GET:
            return self._send_json(GET[url.path](parse_qs(url.query)))
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in POST:
            return self._send_json({"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self._send_json({"error": "invalid JSON"})
        return self._send_json(POST[path](body if isinstance(body, dict) else {}))


if __name__ == "__main__":
    store.load_profile()
    handler = partial(Handler, directory=str(store.ROOT / "frontend"))
    print(f"Crew screen:   http://localhost:{PORT}")
    print(f"Doctor screen: http://localhost:{PORT}/doctor.html")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
