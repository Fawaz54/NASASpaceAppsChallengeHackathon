# Getting started (everyone reads this first)

## What we are building

An app an astronaut opens to answer two questions: "am I okay?" and "if not,
what do I do right now?". It watches four health areas the challenge names
(radiation, heart, bone and muscle, mind and sleep), turns a tile red when
something is wrong, and shows a step-by-step checklist. It works with no
internet, because on a Mars mission a message to Earth takes up to about
20 minutes each way.

All crew data is simulated. That is expected: real astronaut records are private.

## How the pieces connect

```
simulator  ->  rules  ->  /api/state  ->  crew screens
fake readings  ok/watch/act   one JSON     body figure, checklist,
               + checklist    message      check-in, emergency

crew screens  <->  Earth link (with delay)  <->  doctor screen
```

The limits, checklists and explanations the rules use live in `data/` as
plain JSON files, so they can be edited without programming.

## One-time setup

1. Install [Git](https://git-scm.com/downloads) and [Python 3](https://www.python.org/downloads/) if you don't have them.
2. Accept the GitHub invitation to the repo (check your email or GitHub notifications).
3. Download the project. In a terminal:

   ```bash
   git clone https://github.com/Fawaz54/NASASpaceAppsChallengeHackathon.git
   ```

   ```bash
   cd NASASpaceAppsChallengeHackathon
   ```

4. Start the app:

   ```bash
   python3 backend/main.py
   ```

   On Windows the command may be `python backend/main.py`.

5. Open http://localhost:8000 in your browser. The first time, it asks you
   to set up a profile. After that you see the home screen: a body figure
   and five health areas. Click "Solar particle event" at the bottom: within
   a few seconds the Radiation area turns red and a checklist appears.

`localhost` means "this computer". Each person runs their own copy; nobody
else can see yours. Always open the app through that address, not by
double-clicking the HTML file, or the page's scripts will not load.

To stop the app, press Ctrl+C in the terminal. After you change a Python
file, stop and start it again. After you change an HTML, CSS or JS file,
just refresh the browser.

## How to save and share your work

Git keeps everyone's work separate until it is ready to combine.

1. Before you start a piece of work, get the latest version and make your own branch.
   A branch is your private copy of the project to change safely.

   ```bash
   git checkout main
   ```

   ```bash
   git pull
   ```

   ```bash
   git checkout -b yourname-what-you-are-doing
   ```

2. Do the work. Check it runs.
3. Save it (a "commit" is a saved snapshot with a message):

   ```bash
   git add .
   ```

   ```bash
   git commit -m "Short description of what you did"
   ```

4. Upload your branch:

   ```bash
   git push -u origin yourname-what-you-are-doing
   ```

5. On GitHub, open a "pull request" for your branch. That is a request to
   combine your branch into `main`, the shared version. Ask one teammate to
   look at it, then press Merge.

Do this several times a day in small pieces. Small merges rarely clash; one
giant merge at the end usually does.

## Team rules

- `main` must always run. Test before you merge.
- `docs/contract.md` describes the data passed between backend and frontend.
  If you change one side, change the other in the same pull request.
- Never commit anything from `private/` (profile and smartwatch data).

## Words you will see

| Word | Meaning |
|---|---|
| Backend | The Python program that produces the data |
| Frontend | The web page the astronaut sees |
| JSON | A text format for data, like `{"metric": "heart_rate", "value": 62}` |
| Endpoint | An address the page asks for data, like `/api/state` |
| Reading | One measurement: a time, a metric name, a value and a unit |
| Baseline | What is normal for this particular person |
| Threshold | The value at which a reading counts as a problem |
| Status | `ok` (green), `watch` (amber) or `act` (red) |
| Protocol | A named checklist of steps, such as RAD-01 |
| Scenario | A scripted problem we switch on for the demo |

## Where to go next

- [contract.md](contract.md): every endpoint and data shape
- [demo.md](demo.md): the demo script
- [sources.md](sources.md): what still needs a NASA source
