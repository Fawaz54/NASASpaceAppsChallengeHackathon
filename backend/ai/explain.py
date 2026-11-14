"""Owner: Backend B. Plain-language answers for the "Ask why" screen, from a local model.

The rules engine decides what to do; the model only explains it.
Needs Ollama running locally. Set MODEL to the model the team agreed on.
"""
import json
import urllib.request

MODEL = "CHANGE_ME"  # the exact name you used with `ollama pull`
OLLAMA_URL = "http://localhost:11434/api/generate"


def explain(question, readings, protocol):
    """Returns an answer string. Falls back to fixed text if the model is unavailable."""
    prompt = (
        "You explain health alerts to an astronaut. Answer in three short sentences, "
        "using only the readings and protocol below. If they do not answer the "
        "question, say so.\n\n"
        f"Readings: {json.dumps(readings)}\n"
        f"Protocol: {json.dumps(protocol)}\n\n"
        f"Question: {question}"
    )
    body = json.dumps({"model": MODEL, "prompt": prompt, "stream": False}).encode()
    request = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())["response"].strip()
    except Exception:
        return fallback(protocol)


def fallback(protocol):
    return f"This checklist comes from protocol {protocol['id']}: {protocol['title']}."


# TODO (Backend B): expose this as POST /api/ask in main.py
