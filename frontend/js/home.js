// Home screen: "am I okay, and if not, what do I do?"
import { get, post } from "./api.js";
import { h, badge, topbar, speakButton, beep, messageNode, callForHelp } from "./common.js";
import { createBodyMap } from "./bodymap.js";
import { drawChart } from "./chart.js";

// Which body parts stand for which health area on the figure.
const AREA_REGIONS = {
  mind: ["Head"],
  heart: ["Chest"],
  general: ["Abdomen", "Neck"],
  bone: ["Upper back", "Lower back", "Left arm", "Right arm", "Left leg", "Right leg"],
  radiation: [],
};
const REGION_AREA = Object.fromEntries(
  Object.entries(AREA_REGIONS).flatMap(([area, regions]) => regions.map((region) => [region, area])));

topbar("index.html");
const app = document.getElementById("app");

const strip = h("div", { class: "row between", style: "margin-bottom:14px" });
const emergencyBox = h("section", { class: "card banner", hidden: true });
const alertBox = h("section", { class: "card banner", hidden: true });
const figureBox = h("div");
const areaList = h("div");
const detail = h("section", { class: "card" });
const remindersBox = h("section", { class: "card", hidden: true });
const messagesBox = h("div");
const demoBox = h("div", { class: "row", style: "margin-top:8px" });

app.append(
  strip, emergencyBox, alertBox,
  h("div", { class: "grid-2" },
    h("section", { class: "card" },
      h("h2", {}, "Your body"),
      h("p", { class: "muted" }, "Tap a body part or the dashed outline to see what it shows."),
      figureBox),
    h("section", { class: "card" }, h("h2", {}, "Health areas"), areaList)),
  detail, remindersBox,
  h("section", { class: "card" }, h("h2", {}, "Earth link"), messagesBox),
  h("section", { class: "card" },
    h("div", { class: "muted" }, "Demo controls (not part of the crew member's screen)"),
    demoBox),
);

const figure = createBodyMap(figureBox, { aura: true, onTap: (region) => select(REGION_AREA[region]), onAura: () => select("radiation") });

let state = null;
let indicators = {};
let selected = null;
let historyCache = {};
let shownAlert = null;
const openMessages = new Set();

function select(area) {
  selected = area;
  historyCache = {};
  render();
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderStrip() {
  const p = state.profile;
  strip.replaceChildren(
    h("div", {},
      h("strong", {}, p.name || "Crew member"), p.role ? `, ${p.role}` : "",
      h("div", { class: "muted" }, `Mission day ${state.mission_day} · ${state.environment.label}`)),
    h("div", { class: "row" },
      h("span", { class: "chip" }, `Earth delay: ${state.environment.delay_label}`),
      h("span", { class: "chip" }, state.ai.available ? `Local AI: ${state.ai.model}` : "Local AI: not running"),
      h("span", { class: `badge ${state.all_green ? "ok" : state.alert ? "act" : "watch"}` },
        state.all_green ? "All normal" : state.alert ? "Action needed" : "Something to watch")),
  );
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
      const ticked = boxes.flatMap((b, i) => (b.checked ? [i] : []));
      await post("/api/steps", { protocol_id: alert.protocol_id, done: ticked });
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
      h("button", { class: "help", onclick: callForHelp }, "I feel worse")),
  );
}

function renderFigure() {
  const classes = {};
  for (const area of state.areas) {
    for (const region of AREA_REGIONS[area.id]) classes[region] = area.status;
  }
  figure.paint(classes);
  figure.setAura(state.areas.find((a) => a.id === "radiation").status);
  figure.focus(selected ? AREA_REGIONS[selected] : []);
  figure.markPain(state.pain.map((p) => p.region));
}

function renderAreas() {
  areaList.replaceChildren(...state.areas.map((area) =>
    h("button", { class: `area ${area.status} ${area.id === selected ? "open" : ""}`, onclick: () => select(area.id) },
      h("span", {}, h("strong", {}, area.label),
        h("div", { class: "muted small" }, area.note || area.metrics.map((m) => `${m.value} ${m.unit}`).join(" · "))),
      badge(area.status))));
}

async function renderDetail() {
  if (!selected) {
    detail.replaceChildren(h("p", { class: "muted", style: "margin:0" }, "Select a health area above to see its readings, what they mean and how they have changed."));
    return;
  }
  const area = state.areas.find((a) => a.id === selected);
  const blocks = [];
  for (const metric of area.metrics) {
    const info = indicators[metric.metric] || {};
    const chartBox = h("div");
    blocks.push(h("div", { class: "metric" },
      h("div", { class: "row between" },
        h("div", {}, h("div", { class: "muted" }, metric.label, metric.source === "entered" ? " (entered by you)" : ""),
          h("div", { class: "value" }, `${metric.value} ${metric.unit}`)),
        badge(metric.status)),
      metric.note ? h("p", {}, metric.note) : null,
      chartBox,
      h("p", { class: "muted" }, h("strong", {}, "What it is: "), info.what || ""),
      h("p", { class: "muted" }, h("strong", {}, "Why it matters in space: "), info.space || ""),
      h("p", { class: "muted" }, h("strong", {}, "How it is measured: "), info.how || ""),
    ));
    historyCache[metric.metric] ??= get(`/api/history?metric=${metric.metric}`);
    historyCache[metric.metric].then((data) => drawChart(chartBox, data.values, data.band, data.unit));
  }
  detail.replaceChildren(
    h("div", { class: "row between" }, h("h2", { style: "margin:0" }, area.label),
      h("div", { class: "row" }, badge(area.status), h("a", { class: "button", href: "trends.html" }, "All trends"))),
    ...blocks);
}

function renderReminders() {
  remindersBox.hidden = state.reminders.length === 0;
  remindersBox.replaceChildren(h("h2", {}, "Today"),
    ...state.reminders.map((r) => h("div", { class: "row between", style: "padding:4px 0" },
      h("span", {}, r.text), h("a", { class: "button", href: r.href }, "Do it now"))));
}

function renderMessages() {
  if (state.messages.length === 0) {
    messagesBox.replaceChildren(h("p", { class: "muted", style: "margin:0" },
      "Nothing sent yet. Your daily check-in sends a report to the flight surgeon, and alerts are sent automatically."));
    return;
  }
  // Replies from Earth open by default the first time they appear.
  for (const m of state.messages) {
    if (m.from === "earth" && !renderMessages.seen.has(m.id)) { renderMessages.seen.add(m.id); openMessages.add(m.id); }
  }
  messagesBox.replaceChildren(...state.messages.map((m) => messageNode(m, "ship", openMessages)));
}
renderMessages.seen = new Set();

function renderDemo() {
  demoBox.replaceChildren(
    ...Object.entries(state.scenarios).map(([name, label]) =>
      h("button", { class: name === state.scenario ? "selected" : "", onclick: async () => { await post("/api/scenario", { name }); historyCache = {}; refresh(); } }, label)),
    h("button", { onclick: async () => { await post("/api/reset"); historyCache = {}; shownAlert = null; refresh(); } }, "Reset demo"),
    h("a", { class: "button", href: "doctor.html", target: "_blank" }, "Open doctor screen"));
}

function render() {
  renderStrip();
  renderEmergency();
  renderAlert();
  renderFigure();
  renderAreas();
  renderDetail();
  renderReminders();
  renderMessages();
  renderDemo();
}

async function refresh() {
  state = await get("/api/state");
  if (!state.profile) { location.href = "profile.html"; return; }
  render();
}

indicators = await get("/api/indicators");
await refresh();
setInterval(refresh, 2000);
