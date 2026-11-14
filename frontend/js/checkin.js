// Daily check-in: mood, sleep, today's measurements and where anything hurts.
// Saving it sends the daily report to the flight surgeon.
import { get, post } from "./api.js";
import { h, topbar } from "./common.js";
import { createBodyMap } from "./bodymap.js";

topbar("checkin.html");
const app = document.getElementById("app");
const [state, indicators] = await Promise.all([get("/api/state"), get("/api/indicators")]);
if (!state.profile) location.href = "profile.html";

const answers = { mood: null, sleep_hours: state.profile.sleep_hours || 7, pain: {} };

// ----- mood -----
const moodButtons = [1, 2, 3, 4, 5].map((n) =>
  h("button", { type: "button", style: "flex:1", "aria-label": `Mood ${n} of 5`, onclick: () => {
    answers.mood = n;
    moodButtons.forEach((b, i) => b.classList.toggle("selected", i + 1 === n));
    error.textContent = "";
  } }, String(n)));

// ----- sleep -----
const sleepValue = h("strong", { style: "min-width:64px;text-align:center;font-size:20px" });
function showSleep() { sleepValue.textContent = `${answers.sleep_hours} h`; }
function stepSleep(change) { answers.sleep_hours = Math.min(14, Math.max(0, Math.round((answers.sleep_hours + change) * 2) / 2)); showSleep(); }
showSleep();

// ----- measurements (optional) -----
const MEASUREMENTS = [["systolic_bp", "mmHg", "118"], ["blood_sugar", "mg/dL", "92"], ["body_temp", "°C", "36.8"]];
const measureInputs = {};
const measurementFields = MEASUREMENTS.map(([metric, unit, hint]) => {
  const input = h("input", { id: metric, type: "number", step: "any", inputmode: "decimal", placeholder: hint });
  measureInputs[metric] = input;
  return h("div", {},
    h("label", { for: metric }, `${indicators[metric].label} (${unit})`), input,
    h("div", { class: "muted small", style: "margin-top:4px" }, indicators[metric].how));
});

// ----- body map -----
const figureBox = h("div");
const painList = h("div");
const figure = createBodyMap(figureBox, { onTap: (region) => {
  if (region in answers.pain) delete answers.pain[region]; else answers.pain[region] = 5;
  showPain();
} });
function showPain() {
  figure.paint(Object.fromEntries(Object.keys(answers.pain).map((region) => [region, "picked"])));
  const rows = Object.keys(answers.pain).map((region) => {
    const out = h("strong", { style: "min-width:28px;text-align:right" }, String(answers.pain[region]));
    const slider = h("input", { type: "range", min: "1", max: "10", step: "1", value: String(answers.pain[region]), "aria-label": `${region} pain from 1 to 10`, style: "flex:1" });
    slider.addEventListener("input", () => { answers.pain[region] = Number(slider.value); out.textContent = slider.value; });
    return h("div", { class: "row", style: "padding:4px 0" }, h("span", { style: "flex:0 0 100px" }, region), slider, out);
  });
  painList.replaceChildren(...(rows.length ? [h("div", { class: "muted" }, "How bad is it, from 1 to 10?"), ...rows]
    : [h("p", { class: "muted" }, "Nothing marked. Skip this if nothing hurts.")]));
}
showPain();

const notes = h("textarea", { id: "notes", placeholder: "Anything else the flight surgeon should know (optional)" });
const error = h("p", { class: "error" });
const form = h("div");

async function save() {
  if (!answers.mood) { error.textContent = "Choose a mood from 1 to 5 before saving."; return; }
  const measurements = {};
  for (const [metric, input] of Object.entries(measureInputs)) {
    if (input.value !== "") measurements[metric] = Number(input.value);
  }
  const result = await post("/api/checkin", {
    mood: answers.mood, sleep_hours: answers.sleep_hours, measurements, notes: notes.value,
    pain: Object.entries(answers.pain).map(([region, severity]) => ({ region, severity })),
  });
  form.replaceChildren(h("section", { class: `card banner ${result.all_clear ? "calm" : ""}`, style: result.all_clear ? "border-color:var(--ok);background:var(--ok-bg)" : "" },
    h("h2", { style: result.all_clear ? "color:var(--ok)" : "" }, "Check-in saved"),
    h("p", {}, result.all_clear
      ? "Everything is in range. Your daily report is on its way to Earth and will be acknowledged automatically."
      : "Something needs a look. Your daily report is on its way to the flight surgeon, who will reply."),
    h("p", { class: "muted" }, `Signal delay: ${state.environment.delay_label}.`),
    h("a", { class: "button", href: "index.html" }, "Back to home")));
  window.scrollTo({ top: 0 });
}

form.append(
  h("section", { class: "card" }, h("h2", {}, "How is your mood today?"),
    h("div", { class: "muted" }, "1 is very low, 5 is very good."),
    h("div", { class: "row", style: "margin-top:8px" }, moodButtons)),
  h("section", { class: "card" }, h("h2", {}, "How long did you sleep?"),
    h("div", { class: "row" },
      h("button", { type: "button", "aria-label": "Half an hour less", onclick: () => stepSleep(-0.5) }, "−"),
      sleepValue,
      h("button", { type: "button", "aria-label": "Half an hour more", onclick: () => stepSleep(0.5) }, "+"))),
  h("section", { class: "card" }, h("h2", {}, "Today's measurements"),
    h("p", { class: "muted" }, "Enter the ones you have taken. Leave the rest empty."),
    h("div", { class: "fields" }, measurementFields)),
  h("section", { class: "card" }, h("h2", {}, "Does anything hurt?"),
    h("p", { class: "muted" }, "Tap where it hurts. Tap again to remove it."),
    h("div", { class: "grid-2", style: "margin:0" }, figureBox, painList)),
  h("section", { class: "card" }, h("label", { for: "notes" }, "Notes"), notes),
  error,
  h("button", { class: "primary", type: "button", onclick: save }, "Save and send daily report"),
);
app.append(h("h1", {}, "Daily check-in"), form);
