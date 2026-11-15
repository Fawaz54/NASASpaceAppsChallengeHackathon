"""The Earth link: messages between the crew member and the flight surgeon.

Every message takes the one-way signal delay to arrive. For the demo the
delay is sped up: one real minute of delay plays as one second.
"""
import time

import store

DEMO_SPEEDUP = 60
AUTO_ACK = "Automated reply: daily report received. All indicators are in range. No action needed."

_next_id = 1


def delay_real(crew=None):
    return store.environment(crew)["delay_seconds"]


def delay_demo(crew=None):
    return delay_real(crew) / DEMO_SPEEDUP


def delay_label(crew=None):
    seconds = delay_real(crew)
    if seconds < 1:
        return "No noticeable delay"
    if seconds < 60:
        return f"About {seconds:g} s each way"
    return f"{seconds / 60:g} min each way"


def send(sender, kind, title, body, all_green=None, at=None, crew=None, reply_to=None):
    """sender is 'ship' or 'earth'. crew is the astronaut's username."""
    global _next_id
    crew = crew or store.current
    sent = at if at is not None else time.time()
    env = store.environment(crew)
    account = store.accounts.get(crew) or {}
    message = {
        "id": _next_id, "from": sender, "kind": kind, "title": title, "body": body,
        "all_green": all_green, "sent_at": sent, "arrives_at": sent + delay_demo(crew), "acked": False,
        "crew": crew, "reply_to": reply_to, "cloud": None,
        # Conditions locked in at the moment of sending.
        "context": {
            "crew": account.get("full_name") or "Crew member",
            "username": crew,
            "mission_day": store.mission_day(crew),
            "location": env["label"],
            "signal_delay_seconds": env["delay_seconds"],
            "background_dose_rate_msv_per_day": env["dose_rate"],
            "gravity_g": env["gravity_g"],
        },
    }
    _next_id += 1
    store.messages.append(message)
    return message


def process():
    """Send the automatic all-clear for green daily reports once they reach Earth."""
    now = time.time()
    for message in list(store.messages):
        if (message["from"] == "ship" and message["kind"] == "daily_report"
                and message["all_green"] and not message["acked"] and message["arrives_at"] <= now):
            message["acked"] = True
            send("earth", "auto_ack", "All clear", AUTO_ACK, at=message["arrives_at"],
                 crew=message["crew"], reply_to=message["id"])


def _report_status(message, now, replies_must_have_arrived):
    """For a daily report: sent, delivered or reviewed, and the feedback if any."""
    replies = [m for m in store.messages if m["from"] == "earth" and m["reply_to"] == message["id"]
               and (m["arrives_at"] <= now or not replies_must_have_arrived)]
    if replies:
        return "Reviewed", replies[-1]["body"]
    return ("Delivered" if message["arrives_at"] <= now else "Sent"), None


def _public(message, now, for_ship):
    arrived = message["arrives_at"] <= now
    public = {
        "id": message["id"], "from": message["from"], "kind": message["kind"],
        "title": message["title"], "body": message["body"], "all_green": message["all_green"],
        "sent_at": message["sent_at"], "arrived": arrived, "crew": message["crew"],
        "reply_to": message["reply_to"], "cloud": message["cloud"], "context": message["context"],
        "eta_seconds": 0 if arrived else round(message["arrives_at"] - now),
        # What the countdown stands for in real mission time.
        "eta_real_minutes": 0 if arrived else round((message["arrives_at"] - now) * DEMO_SPEEDUP / 60, 1),
    }
    if message["kind"] == "daily_report":
        public["report_status"], public["feedback"] = _report_status(message, now, for_ship)
    return public


def ship_view(crew):
    """What one crew member sees: what they sent, and replies that have arrived."""
    process()
    now = time.time()
    visible = [m for m in store.messages if m["crew"] == crew and (m["from"] == "ship" or m["arrives_at"] <= now)]
    return [_public(m, now, True) for m in reversed(visible)]


def earth_view():
    """What the flight surgeon sees: only what has reached Earth, from every crew member."""
    process()
    now = time.time()
    visible = [m for m in store.messages if m["from"] == "earth" or m["arrives_at"] <= now]
    return [_public(m, now, False) for m in reversed(visible)]


def replies_in_transit():
    now = time.time()
    return sum(1 for m in store.messages if m["from"] == "earth" and m["arrives_at"] > now)
