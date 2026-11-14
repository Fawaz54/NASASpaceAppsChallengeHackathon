# Srijana: check-in, body map and trends (frontend)

Read [getting-started.md](getting-started.md) first.

## Your job in one sentence

You build the screens where the astronaut tells the app how they feel
(including tapping where it hurts on a body figure) and where they see how a
reading has changed over time.

## Your files

| File | What it is |
|---|---|
| `frontend/checkin.html` | The daily check-in screen. Placeholder only. |
| `frontend/js/checkin.js` | The check-in's behaviour. To do. |
| `frontend/js/bodymap.js` | The tappable body figure. Has the region names; the rest is to do. |
| `frontend/trend.html` | The trend screen. Placeholder only. |
| `frontend/js/trend.js` | The trend chart. To do. |

## Step 1: understand what is there

1. Start the app and open http://localhost:8000/checkin.html. It is a
   placeholder card.
2. Look at `frontend/index.html` and `frontend/js/home.js` (Mika's) to see
   how a finished screen is put together: the HTML has empty boxes with
   `id`s, and the JS fills them.
3. Open `frontend/css/theme.css`. Reuse its classes (`card`, `row`, `muted`,
   buttons) so your screens match the home screen.

## Step 2: build the check-in

The whole check-in should take about ten seconds and need no typing,
because the astronaut may be unwell.

1. In `checkin.html`, add two questions: "Mood" and "Sleep quality".
2. Under each, add five buttons labelled 1 to 5.
3. In `checkin.js`, when a button is clicked, remember the number and
   highlight that button (and un-highlight the others in its row).
4. Add a "Save check-in" button. If mood or sleep has not been chosen, show
   a short message next to it and do not save.

**What this means:** these two scores are how the app tracks behavioral
health, one of the four risks in the challenge. A single low day means
little; a week of falling scores is what the rules look for.

## Step 3: build the body map

This lets the astronaut tap where it hurts instead of describing it.

1. In `bodymap.js`, fill in `createBodyMap(container)`. Draw two simple
   figures side by side with SVG, labelled "Front" and "Back": a circle for
   the head and rounded rectangles for the rest.
2. Use exactly the ten region names in `REGIONS` (they are also in
   [contract.md](contract.md)). The front figure has Chest and Abdomen where
   the back figure has Upper back and Lower back. On the back figure, left
   and right are swapped on screen, as in a mirror.
3. When a region is tapped, toggle it: colour it in and add it to a list
   beside the figure; tap again to remove it.
4. For each marked region, show a slider from 1 to 10 for how bad it is.
5. Make the function return a way to read the result, as a list like
   `[{"region": "Lower back", "severity": 6}]`.
6. In `checkin.js`, show the body map under the two questions.

**What this means:** SVG is a way to draw shapes in a web page with tags
such as `<circle>` and `<rect>`. Each shape can be clicked like a button.
Keep the figure flat and simple; a rotating 3D body would take the whole
hackathon and the rules could not use the extra detail.

**Check it works:** tap Head on the front figure. Head on the back figure
should highlight too, since it is the same region.

## Step 4: send the check-in to the backend

1. In `frontend/js/api.js`, add a function `sendCheckin(data)` that sends a
   POST to `/api/checkin` (copy the pattern of `setScenario` in that file;
   tell Mika you are adding it, since it is their file).
2. Call it from the "Save check-in" button with
   `{mood, sleep_quality, pain}`, as described in the contract.
3. Until Fawaz's endpoint exists, also `console.log` the data so you can
   see it is right (open the browser's developer tools, Console tab).
4. After saving, show "Check-in saved" and a link back to Home.

**Check it works:** once Fawaz's endpoint is in, save a check-in with mood
1 and go to Home. The Mind and sleep tile should be red.

## Step 5: build the trend screen

1. In `trend.html`, add a row of buttons to choose a metric: heart rate,
   blood pressure, sleep, mood, exercise, dose rate.
2. In `trend.js`, draw the last 30 days of the chosen metric as a line,
   with a shaded band for that person's normal range.
3. Abel is building the real 30-day history. Until it is ready, make up 30
   values in `trend.js` so you can build the chart now, then swap in the
   real data.

**What this means:** this is where a slow drift becomes visible. In the
heart scenario, no single day looks alarming, but the line creeping out of
the band over a week does.

## You are done when

- A check-in can be completed with taps only and reaches the backend.
- The body map marks regions on both figures and records a severity for each.
- The trend screen shows 30 days against the normal band for any metric.

## Who you depend on, and who depends on you

- Mika owns `theme.css` and `api.js`. Ask before changing either.
- Fawaz builds `/api/checkin`; Abel builds the history your trend chart needs.
- Mehek's protocols may use your body regions, so keep the region names exact.
