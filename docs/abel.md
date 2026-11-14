# Abel: simulator and NASA data (backend)

Read [getting-started.md](getting-started.md) first.

## Your job in one sentence

You produce the numbers. Everything on screen starts as a reading that your
code generates, so your work decides how realistic the demo looks.

## Your files

| File | What it is |
|---|---|
| `backend/simulator/simulator.py` | Generates the fake readings. Already works in a basic way. |
| `backend/nasa_data/donki.py` | Fetches real solar radiation events from NASA. Fetch works; the rest is to do. |
| `backend/simulator/watch_import.py` | Will turn a smartwatch export into a baseline. Empty. |

## Step 1: understand what is there

1. Start the app and click each scenario button at the bottom of the page.
2. Open `simulator.py` and find these three things:
   - `BASELINE`: the normal value for each metric, its unit, and its "wobble"
     (how much it randomly moves so the numbers look alive).
   - `SCENARIOS`: for each scenario, which metrics it forces to a bad value.
   - `current_readings()`: called every time the page asks for data. It
     returns one reading per metric.
3. Change a number in `SCENARIOS`, restart the app, and watch the page change.

**What this means:** a "reading" is one measurement in the format in
[contract.md](contract.md). You must keep that format exactly, because
Fawaz's rules and the frontend both depend on it.

## Step 2: make scenarios build up gradually

Right now clicking "Radiation event" jumps the dose rate from 0.7 to 4.2
instantly. Real problems build up, and a rising line looks far better in a demo.

1. In `set_scenario`, remember the time the scenario started (`time.time()`).
2. In `current_readings`, work out how far along the scenario is:
   `progress = min(1, seconds_since_start / 60)`.
3. Use `value = normal + (target - normal) * progress` instead of jumping
   straight to the target.

**What this means:** `progress` goes from 0 to 1 over 60 seconds. At 0 the
value is normal, at 1 it is the scenario's target, and in between it climbs
smoothly. Change 60 to make the demo faster or slower.

**Check it works:** click "Radiation event" and refresh `/api/state` a few
times. The dose rate should climb, and the tile should go amber, then red.

## Step 3: keep a history for the trend chart

Srijana's trend screen needs 30 days of past values, and Fawaz's drift
detection needs them too.

1. When the app starts, generate 30 days of past values per metric (one per
   day is enough): the baseline value plus a little random variation.
2. Add a function `history(metric)` that returns them as a list of readings.
3. For the heart and behavioral scenarios, make the last 5 to 7 days drift
   toward the bad value, so the trend shows a slow slide rather than a cliff.
4. Tell Fawaz when it is ready. He will add an endpoint so the page can get it,
   and you both add it to `contract.md`.

**What this means:** the "baseline" is what is normal for this one person.
The whole idea of the app is that a slow drift away from your own normal is
a warning sign, even if each single reading still looks fine.

## Step 4: use a real NASA radiation event

This is what lets us say "this demo replays a real solar event".

1. Run the fetcher:

   ```bash
   python3 backend/nasa_data/donki.py
   ```

   It prints the times of solar energetic particle (SEP) events in the date
   range at the bottom of the file. If it prints nothing, widen or move the
   dates (the range must be 60 days or less) and try again.
2. Pick one event. Save its full JSON into a new file `data/donki_event.json`.
3. Make the radiation scenario read that file and use the event's real start
   time and date in what it reports.
4. Give Mehek the event's date and ID for `docs/sources.md`.

**What this means:** an SEP event is a burst of high-energy particles from
the Sun, the main sudden radiation danger for a crew. DONKI is NASA's public
log of them. We save the event to a file because the demo must work with the
wifi off.

**Be honest about the limit:** DONKI tells us when an event happened, not
the dose an astronaut would receive. The dose numbers stay simulated, so say
"timing from a real event, dose simulated" rather than claiming more.

## Step 5 (if there is time): smartwatch baseline

1. Ask the two teammates with smartwatches to export their data (see the
   export steps for their brand) and put the file in `private/` on your laptop.
2. In `watch_import.py`, read the file and work out the average heart rate,
   resting heart rate and sleep hours.
3. Use those averages in place of the made-up numbers in `BASELINE`.

Never commit the export itself. `private/` is ignored by Git for this reason.

## You are done when

- Each scenario ramps up smoothly instead of jumping.
- `history(metric)` returns 30 days of values.
- The radiation scenario is tied to a real, named DONKI event saved in `data/`.

## Who you depend on, and who depends on you

- Fawaz reads your readings and history. Tell him before changing their shape.
- Srijana's trend chart needs your history.
- Mehek needs the DONKI event details for the sources list.
