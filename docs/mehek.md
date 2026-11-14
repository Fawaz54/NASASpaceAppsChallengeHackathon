# Mehek: content, "Ask why" and the submission (frontend)

Read [getting-started.md](getting-started.md) first.

## Your job in one sentence

You make the app scientifically believable and you tell its story: the
alert limits and checklists come from NASA sources you find, and you own
the "Ask why" screen, the project page and the demo.

You can start right now. Most of your work needs no code from anyone else.

## Your files

| File | What it is |
|---|---|
| `data/thresholds.json` | The value at which each reading turns amber or red. Placeholders now. |
| `data/protocols.json` | The step-by-step checklists. Placeholders now. |
| `docs/sources.md` | The list of where every number and step came from. Empty tables now. |
| `frontend/ask.html` | The "Ask why" screen. Placeholder only. |
| `frontend/js/ask.js` | That screen's behaviour. To do. |

## Step 1: understand what is there

1. Start the app and click each scenario button.
2. Open `data/thresholds.json`. Each line is one metric:

   ```json
   "dose_rate": {"area": "radiation", "direction": "above", "watch": 1.5, "act": 3.0, "placeholder": true, "source": null}
   ```

   - `area`: which tile it belongs to.
   - `direction`: `"above"` means high is bad; `"below"` means low is bad.
   - `watch`: the tile turns amber past this value.
   - `act`: the tile turns red past this value and the checklist appears.
   - `placeholder: true` and `source: null`: nobody has checked this number yet.
3. Change `"act": 3.0` to `"act": 10`, restart the app, and click "Radiation
   event". The tile should no longer turn red. Change it back.

**What this means:** these two files control the app's behaviour without
any programming. The numbers in them now were invented to get the app
running. They are not real medical limits, and judges score scientific
validity, so replacing them is one of the most valuable jobs on the team.

## Step 2: find real thresholds

Work through the six metrics in `thresholds.json`, most important first:
dose rate, heart rate, blood pressure, sleep, exercise, mood.

1. Search the NASA Technical Reports Server, https://ntrs.nasa.gov. Useful
   searches:
   - "space radiation exposure limits astronaut"
   - "spaceflight cardiovascular deconditioning blood pressure"
   - "astronaut sleep duration spaceflight"
   - "exercise countermeasures bone loss ISS"
   - "behavioral health long duration spaceflight"
2. Also search "NASA-STD-3001", NASA's spaceflight human health standard.
   It is the most likely single source for limits.
3. For each metric, write down the value, the document's title and report
   number, the page, and the link.
4. Put the value into `thresholds.json`, put the report number in `source`,
   and delete `"placeholder": true` from that line.
5. Add a row to the Thresholds table in `docs/sources.md`.

**If you can't find an exact limit** (likely for mood and exercise): use the
closest published guidance, and write honestly in `sources.md` what the
source says and what we assumed. A stated assumption is fine; an unexplained
number is not.

**Be careful with units.** A source may give radiation per year or for a
whole mission, while our reading is per day. Note the conversion you made.

**Check it works:** JSON is strict. A missing comma or quote breaks the
app. After every edit, restart the app and load the page. If it shows no
tiles, undo your last edit and look for the typo.

## Step 3: write real checklists

1. Open `data/protocols.json`. There is one checklist per health area.
2. For each, search NTRS and nasa.gov for what crews actually do:
   "solar particle event crew shelter procedure", "ISS exercise
   countermeasures", "astronaut sleep countermeasures", and so on.
3. Rewrite the steps. Each step should be one short action starting with a
   verb, something a tired person can follow. Aim for three to five steps.
4. Fill in `source` and remove `"placeholder": true`, then add a row to the
   Protocols table in `sources.md`.

**What this means:** the app's promise is "what do I do right now?". The
checklists are that answer, so they need to be both correct and short.

## Step 4: build the "Ask why" screen

1. In `ask.html`, show the current alert's title and protocol number at the
   top. Get them with `getState()` from `frontend/js/api.js`, the same way
   `frontend/js/home.js` does.
2. Add three or four ready-made question buttons, such as "Why this
   checklist?", "How serious is this?", "What happens if I wait?".
3. Add a box for the answer and, under it, "Based on protocol RAD-01" (or
   whichever applies), so the astronaut can see where the answer came from.
4. Until Fawaz's `/api/ask` exists, show a fixed example answer when a
   button is clicked. When it exists, add an `ask(question)` function to
   `api.js` (tell Mika, it is their file) and show the real answer.
5. If there is no alert, show "All readings are in your normal range."

Reuse the classes in `frontend/css/theme.css` so it matches the other screens.

**What this means:** a local AI model writes the explanation, but it is
only allowed to use the readings and the protocol text. Showing the
protocol next to the answer is how we prove it is not making things up.

## Step 5: the project page and demo

Start a draft early and fill it in as the app grows.

1. Write the project summary: the problem (astronauts can't wait for
   Earth), what the app does, and what is simulated.
2. List every dataset by its exact name and ID, in the "Datasets used"
   table in `sources.md`. Abel will give you the DONKI event details.
3. Write the demo script, about three minutes:
   1. Normal day: four green tiles, a ten-second check-in.
   2. Radiation event: tile turns red, checklist, summary sent to Earth.
   3. Heart drift: nothing is over a limit, but the trend shows the slide.
   4. Turn off the wifi: everything still works.
   5. The doctor's reply arrives after the delay.
4. Record the demo video once all of that works on `main`.
5. Check the Space Apps submission rules for what the project page must
   include and whether the repo needs a licence file.

## You are done when

- No line in `data/` says `"placeholder": true`.
- Every threshold and protocol has a row in `docs/sources.md`.
- "Ask why" shows an answer and the protocol it came from.
- The project page is submitted and the demo video is recorded.

## Who you depend on, and who depends on you

- Fawaz's rules read your two data files directly. If you rename a field
  (not a value), tell him first.
- Fawaz builds `/api/ask`; Abel supplies the DONKI event details.
- Everyone's work shows up in your demo, so ask each person what is ready
  before you record.
