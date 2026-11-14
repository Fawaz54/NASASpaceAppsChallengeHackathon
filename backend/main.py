"""Starts the app. Run from the repo root:  python3 backend/main.py

Serves the frontend folder and the JSON endpoints in docs/contract.md.
Uses only the Python standard library, so there is nothing to install.
"""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from ai.summary import earth_link_state
from rules.engine import evaluate
from simulator import simulator

ROOT = Path(__file__).resolve().parent.parent
PORT = 8000
CREW = {"id": "crew-1", "name": "A. Kim", "mission_day": 142}


def build_state():
    readings = simulator.current_readings()
    areas, alert = evaluate(readings)
    return {
        "crew": CREW,
        "scenario": simulator.get_scenario(),
        "readings": readings,
        "areas": areas,
        "alert": alert,
        "earth_link": earth_link_state(alert),
    }


class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        if self.path == "/api/state":
            return self._send_json(build_state())
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/scenario":
            name = self._read_json().get("name", "none")
            if not simulator.set_scenario(name):
                return self._send_json({"error": f"unknown scenario: {name}"}, 400)
            return self._send_json({"scenario": name})
        # TODO (Backend B): /api/checkin and /api/ask, see docs/contract.md
        return self._send_json({"error": "not found"}, 404)


if __name__ == "__main__":
    handler = partial(Handler, directory=str(ROOT / "frontend"))
    print(f"Open http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
