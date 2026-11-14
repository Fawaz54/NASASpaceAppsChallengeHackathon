"""The local AI model (through Ollama).

It explains and it reads free text; it never decides what the crew member
should do. Every function has a fallback, so the app works with Ollama off.
"""
import json
import re
import time
import urllib.request

OLLAMA = "http://localhost:11434"
_model_cache = {"checked": 0.0, "name": None}


def model():
    """Name of the first installed Ollama model, or None. Re-checked every 15 s."""
    if time.time() - _model_cache["checked"] > 15:
        _model_cache["checked"] = time.time()
        try:
            with urllib.request.urlopen(f"{OLLAMA}/api/tags", timeout=1.5) as response:
                models = json.loads(response.read()).get("models", [])
            _model_cache["name"] = models[0]["name"] if models else None
        except Exception:
            _model_cache["name"] = None
    return _model_cache["name"]


def _generate(prompt, as_json=False, timeout=45):
    name = model()
    if not name:
        return None
    payload = {"model": name, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}}
    if as_json:
        payload["format"] = "json"
    request = urllib.request.Request(
        f"{OLLAMA}/api/generate", data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())["response"].strip()
    except Exception:
        return None


def ask(question, areas, alert, indicators):
    """Answer a crew member's question. Returns (answer, based_on, used_ai)."""
    based_on = f"Protocol {alert['protocol_id']}" if alert else "Your current readings"
    facts = {
        "readings": [
            {"indicator": m["label"], "value": m["value"], "unit": m["unit"], "status": m["status"], "note": m["note"]}
            for area in areas for m in area["metrics"]
        ],
        "active_checklist": {k: alert[k] for k in ("protocol_id", "title", "why", "steps")} if alert else None,
        "indicator_notes": {v["label"]: f"{v['what']} {v['space']}" for v in indicators.values()},
    }
    answer = _generate(
        "You explain health readings to an astronaut. Answer in at most four short sentences, "
        "in plain language. Use only the facts below. Do not diagnose, and do not suggest "
        "any action that is not in the active checklist. If the facts do not answer the "
        "question, say you do not have that information.\n\n"
        f"Facts: {json.dumps(facts)}\n\nQuestion: {question}"
    )
    if answer:
        return answer, based_on, True
    answer, source = _fallback_answer(question, alert, indicators)
    return answer, source or based_on, False


def _fallback_answer(question, alert, indicators):
    text = question.lower()
    for item in indicators.values():
        words = [w for w in re.split(r"\W+", item["label"].lower()) if len(w) > 3]
        if any(word in text for word in words):
            return f"{item['what']} {item['space']}", f"Written note on {item['label'].lower()}"
    if alert:
        return f"{alert['title']}. {alert.get('why', '')} This checklist is protocol {alert['protocol_id']}.", None
    return "There is no active checklist right now. Open a health area on the home screen to see what each reading means.", None


def read_description(text, regions, onsets):
    """Pre-fill emergency answers from a typed description. Returns (answers, used_ai)."""
    reply = _generate(
        "Extract facts from an astronaut's description of how they feel. Reply with JSON only: "
        '{"regions": [...], "severity": number or null, "onset": string or null}. '
        f"regions must come from this list: {regions}. onset must be one of: {onsets}. "
        "severity is 1 to 10 and only if they state how bad it is. Do not guess.\n\n"
        f"Description: {text}",
        as_json=True, timeout=30)
    if reply:
        try:
            parsed = json.loads(reply)
            severity = parsed.get("severity")
            return {
                "regions": [r for r in parsed.get("regions") or [] if r in regions],
                "severity": int(severity) if isinstance(severity, (int, float)) and 1 <= severity <= 10 else None,
                "onset": parsed.get("onset") if parsed.get("onset") in onsets else None,
            }, True
        except (ValueError, AttributeError, TypeError):
            pass
    return _read_by_keywords(text, regions), False


def _read_by_keywords(text, regions):
    lowered = text.lower()
    found = [r for r in regions if r.lower() in lowered]
    for word, matches in (("back", ["Lower back"]), ("stomach", ["Abdomen"]), ("belly", ["Abdomen"]),
                          ("headache", ["Head"]), ("arm", ["Left arm", "Right arm"]),
                          ("leg", ["Left leg", "Right leg"])):
        if word in lowered and not any(m in found for m in matches) and not (word == "back" and "back" in " ".join(found).lower()):
            found.append(matches[0])
    number = re.search(r"\b(10|[1-9])\s*(?:/|out of)\s*10\b", lowered)
    return {"regions": found, "severity": int(number.group(1)) if number else None, "onset": None}
