"""Starts the app. Run from the repo root:  python3 backend/main.py

Serves the frontend folder and the JSON endpoints listed in docs/contract.md.
Uses only the Python standard library, so there is nothing to install.
"""
import json
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import cloud
import comms
import crew
import store
from ai import explain, speech
from nasa_data import donki
from rules import triage
from rules.engine import band, evaluate, indicators
from simulator import simulator

PORT = 8000
STATUS_WORD = {"ok": "OK", "watch": "WATCH", "act": "ACT", "neutral": "OK"}
VITALS = ["body_temp", "heart_rate", "systolic_bp", "spo2", "sleep_hours", "fluid_l", "blood_sugar"]
CAREER_LIMIT_MSV = 600  # NASA-STD-3001 Vol 1 [V1 4030], see docs/sources.md
EXERCISE_TARGET_MIN = 120  # station crews average two hours a day (NASA), see docs/sources.md

# The daily check-in: several short assessments. The screens are drawn from
# this list, so adding a question here adds it to the app.
ASSESSMENTS = [
    {"id": "vitals", "title": "Vitals check", "intro": "Take the measurements you can. Leave a box empty to keep the sensor reading.", "items": [
        {"key": "systolic_bp", "type": "number", "label": "Blood pressure, upper number", "unit": "mmHg", "min": 60, "max": 250, "metric": True},
        {"key": "spo2", "type": "number", "label": "Blood oxygen", "unit": "%", "min": 70, "max": 100, "metric": True},
        {"key": "body_temp", "type": "number", "label": "Body temperature", "unit": "°C", "min": 30, "max": 43, "metric": True},
        {"key": "blood_sugar", "type": "number", "label": "Blood sugar", "unit": "mg/dL", "min": 20, "max": 600, "metric": True},
    ]},
    {"id": "mind", "title": "Mind and sleep", "intro": "There are no right answers. This helps the flight surgeon support you.", "items": [
        {"key": "mood", "type": "scale", "label": "How is your mood today?", "hint": "1 is very low, 5 is very good.", "min": 1, "max": 5, "required": True, "metric": True},
        {"key": "sleep_hours", "type": "stepper", "label": "How long did you sleep?", "unit": "h", "min": 0, "max": 16, "step": 0.5, "required": True, "metric": True},
        {"key": "concentration", "type": "yesno", "label": "Any trouble concentrating today?", "flag": True},
    ]},
    {"id": "vision", "title": "Vision check", "intro": "Vision can change slowly on long missions, so it is checked every day.", "items": [
        {"key": "blurry", "type": "yesno", "label": "Is your vision blurrier than usual?", "flag": True},
        {"key": "reading", "type": "yesno", "label": "Any trouble reading small text?", "flag": True},
        {"key": "eye_ache", "type": "yesno", "label": "Any headache behind the eyes?", "flag": True},
    ]},
    {"id": "body", "title": "Body and pain", "intro": "Tap where it hurts and set the pain level. Skip the figure if nothing hurts.", "items": [
        {"key": "pain", "type": "bodymap", "label": "Where does it hurt?"},
    ]},
    {"id": "exercise", "title": "Exercise", "intro": "What you have done today. The plan is about two hours a day.", "items": [
        {"key": "cardio_min", "type": "stepper", "label": "Cardio (treadmill or cycle)", "unit": "min", "min": 0, "max": 240, "step": 5, "required": True},
        {"key": "resistance_min", "type": "stepper", "label": "Resistance (weights machine)", "unit": "min", "min": 0, "max": 240, "step": 5, "required": True},
        {"key": "blocked", "type": "yesno", "label": "Did pain or an equipment problem stop you from exercising?", "flag": True},
    ]},
    {"id": "intake", "title": "Food and water", "intro": "What you have had so far today.", "items": [
        {"key": "fluid_l", "type": "stepper", "label": "Water and other drinks", "unit": "L", "min": 0, "max": 10, "step": 0.25, "required": True, "metric": True},
        {"key": "meals", "type": "choice", "label": "Meals eaten", "choices": ["0", "1", "2", "3 or more"], "required": True},
    ]},
]


# ---------- building what the screens show ----------

def who():
    return (store.accounts.get(store.current) or {}).get("full_name") or "Crew member"


def snapshot():
    readings = simulator.current_readings()
    metrics, areas, alert = evaluate(readings)
    return metrics, areas, alert


def metric_lines(metrics):
    return [f"{m['label']}: {m['value']} {m['unit']} [{STATUS_WORD[m['report_status']]}]"
            + (f" ({m['note']})" if m["note"] else "") for m in metrics]


def report_alert(alert, metrics):
    """Tell Earth once when a new alert appears."""
    protocol_id = alert["protocol_id"] if alert else None
    if protocol_id and protocol_id != store.last_alert:
        cause = [m for m in metrics if m["area"] == alert["area"]]
        comms.send("ship", "alert", f"Alert: {alert['title']}", "\n".join([
            f"Automatic alert for {who()}, mission day {store.mission_day()}.",
            *metric_lines(cause),
            f"Checklist shown to crew member: {protocol_id} ({len(alert['steps'])} steps).",
        ]))
    store.last_alert = protocol_id


def todays_assessments():
    if store.assessments_date != store.today():
        store.assessments = {}
        store.assessments_date = store.today()
    return store.assessments


def nudges(metrics):
    """Gentle, private prompts for readings that are never shown in red."""
    found = []
    by_name = {m["metric"]: m for m in metrics}
    mood, exercise = by_name["mood"], by_name["exercise_pct"]
    if mood["report_status"] != "ok":
        requested = store.ticks.get("_call") == store.today()
        found.append({"id": "mood", "requested": requested,
                      "text": "Your mood ratings have been lower than usual lately. That is common on long missions, and "
                              "you do not have to handle it alone.",
                      "action": None if requested else "Request a private call with the flight surgeon"})
    if exercise["report_status"] != "ok":
        found.append({"id": "exercise", "requested": False, "action": None,
                      "text": f"You have done {exercise['value']}% of this week's exercise plan. "
                              "One session today gets you back on track."})
    return found


def exercise_today():
    """Minutes entered in today's check-in, or None if not entered yet."""
    entry = todays_assessments().get("exercise")
    if not entry:
        return None
    return {"cardio": entry.get("cardio_min", 0), "resistance": entry.get("resistance_min", 0)}


def exercise_stats(reading):
    today = exercise_today()
    total = (today["cardio"] + today["resistance"]) if today else 0
    return {**reading, "today": today, "today_total": total, "target_minutes": EXERCISE_TARGET_MIN,
            "today_percent": min(100, round(100 * total / EXERCISE_TARGET_MIN)),
            "streak_days": simulator.exercise_streak() + (1 if total > 0 else 0),
            "source_note": "Today's minutes are from your check-in." if today
                           else "Not entered today yet; the weekly figure is from the exercise equipment log."}


def build_state():
    metrics, areas, alert = snapshot()
    report_alert(alert, metrics)
    env = store.environment()
    by_name = {m["metric"]: m for m in metrics}
    done = list(todays_assessments())
    dose = by_name["dose_rate"]
    total = round(env["dose_rate"] * store.mission_day(), 1)
    return {
        "user": {"username": store.current, "full_name": who()},
        "profile": store.profile,
        "environment": {**env, "delay_label": comms.delay_label(), "delay_demo_seconds": round(comms.delay_demo(), 1)},
        "mission_day": store.mission_day(),
        "scenario": simulator.get_scenario(),
        "scenarios": {key: value["label"] for key, value in simulator.SCENARIOS.items()},
        "vitals": [by_name[name] for name in VITALS],
        "areas": areas,
        "radiation": {**dose, "mission_total": total, "career_limit": CAREER_LIMIT_MSV,
                      "percent_of_limit": round(100 * total / CAREER_LIMIT_MSV, 1)},
        "exercise": exercise_stats(by_name["exercise_pct"]),
        "mood": {**by_name["mood"], "week": [round(v) for v in simulator.history("mood")[-7:]]},
        "alert": alert,
        "all_green": all(a["status"] in ("ok", "neutral") for a in areas.values()),
        "nudges": nudges(metrics),
        "nasa_event": donki.saved_event() if alert and alert["area"] == "radiation" else None,
        "ticks": store.ticks.get(alert["protocol_id"], []) if alert else [],
        "felt_better": bool(alert) and store.ticks.get("_better") == alert["protocol_id"],
        "emergency": store.emergency,
        "messages": comms.ship_view(store.current)[:10],
        "checkin": {"done": done, "total": len(ASSESSMENTS), "sent": store.checkin_date == store.today()},
        "pain": (store.assessments.get("body") or {}).get("pain", []),
        "ai": {"available": bool(explain.model()), "model": explain.model()},
        "speech": {"available": speech.available()},
    }


# ---------- accounts ----------

def account_public(username):
    account = store.accounts[username]
    return {"username": username, "role": account["role"], "full_name": account["full_name"]}


def login(body):
    username = store.slug(body.get("username"))
    if username not in store.accounts:
        return {"error": "No account with that username. Check the spelling or create a new account."}
    return account_public(username)


def signup(body):
    username, problem = store.create_account(body.get("role"), body.get("full_name"), body.get("username"), body)
    return {"error": problem} if problem else account_public(username)


# ---------- daily check-in ----------

def save_assessment(body):
    definition = next((a for a in ASSESSMENTS if a["id"] == body.get("id")), None)
    if not definition:
        return {"error": "Unknown assessment."}
    data, answers = body.get("data") or {}, {}
    for item in definition["items"]:
        value = data.get(item["key"])
        if item["type"] == "bodymap":
            answers["pain"] = [{"region": p["region"], "severity": int(p.get("severity", 5))} for p in value or []
                               if p.get("region") in triage.REGIONS and 1 <= p.get("severity", 5) <= 10]
            continue
        if value in ("", None):
            if item.get("required"):
                return {"error": f"Answer \"{item['label']}\" before saving."}
            continue
        if item["type"] in ("number", "stepper", "scale"):
            if not isinstance(value, (int, float)) or not item["min"] <= value <= item["max"]:
                return {"error": f"{item['label']} must be between {item['min']} and {item['max']}."}
        elif item["type"] == "yesno" and value not in ("Yes", "No"):
            continue
        elif item["type"] == "choice" and value not in item["choices"]:
            continue
        answers[item["key"]] = value
        if item.get("metric"):
            store.manual[item["key"]] = value
            store.manual_dates[item["key"]] = store.today()

    done = todays_assessments()
    done[definition["id"]] = answers
    if definition["id"] == "exercise":
        # This week's figure: six days from the equipment log plus what was entered today.
        today = min(100, 100 * (answers["cardio_min"] + answers["resistance_min"]) / EXERCISE_TARGET_MIN)
        store.manual["exercise_pct"] = round((simulator.simulated("exercise_pct") * 6 + today) / 7)
        store.manual_dates["exercise_pct"] = store.today()
    result = {"saved": True, "done": list(done), "report_sent": False}
    if len(done) == len(ASSESSMENTS) and store.checkin_date != store.today():
        result["all_clear"] = send_daily_report()
        result["report_sent"] = True
    return result


def send_daily_report():
    metrics, _, _ = snapshot()
    done = todays_assessments()
    pain = done.get("body", {}).get("pain", [])
    concerns = [item["label"] for a in ASSESSMENTS for item in a["items"]
                if item.get("flag") and done.get(a["id"], {}).get(item["key"]) == "Yes"]
    all_clear = (all(m["report_status"] == "ok" for m in metrics) and not concerns
                 and max((p["severity"] for p in pain), default=0) < 4)
    lines = [f"Daily report for {who()}, mission day {store.mission_day()}, {store.environment()['label']}.", "",
             *metric_lines(metrics), "",
             "Pain: " + (", ".join(f"{p['region']} {p['severity']}/10" for p in pain) or "none reported"),
             "Answered yes: " + ("; ".join(concerns) if concerns else "nothing"),
             f"Meals eaten today: {done.get('intake', {}).get('meals', 'not given')}",
             f"Exercise today: {done.get('exercise', {}).get('cardio_min', 0)} min cardio, "
             f"{done.get('exercise', {}).get('resistance_min', 0)} min resistance", "",
             "Result: all indicators in range." if all_clear else "Result: needs flight surgeon review."]
    comms.send("ship", "daily_report", f"{store.today()}_{store.current}_dailyreport", "\n".join(lines), all_green=all_clear)
    store.checkin = dict(done)
    store.checkin_date = store.today()
    return all_clear


def assessments(_query):
    return {"assessments": ASSESSMENTS, "done": todays_assessments(), "sent": store.checkin_date == store.today(),
            "defaults": {"sleep_hours": (store.profile or {}).get("sleep_hours") or 7, "fluid_l": 2,
                         "cardio_min": 30, "resistance_min": 60},
            "regions": triage.REGIONS}


def nudge(body):
    if body.get("id") == "mood" and store.ticks.get("_call") != store.today():
        store.ticks["_call"] = store.today()
        comms.send("ship", "update", "Private call requested",
                   f"{who()} would like a private call with the flight surgeon.")
    return {"sent": True}


def feeling_better(_body):
    """The crew member says they feel better while an alert is showing."""
    _, _, alert = snapshot()
    if alert and store.ticks.get("_better") != alert["protocol_id"]:
        store.ticks["_better"] = alert["protocol_id"]
        comms.send("ship", "update", "Crew member feels better",
                   f"{who()} reports feeling better during alert {alert['protocol_id']} ({alert['title']}). "
                   "The alert stays on screen until the reading is back in range.")
    return {"sent": True}


# ---------- emergency ----------

def start_emergency(body):
    if store.emergency:
        return store.emergency  # already called; do not alert twice
    metrics, _, _ = snapshot()
    store.emergency = {"started_at": time.time(), "description": "", "stage": "questions", "crew_alerted": True,
                       "prefill": {"type": None, "regions": [], "severity": None, "onset": None},
                       "prefill_by_ai": False, "protocol": None}
    comms.send("ship", "emergency", "EMERGENCY: crew member needs help", "\n".join([
        f"{who()} pressed 'I need help' on mission day {store.mission_day()}.",
        "Crew medical officer alerted on board.",
        "Readings at that moment:", *metric_lines(metrics),
    ]))
    return store.emergency


def describe_emergency(body):
    """Read the crew member's own words and pre-fill the questions."""
    if not store.emergency:
        return {"error": "no active emergency"}
    description = (body.get("description") or "").strip()[:500]
    prefill, used_ai = explain.read_description(description, triage.REGIONS, triage.ONSETS,
                                                [t["id"] for t in triage.TYPES])
    store.emergency.update({"description": description, "prefill": prefill, "prefill_by_ai": used_ai})
    return store.emergency


def answer_emergency(body):
    if not store.emergency:
        return {"error": "no active emergency"}
    kind = triage.find_type(body.get("type"))
    severity = body.get("severity")
    answers = {
        "type": kind["id"] if kind else None,
        "details": body.get("details") if isinstance(body.get("details"), dict) else {},
        "regions": [r for r in body.get("regions") or [] if r in triage.REGIONS],
        "severity": severity if isinstance(severity, int) and 1 <= severity <= 10 else None,
        "onset": body.get("onset") if body.get("onset") in triage.ONSETS else None,
        "signs": [s["id"] for s in triage.SIGNS if s["id"] in (body.get("signs") or [])],
    }
    protocol = triage.choose(answers)
    store.emergency.update({"stage": "steps", "answers": answers, "protocol": protocol})
    signs = [s["question"] for s in triage.SIGNS if s["id"] in answers["signs"]]
    comms.send("ship", "emergency", "Emergency assessment", "\n".join([
        f"Assessment for {who()}.",
        f"In their words: {store.emergency['description'] or 'no description given'}",
        f"What happened: {kind['label'] if kind else 'not specified'}",
        *triage.describe_details(kind, answers["details"]),
        f"Where: {', '.join(answers['regions']) or 'not specified'}",
        f"Pain level: {answers['severity'] or '?'}/10",
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


# ---------- other crew actions ----------

def save_ticks(body):
    protocol_id, done = body.get("protocol_id"), sorted(set(body.get("done") or []))
    store.ticks[protocol_id] = done
    _, _, alert = snapshot()
    if (alert and alert["protocol_id"] == protocol_id and len(done) == len(alert["steps"])
            and protocol_id not in store.completed_reported):
        store.completed_reported.add(protocol_id)
        comms.send("ship", "update", f"Checklist {protocol_id} completed",
                   f"{who()} has completed all {len(done)} steps of {protocol_id}.")
    return {"saved": True}


def ask(body):
    metrics, _, alert = snapshot()
    answer, based_on, used_ai = explain.ask((body.get("question") or "")[:300], metrics, alert, indicators())
    return {"answer": answer, "based_on": based_on, "used_ai": used_ai}


def history(query):
    metric = (query.get("metric") or [""])[0]
    if metric not in simulator.METRICS:
        return {"error": "unknown metric"}
    info = indicators().get(metric, {})
    return {"metric": metric, "label": info.get("label", metric), "unit": simulator.METRICS[metric][1],
            "baseline": simulator.baseline(metric), "band": band(metric), "values": simulator.history(metric),
            "crew_average": crew.averages().get(metric)}


def transcribe(audio):
    text, problem = speech.transcribe(audio)
    return {"error": problem} if problem else {"text": text}


# ---------- demo controls ----------

def set_scenario(body):
    name = body.get("name", "none")
    if not simulator.set_scenario(name):
        return {"error": f"unknown scenario: {name}"}
    store.ticks.clear()
    store.completed_reported.clear()
    return {"scenario": name}


def reset(_body):
    simulator.set_scenario("none")
    store.reset_states()
    return {"reset": True}


# ---------- flight surgeon ----------

def doctor_view(_query):
    astronauts = [{**account_public(name), "location": store.environment(name)["label"],
                   "delay_label": comms.delay_label(name), "profile": store.accounts[name]["profile"]}
                  for name, account in store.accounts.items() if account["role"] == "astronaut"]
    return {"astronauts": astronauts, "messages": comms.earth_view(),
            "in_transit": comms.replies_in_transit(), "cloud": cloud.status()}


def doctor_reply(body):
    text = (body.get("text") or "").strip()[:1000]
    target = body.get("crew")
    if not text:
        return {"error": "Write a reply first."}
    if (store.accounts.get(target) or {}).get("role") != "astronaut":
        return {"error": "Choose which crew member to reply to."}
    reply_to = body.get("reply_to") if isinstance(body.get("reply_to"), int) else None
    comms.send("earth", "feedback", f"Flight surgeon {who() if store.current else ''}".strip(), text,
               crew=target, reply_to=reply_to)
    return {"sent": True}


GET = {
    "/api/state": lambda q: build_state(),
    "/api/profile": lambda q: {"profile": store.profile, "suggested": store.watch_baseline(),
                               "environments": store.ENVIRONMENTS, "ranges": store.PROFILE_RANGES},
    "/api/indicators": lambda q: indicators(),
    "/api/triage": lambda q: triage.questions(),
    "/api/assessments": assessments,
    "/api/history": history,
    "/api/doctor": doctor_view,
    "/api/crew": lambda q: crew.overview(),
}
POST = {
    "/api/login": login,
    "/api/signup": signup,
    "/api/profile": lambda body: {"profile": store.save_profile(body)},
    "/api/scenario": set_scenario,
    "/api/assessment": save_assessment,
    "/api/nudge": nudge,
    "/api/feeling-better": feeling_better,
    "/api/steps": save_ticks,
    "/api/ask": ask,
    "/api/emergency/start": start_emergency,
    "/api/emergency/describe": describe_emergency,
    "/api/emergency/answer": answer_emergency,
    "/api/emergency/resolve": resolve_emergency,
    "/api/doctor/reply": doctor_reply,
    "/api/reset": reset,
}
# These need a signed-in astronaut.
CREW_ONLY = {"/api/state", "/api/speech", "/api/assessments", "/api/history", "/api/assessment", "/api/nudge", "/api/steps",
             "/api/feeling-better",
             "/api/ask", "/api/emergency/start", "/api/emergency/describe", "/api/emergency/answer",
             "/api/emergency/resolve"}


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

    def _run(self, path, handler, argument):
        """Run one endpoint as the user named in the request."""
        with store.lock:
            store.activate(self.headers.get("X-User"))
            try:
                if path in CREW_ONLY and store.profile is None:
                    return {"error": "signin"}
                if path == "/api/profile" and self.command == "POST" and store.profile is None:
                    return {"error": "signin"}
                return handler(argument)
            finally:
                store.deactivate()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path in GET:
            return self._send_json(self._run(url.path, GET[url.path], parse_qs(url.query)))
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/speech":   # the body is a WAV recording, not JSON
            length = int(self.headers.get("Content-Length", 0))
            if length > speech.MAX_BYTES:
                return self._send_json({"error": "The recording is too long. Try a shorter one."})
            audio = self.rfile.read(length)
            return self._send_json(self._run(path, transcribe, audio))
        if path not in POST:
            return self._send_json({"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self._send_json({"error": "invalid JSON"})
        return self._send_json(self._run(path, POST[path], body if isinstance(body, dict) else {}))


if __name__ == "__main__":
    store.load_accounts()
    cloud.start()
    handler = partial(Handler, directory=str(store.ROOT / "frontend"))
    print(f"Open http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
