// Home screen: "am I okay, and if not, what do I do?"
import { get, post } from "./api.js";
import { h, badge, topbar, speakButton, beep, messageNode, callForHelp, requireUser, MARK, STATUS } from "./common.js";
import { createOrganFigure } from "./organs.js";
import { drawChart } from "./chart.js";

await requireUser("astronaut");
topbar("index.html");
const app = document.getElementById("app");

const strip = h("div", { class: "row between", style: "margin-bottom:14px" });
const emergencyBox = h("section", { class: "card banner", hidden: true });
const alertBox = h("section", { class: "card banner", hidden: true });
const nudgeBox = h("div");
const figureBox = h("div");
const tiles = h("div", { class: "tiles" });
const missionBox = h("div");
const detail = h("section", { class: "card", hidden: true });
const todayBox = h("section", { class: "card" });
const messagesBox = h("div");
const demoBox = h("div", { class: "row", style: "margin-top:8px" });

app.append(
  strip, emergencyBox, alertBox, nudgeBox,
  h("div", { class: "grid-2" },
    h("section", { class: "card" },
      h("h2", {}, "Your body"),
      h("p", { class: "muted" }, "Tap an organ, or the dashed outline for radiation."),
      figureBox,
      h("div", { class: "legend" },
        h("span", {}, h("i", { style: "background:var(--ok-bg);border-color:var(--ok)" }), "Normal"),
        h("span", {}, h("i", { style: "background:var(--watch-bg);border-color:var(--watch)" }), "Monitor"),
        h("span", {}, h("i", { style: "background:var(--act-bg);border-color:var(--act)" }), "Act now"),
        h("span", {}, h("i", { style: "background:var(--neutral-bg);border-color:var(--muted)" }), "Tracked, not rated"))),
    h("div", {},
      h("section", { class: "card" }, h("h2", {}, "Vitals"), tiles),
      h("section", { class: "card", style: "margin-bottom:0" }, h("h2", {}, "Mission"), missionBox))),
  detail, todayBox,
  h("section", { class: "card" }, h("h2", {}, "Earth link"), messagesBox),
  h("section", { class: "card" },
    h("div", { class: "muted" }, "Demo controls (not part of the crew member's screen)"), demoBox),
);

const figure = createOrganFigure(figureBox, { onSelect: (area) => select({ area }) });

let state = null;
let indicators = {};
let selected = null;        // {area} or {metric}
let historyCache = {};
let shownAlert = null;
const openMessages = new Set();
let shownMessages = "";
const seenReplies = new Set();

function allReadings() {
  return [...state.vitals, state.radiation, state.exercise, state.mood];
}

function select(choice) {
  selected = choice;
  historyCache = {};
  render();
  if (choice) detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderStrip() {
  const p = state.profile;
  const overall = state.alert ? ["act", "Action needed"] : state.all_green ? ["ok", "All normal"] : ["watch", "Something to monitor"];
  strip.replaceChildren(
    h("div", {},
      h("strong", {}, state.user.full_name), p.role ? `, ${p.role}` : "",
      h("div", { class: "muted" }, `Mission day ${state.mission_day} · ${state.environment.label} · gravity ${state.environment.gravity_g} g`)),
    h("div", { class: "row" },
      h("span", { class: "chip" }, `Earth delay: ${state.environment.delay_label}`),
      h("span", { class: "chip" }, state.ai.available ? `Local AI: ${state.ai.model}` : "Local AI: not running"),
      h("span", { class: `badge ${overall[0]}` }, `${MARK[overall[0]]} ${overall[1]}`)));
}

function renderEmergency() {
  emergencyBox.hidden = !state.emergency;
  if (state.emergency) {
    emergencyBox.replaceChildren(
      h("h2", {}, "Emergency in progress"),
      h("p", {}, "The crew medical officer and Earth have been alerted."),
      h("a", { class: "button", href: "emergency.html" }, "Continue to your steps"));
  }
}

function renderAlert() {
  const alert = state.alert;
  alertBox.hidden = !alert;
  const signature = alert ? `${alert.protocol_id}:${state.ticks.join(",")}` : null;
  if (alert && !shownAlert?.startsWith(alert.protocol_id)) beep();
  if (signature === shownAlert) return;
  shownAlert = signature;
  if (!alert) return;

  const done = new Set(state.ticks);
  const boxes = [];
  const steps = alert.steps.map((step, index) => {
    const box = h("input", { type: "checkbox", checked: done.has(index) });
    box.addEventListener("change", async () => {
      await post("/api/steps", { protocol_id: alert.protocol_id, done: boxes.flatMap((b, i) => (b.checked ? [i] : [])) });
      refresh();
    });
    boxes.push(box);
    return h("li", {}, h("label", {}, box, h("span", {}, step)));
  });
  alertBox.replaceChildren(
    h("h2", {}, alert.title),
    h("p", {}, alert.why),
    h("div", { class: "muted" }, `What to do now · Protocol ${alert.protocol_id} · ${done.size} of ${alert.steps.length} steps done`),
    h("ul", { class: "steps" }, steps),
    state.nasa_event ? h("p", { class: "muted small" },
      `Demo scenario modelled on a real solar particle event logged by NASA DONKI on ${state.nasa_event.event_time.slice(0, 10)} (${state.nasa_event.id}). Dose values are simulated.`) : null,
    h("div", { class: "row" },
      speakButton(() => `${alert.title}. ${alert.steps.map((s, i) => `Step ${i + 1}. ${s}`).join(". ")}`, "Read steps aloud"),
      h("a", { class: "button", href: "ask.html" }, "Ask why"),
      h("button", { class: "help", onclick: callForHelp }, "I feel worse")));
}

// Gentle, private prompts for mood and exercise. Never red, never an alarm.
function renderNudges() {
  nudgeBox.replaceChildren(...state.nudges.map((nudge) =>
    h("section", { class: "card gentle" },
      h("p", { style: nudge.action || nudge.requested ? "" : "margin:0" }, nudge.text),
      nudge.requested ? h("p", { class: "muted", style: "margin:0" }, "Your request has been sent to the flight surgeon.") : null,
      nudge.action ? h("button", { onclick: async () => { await post("/api/nudge", { id: nudge.id }); refresh(); } }, nudge.action) : null)));
}

function renderFigure() {
  const statuses = Object.fromEntries(Object.entries(state.areas).map(([id, area]) => [id, area.status]));
  figure.paint(statuses, selected?.area);
  figure.markPain(state.pain.map((p) => p.region));
}

function renderTiles() {
  tiles.replaceChildren(...state.vitals.map((v) =>
    h("button", { class: `tile ${v.status} ${selected?.metric === v.metric ? "open" : ""}`,
      "aria-label": `${v.label}: ${v.value} ${v.unit}, ${STATUS[v.status]}`, onclick: () => select({ metric: v.metric }) },
      h("span", { class: "mark", "aria-hidden": "true" }, MARK[v.status]),
      h("div", { class: "name" }, v.label),
      h("div", { class: "number" }, String(v.value), h("span", { class: "unit" }, v.unit)))));
}

function renderMission() {
  const r = state.radiation, e = state.exercise, m = state.mood;
  missionBox.replaceChildren(
    // Radiation: always shown, separate from the vitals. It only becomes an alert in a solar storm.
    h("div", { class: "stat" },
      h("div", { class: "row between" },
        h("button", { class: "plain", style: "padding:0;min-height:0;border:0", onclick: () => select({ metric: "dose_rate" }) }, h("strong", {}, "Radiation")),
        r.status === "ok" ? h("span", { class: "muted small" }, "Background level") : badge(r.status)),
      h("div", {}, h("span", { class: "figure" }, `${r.value} `), h("span", { class: "muted" }, "mSv today")),
      h("div", { class: "bar", role: "img", "aria-label": `${r.percent_of_limit}% of the career limit` }, h("span", { style: `width:${Math.min(100, r.percent_of_limit)}%` })),
      h("div", { class: "muted small" }, `Mission total about ${r.mission_total} mSv, ${r.percent_of_limit}% of NASA's ${r.career_limit} mSv career limit`)),
    // Exercise: progress toward the plan, never red.
    h("div", { class: "stat" },
      h("div", { class: "row between" },
        h("button", { class: "plain", style: "padding:0;min-height:0;border:0", onclick: () => select({ metric: "exercise_pct" }) }, h("strong", {}, "Exercise this week")),
        h("span", { class: "muted small" }, e.streak_days ? `${e.streak_days}-day streak` : "Start a new streak today")),
      h("div", { class: "bar", role: "img", "aria-label": `${e.value}% of the weekly plan` }, h("span", { style: `width:${Math.min(100, e.value)}%` })),
      h("div", { class: "muted small" }, `${e.value}% of your plan done`)),
    // Mood: shown without colour, so it never adds pressure.
    h("div", { class: "stat" },
      h("div", { class: "row between" },
        h("button", { class: "plain", style: "padding:0;min-height:0;border:0", onclick: () => select({ metric: "mood" }) }, h("strong", {}, "Mood")),
        h("span", { class: "muted small" }, "Private to you and the flight surgeon")),
      h("div", { class: "row between" },
        h("div", {}, h("span", { class: "figure" }, `${m.value} `), h("span", { class: "muted" }, "of 5 today")),
        h("div", { class: "week", role: "img", "aria-label": `Mood over the last 7 days: ${m.week.join(", ")}` },
          m.week.map((v) => h("span", { style: `height:${6 + v * 5}px` }))))));
}

function renderDetail() {
  detail.hidden = !selected;
  if (!selected) return;
  const readings = allReadings().filter((r) => (selected.metric ? r.metric === selected.metric : r.area === selected.area));
  const heading = selected.metric ? readings[0].label : state.areas[selected.area].label;
  const blocks = readings.map((reading) => {
    const info = indicators[reading.metric] || {};
    const chartBox = h("div");
    historyCache[reading.metric] ??= get(`/api/history?metric=${reading.metric}`);
    historyCache[reading.metric].then((data) => drawChart(chartBox,
      { values: data.values, band: data.band, unit: data.unit, label: data.label, average: data.crew_average }));
    return h("div", { style: "border-top:1px solid var(--line);padding:12px 0" },
      h("div", { class: "row between" },
        h("div", {}, h("div", { class: "muted" }, reading.label, reading.source === "entered" ? " (entered by you)" : ""),
          h("div", { style: "font-size:24px;font-weight:700" }, `${reading.value} ${reading.unit}`)),
        badge(reading.status)),
      reading.note && !reading.quiet ? h("p", {}, reading.note) : null,
      chartBox,
      h("p", { class: "muted small" }, "Shaded band: your normal range. Dashed line: average of the simulated crew of 100."),
      h("p", { class: "muted" }, h("strong", {}, "What it is: "), info.what || ""),
      h("p", { class: "muted" }, h("strong", {}, "Why it matters in space: "), info.space || ""),
      h("p", { class: "muted" }, h("strong", {}, "How it is measured: "), info.how || ""));
  });
  detail.replaceChildren(
    h("div", { class: "row between" }, h("h2", { style: "margin:0" }, heading),
      h("div", { class: "row" }, h("a", { class: "button", href: "trends.html" }, "All trends"),
        h("button", { onclick: () => select(null) }, "Close"))),
    ...blocks);
}

function renderToday() {
  const c = state.checkin;
  const finished = c.done.length === c.total;
  todayBox.replaceChildren(
    h("div", { class: "row between" },
      h("div", {}, h("h2", { style: "margin:0" }, "Daily check-in"),
        h("div", { class: "muted" }, finished
          ? (c.sent ? "All done. Today's report has been sent to the flight surgeon." : "All done.")
          : `${c.done.length} of ${c.total} assessments done today`)),
      h("a", { class: "button", href: "checkin.html" }, finished ? "Review" : "Continue")),
    h("div", { class: "bar", role: "img", "aria-label": `${c.done.length} of ${c.total} done` },
      h("span", { style: `width:${(100 * c.done.length) / c.total}%` })));
}

function renderMessages() {
  if (state.messages.length === 0) {
    shownMessages = "";
    messagesBox.replaceChildren(h("p", { class: "muted", style: "margin:0" },
      "Nothing sent yet. Finishing the daily check-in sends a report to the flight surgeon, and alerts are sent automatically."));
    return;
  }
  for (const m of state.messages) {  // replies and reviewed reports open the first time they appear
    const fresh = m.from === "earth" || m.feedback;
    if (fresh && !seenReplies.has(`${m.id}:${m.report_status}`)) { seenReplies.add(`${m.id}:${m.report_status}`); openMessages.add(m.id); }
  }
  const signature = JSON.stringify(state.messages);
  if (signature === shownMessages) return;   // redraw only when something changed
  shownMessages = signature;
  messagesBox.replaceChildren(...state.messages.map((m) => messageNode(m, openMessages)));
}

function renderDemo() {
  demoBox.replaceChildren(
    ...Object.entries(state.scenarios).map(([name, label]) =>
      h("button", { class: name === state.scenario ? "selected" : "", onclick: async () => { await post("/api/scenario", { name }); historyCache = {}; refresh(); } }, label)),
    h("button", { onclick: async () => { await post("/api/reset"); historyCache = {}; shownAlert = null; refresh(); } }, "Reset demo"),
    h("a", { class: "button", href: "login.html", target: "_blank" }, "Open another sign-in (doctor)"));
}

function render() {
  renderStrip();
  renderEmergency();
  renderAlert();
  renderNudges();
  renderFigure();
  renderTiles();
  renderMission();
  renderDetail();
  renderToday();
  renderMessages();
  renderDemo();
}

async function refresh() {
  state = await get("/api/state");
  render();
}

indicators = await get("/api/indicators");
await refresh();
setInterval(refresh, 2000);
