"""The Earth link: messages between the crew member and the flight surgeon.

Every message takes the one-way signal delay to arrive. For the demo the
delay is sped up: one real minute of delay plays as one second.
"""
import time

import store

DEMO_SPEEDUP = 60
AUTO_ACK = "Automated reply: daily report received. All indicators are in range. No action needed."

_next_id = 1


def delay_real():
    return store.environment()["delay_seconds"]


def delay_demo():
    return delay_real() / DEMO_SPEEDUP


def delay_label():
    seconds = delay_real()
    if seconds < 1:
        return "No noticeable delay"
    if seconds < 60:
        return f"About {seconds:g} s each way"
    return f"{seconds / 60:g} min each way"


def send(sender, kind, title, body, all_green=None, at=None):
    """sender is 'ship' or 'earth'."""
    global _next_id
    sent = at if at is not None else time.time()
    message = {
        "id": _next_id, "from": sender, "kind": kind, "title": title, "body": body,
        "all_green": all_green, "sent_at": sent, "arrives_at": sent + delay_demo(), "acked": False,
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
            send("earth", "auto_ack", "All clear", AUTO_ACK, at=message["arrives_at"])


def _public(message, now):
    arrived = message["arrives_at"] <= now
    return {
        "id": message["id"], "from": message["from"], "kind": message["kind"],
        "title": message["title"], "body": message["body"], "all_green": message["all_green"],
        "sent_at": message["sent_at"], "arrived": arrived,
        "eta_seconds": 0 if arrived else round(message["arrives_at"] - now),
        # What the countdown stands for in real mission time.
        "eta_real_minutes": 0 if arrived else round((message["arrives_at"] - now) * DEMO_SPEEDUP / 60, 1),
    }


def ship_view():
    """What the crew member sees: everything sent, and replies that have arrived."""
    process()
    now = time.time()
    visible = [m for m in store.messages if m["from"] == "ship" or m["arrives_at"] <= now]
    return [_public(m, now) for m in reversed(visible)]


def earth_view():
    """What the flight surgeon sees: only what has reached Earth."""
    process()
    now = time.time()
    visible = [m for m in store.messages if m["from"] == "earth" or m["arrives_at"] <= now]
    return [_public(m, now) for m in reversed(visible)]


def replies_in_transit():
    now = time.time()
    return sum(1 for m in store.messages if m["from"] == "earth" and m["arrives_at"] > now)
