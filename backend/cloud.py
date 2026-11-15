"""Earth-side medical archive in Microsoft Azure Blob Storage.

The ship never talks to the cloud. When a message reaches Earth (after the
signal delay), mission control saves it to Azure as one JSON file. If the
internet is down, messages wait and are uploaded when it returns.

Setup is in docs/azure.md. The access link lives in private/azure.json,
which Git ignores:  {"container_sas_url": "https://...blob.core.windows.net/...?sv=..."}
Uses only the standard library (Azure's plain web API), so nothing to install.
"""
import json
import re
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from xml.etree import ElementTree

import store

CONFIG = store.PRIVATE / "azure.json"
SYNC_SECONDS = 2      # how often waiting messages are retried
LIST_SECONDS = 10     # how often the archive listing is refreshed
TIMEOUT = 6

_status = {"connected": None, "error": None}
_archive = {"files": [], "checked": 0.0}


def _link():
    """Returns (container address, access token) or None if not set up."""
    url = (store.load_json(CONFIG) or {}).get("container_sas_url", "").strip()
    local_test = url.startswith(("http://localhost", "http://127.0.0.1"))
    if "?" not in url or not (url.startswith("https://") or local_test):
        return None
    base, token = url.split("?", 1)
    return base.rstrip("/"), token


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "crew").lower()).strip("-") or "crew"


def file_name(message):
    """For example: fawaz/2026-11-14_fawaz_daily_report_0007.json"""
    day = datetime.fromtimestamp(message["sent_at"]).strftime("%Y-%m-%d")   # local date, to match report titles
    crew = _slug(message["crew"])
    kind = "dailyreport" if message["kind"] == "daily_report" else message["kind"]
    return f"{crew}/{day}_{crew}_{kind}_{message['id']:04d}.json"


def _upload(link, message):
    base, token = link
    record = {
        "id": message["id"], "from": message["from"], "kind": message["kind"],
        "title": message["title"], "body": message["body"], "all_green": message["all_green"],
        "sent_at": datetime.fromtimestamp(message["sent_at"], timezone.utc).isoformat(timespec="seconds"),
        "reply_to": message["reply_to"], "context": message["context"],
    }
    request = urllib.request.Request(
        f"{base}/{urllib.parse.quote(file_name(message))}?{token}",
        data=json.dumps(record, indent=2).encode(), method="PUT",
        headers={"x-ms-blob-type": "BlockBlob", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.status in (200, 201)


def _list(link):
    base, token = link
    with urllib.request.urlopen(f"{base}?restype=container&comp=list&{token}", timeout=TIMEOUT) as response:
        tree = ElementTree.fromstring(response.read())
    files = []
    for blob in tree.iter("Blob"):
        properties = blob.find("Properties")
        files.append({
            "name": blob.findtext("Name"),
            "size": int(properties.findtext("Content-Length") or 0) if properties is not None else 0,
            "modified": properties.findtext("Last-Modified") if properties is not None else "",
        })
    return sorted(files, key=lambda f: f["name"], reverse=True)


def sync():
    """Upload everything that has reached Earth and is not stored yet."""
    link = _link()
    if not link:
        _status.update(connected=None, error=None)
        return
    now = time.time()
    try:
        for message in list(store.messages):
            at_earth = message["from"] == "earth" or message["arrives_at"] <= now
            if at_earth and message.get("cloud") != "stored":
                message["cloud"] = "waiting"
                if _upload(link, message):
                    message["cloud"] = "stored"
        if now - _archive["checked"] > LIST_SECONDS:
            _archive.update(files=_list(link), checked=now)
        _status.update(connected=True, error=None)
    except Exception as problem:  # no internet, expired link, wrong permissions
        _status.update(connected=False, error=str(problem)[:200])


def _loop():
    while True:
        time.sleep(SYNC_SECONDS)
        try:
            sync()
        except Exception:
            pass


def start():
    threading.Thread(target=_loop, daemon=True).start()


def status():
    link = _link()
    waiting = sum(1 for m in store.messages if m.get("cloud") == "waiting")
    return {
        "configured": bool(link),
        "connected": _status["connected"],
        "error": _status["error"],
        "account": urllib.parse.urlsplit(link[0]).netloc if link else None,
        "waiting": waiting,
        "files": _archive["files"][:30],
        "file_count": len(_archive["files"]),
    }
