# Mika: home screen and shared styles (frontend)

Read [getting-started.md](getting-started.md) first.

## Your job in one sentence

You build the first screen the astronaut sees, and the shared look that
Srijana's and Mehek's screens reuse.

## Your files

| File | What it is |
|---|---|
| `frontend/index.html` | The home screen's structure. Works, but plain. |
| `frontend/js/home.js` | Fills the home screen with data and refreshes it every 3 seconds. |
| `frontend/css/theme.css` | Colours, cards and buttons shared by every screen. |
| `frontend/js/api.js` | The functions that fetch data from the backend. |

## Step 1: understand what is there

1. Start the app, open http://localhost:8000 and click the scenario buttons.
2. Open http://localhost:8000/api/state in another tab. That is the data
   your screen draws. Its shape is explained in [contract.md](contract.md).
3. In `home.js`, read `render(state)`. Each block takes one part of that
   data and puts it on the page:
   - `state.areas` becomes the four tiles
   - `state.alert` becomes the red banner and the checklist
   - `state.earth_link` becomes the bar about the doctor's reply
4. Change a colour in `theme.css` and refresh to see it apply.

**What this means:** the page never decides what is wrong. It only shows
what the backend sends. If a tile is the wrong colour, the data is wrong
(ask Fawaz), not your code.

## Step 2: settle the shared look first

Do this early, because the other two are waiting on it.

1. In `theme.css`, decide the colours at the top (`--bg`, `--card`, `--ok`,
   `--watch`, `--act` and so on), the font and the card style.
2. Keep one rule: green, amber and red are used only for status. Nothing
   decorative uses those three colours, so a red tile can't be missed.
3. Make buttons and anything tappable at least 44 pixels tall.
4. Tell Srijana and Mehek which classes exist (`card`, `row`, `muted`,
   `tiles`, `tile`, `badge`) so they reuse them instead of inventing new ones.

**What this means:** the names starting with `--` are CSS variables. You
set a colour once at the top and use it everywhere with `var(--act)`, so
changing the look later is a one-line edit.

## Step 3: make the home screen match the mockup

Ask Fawaz for the mockup pictures. In order of importance:

1. Top bar: crew name and mission day on the left; "Running offline" and
   the Earth delay on the right.
2. Tiles: add an icon to each, make the main number large, and keep the
   status word under it. The tile that needs action should stand out most.
3. Banner: only visible when there is an alert, directly above the tiles.
4. Checklist card and chart card side by side on wide screens, stacked on
   narrow ones.
5. Move the "Demo controls" card to the very bottom and make it look
   clearly separate, since it is for us, not the astronaut.

**Check it works:** narrow the browser window to phone width. Nothing
should overflow sideways.

## Step 4: add the chart

1. Add a card that draws the alerting reading over time as a line.
2. Draw a shaded band behind it for the normal range, so it is obvious when
   the line leaves the band.
3. Start simple: an SVG `<polyline>` with about 12 points is enough. Until
   Abel's history is ready, keep the last few values you received in an
   array in `home.js` and draw those.

**What this means:** the chart answers "since when, and how fast?". A line
leaving a shaded band is understood in a second, without reading numbers.

## Step 5: make the checklist and buttons work properly

1. Ticks already survive the 3-second refresh. Make them survive a page
   reload too, by saving them with `localStorage`.
2. Show progress, such as "Step 2 of 4".
3. When Fawaz adds the doctor's reply to the state, show it in the Earth
   link bar, with the countdown before it arrives.
4. "Ask why" goes to Mehek's screen and "I feel unwell" to Srijana's.
   These links already exist; check they still work after your restyle.

## You are done when

- The home screen looks like the mockup at laptop and phone width.
- All three scenarios show the right tile, banner, checklist and chart.
- Srijana's and Mehek's screens use your `theme.css` without extra colours.

## Who you depend on, and who depends on you

- Fawaz's `/api/state` feeds your screen. If the backend is down, the page
  falls back to the example in `frontend/mock/state.json`.
- Srijana and Mehek depend on your `theme.css`. Tell them before renaming a class.
