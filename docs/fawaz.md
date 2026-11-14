# Fawaz: rules, AI and Earth link (backend)

Read [getting-started.md](getting-started.md) first.

## Your job in one sentence

You turn readings into decisions: which tile is red, which checklist shows,
what the AI says when asked why, and what gets sent to the doctor on Earth.

## Your files

| File | What it is |
|---|---|
| `backend/rules/engine.py` | Decides ok/watch/act per health area and picks the checklist. Basic version works. |
| `backend/main.py` | The server. Has `/api/state` and `/api/scenario`; you add the rest. |
| `backend/ai/explain.py` | Asks the local Ollama model to explain an alert. Written but not connected. |
| `backend/ai/summary.py` | The Earth link: summary to the doctor and reply delay. Basic version works. |

## Step 1: understand what is there

1. Open http://localhost:8000/api/state in the browser. That JSON is
   everything the frontend gets. Compare it with [contract.md](contract.md).
2. In `main.py`, read `build_state()`. It calls Abel's simulator for
   readings, your `evaluate()` for statuses, and `earth_link_state()`.
3. In `engine.py`, read `evaluate()` and `_status()`. Then open
   `data/thresholds.json` next to it.

**What this means:** each threshold has a `direction`. `"above"` means high
values are bad (dose rate, heart rate). `"below"` means low values are bad
(sleep, mood, exercise). A reading past `watch` turns its area amber; past
`act` turns it red. An area with several metrics takes its worst status.

## Step 2: add the check-in endpoint

Srijana's check-in screen needs somewhere to send its answers.

1. In `main.py`, inside `do_POST`, add a branch for `/api/checkin`.
2. Read the body with `self._read_json()`. Its shape is in the contract:
   mood, sleep quality, and a list of painful body regions with severity.
3. Store the latest check-in in a variable, and reply `{"saved": true}`.
4. In `build_state()`, if there is a check-in, replace the simulator's `mood`
   reading with the checked-in mood before calling `evaluate()`.

**What this means:** an "endpoint" is an address the page sends data to.
Until now mood was invented by the simulator; after this step the astronaut's
own answer drives the Mind and sleep tile.

**Check it works:**

```bash
curl -X POST -H "Content-Type: application/json" -d '{"mood": 1, "sleep_quality": 2, "pain": []}' http://localhost:8000/api/checkin
```

Then reload the page: Mind and sleep should be red.

## Step 3: connect Ollama for "Ask why"

1. See which models you have:

   ```bash
   ollama list
   ```

   If the list is empty, pull one small model (a 3 to 4 billion parameter
   one). Whatever name `ollama list` shows is the name to use.
2. In `explain.py`, set `MODEL` to that exact name.
3. In `main.py`, add a `/api/ask` branch in `do_POST`. It should get the
   question from the body, look up the current alert's protocol, call
   `explain(question, readings, protocol)`, and reply with
   `{"answer": ..., "protocol_id": ...}`.
4. If there is no alert, reply with a fixed sentence such as "All readings
   are in your normal range." without calling the model.

**What this means:** the model does not decide anything medical. Your rules
already chose the checklist; the model only rewords the reason in plain
language, using the readings and protocol text you pass it. That is our
answer when a judge asks "what if the AI makes something up?".

**Check it works:** switch on the radiation scenario, then:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"question": "Why do I need to move?"}' http://localhost:8000/api/ask
```

Then quit Ollama and run it again. You should still get an answer (the
fallback text) rather than an error. Time how long the model takes on your
laptop; if it is more than a few seconds, try a smaller model.

## Step 4: detect drift, not just single bad readings

Needs Abel's `history(metric)` from his step 3.

1. For each metric, take the average of the first 20 or so days of history
   as the baseline, and the average of the last 3 days as "recent".
2. If recent has moved away from the baseline by more than a set fraction
   (start with 10%) in the bad direction, mark the area `watch` even if
   today's reading is under the threshold.
3. Add a field to that area in the state, such as
   `"note": "Resting heart rate up 12% over 5 days"`, and add it to the contract.

**What this means:** the challenge says astronauts must "spot changes in
themselves". A threshold catches a reading that is already bad. Drift
detection catches one that is still acceptable but heading the wrong way,
which is the more useful warning.

## Step 5: make the Earth link real

1. In `summary.py`, write a function that builds the message to the flight
   surgeon from the alert: what changed, which protocol was shown, and which
   steps are ticked.
2. Remember the time the summary was sent, and make `reply_eta_minutes`
   count down from 38.
3. When it reaches zero, add a scripted reply to the state, such as
   "Flight surgeon: agree with RAD-01, remain in shelter", and add the field
   to the contract so Mika can show it.
4. For the demo, add a way to shorten the delay (for example 38 seconds
   instead of 38 minutes) so the audience sees the reply arrive.

**What this means:** the delay is the reason the app exists. Showing the
countdown, and the astronaut already acting before it ends, is the strongest
moment of the demo.

## Step 6 (if there is time): two problems at once

When two areas are `act`, return the more urgent one as `alert` (radiation
first, then heart, mind, bone) and add the others in a list.

## You are done when

- `/api/checkin` and `/api/ask` work and are in the contract.
- "Ask why" answers from Ollama, and still answers when Ollama is off.
- A slow drift turns a tile amber before any threshold is crossed.
- The Earth reply countdown runs and a reply appears at the end.

## Who you depend on, and who depends on you

- You need Abel's history for step 4.
- You need Mehek's real thresholds and protocols; your code reads whatever is in `data/`.
- Every frontend screen depends on your endpoints. Tell all three before any
  change to the contract, and update `frontend/mock/state.json` to match.
