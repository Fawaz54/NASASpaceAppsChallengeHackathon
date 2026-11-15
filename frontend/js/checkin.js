// Daily check-in: several short assessments. Each one is a task; when all are
// done the day's report goes to the flight surgeon. The questions come from
// the backend (ASSESSMENTS in backend/main.py), so this file only draws them.
import { get, post } from "./api.js";
import { h, topbar, requireUser, numberField } from "./common.js";
import { createBodyMap } from "./bodymap.js";

await requireUser("astronaut");
topbar("checkin.html");
const app = document.getElementById("app");
let info = await get("/api/assessments");

// Each builder returns {node, read}. read() gives the answer, null if left
// empty, or undefined if it is invalid (the field shows why).
const BUILD = {
  number(item, saved) {
    return numberField({ id: item.key, label: item.label, unit: item.unit, min: item.min, max: item.max, value: saved });
  },
  scale(item, saved) {
    let value = saved ?? null;
    const buttons = [];
    for (let n = item.min; n <= item.max; n += 1) {
      buttons.push(h("button", { type: "button", class: n === value ? "selected" : "", style: "flex:1", "aria-label": `${n} of ${item.max}`,
        onclick: () => { value = n; buttons.forEach((b, i) => b.classList.toggle("selected", i + item.min === n)); } }, String(n)));
    }
    return { node: h("div", {}, h("div", {}, item.label), item.hint ? h("div", { class: "muted" }, item.hint) : null,
      h("div", { class: "row", style: "margin-top:8px" }, buttons)), read: () => value };
  },
  stepper(item, saved) {
    let value = saved ?? info.defaults[item.key] ?? item.min;
    const shown = h("strong", { style: "min-width:72px;text-align:center;font-size:20px" });
    const show = () => { shown.textContent = `${value} ${item.unit}`; };
    const move = (change) => { value = Math.min(item.max, Math.max(item.min, Math.round((value + change) / item.step) * item.step)); show(); };
    show();
    return { node: h("div", {}, h("div", {}, item.label),
      h("div", { class: "row", style: "margin-top:8px" },
        h("button", { type: "button", "aria-label": "Less", onclick: () => move(-item.step) }, "−"), shown,
        h("button", { type: "button", "aria-label": "More", onclick: () => move(item.step) }, "+"))), read: () => value };
  },
  choice(item, saved, choices = item.choices) {
    let value = saved ?? null;
    const buttons = choices.map((choice) => h("button", { type: "button", class: choice === value ? "selected" : "",
      onclick: () => { value = choice; buttons.forEach((b) => b.classList.toggle("selected", b.textContent === choice)); } }, choice));
    return { node: h("div", {}, h("div", {}, item.label), h("div", { class: "row", style: "margin-top:8px" }, buttons)), read: () => value };
  },
  yesno(item, saved) {
    return BUILD.choice(item, saved ?? "No", ["No", "Yes"]);
  },
  bodymap(item, saved) {
    const pain = Object.fromEntries((saved || []).map((p) => [p.region, p.severity]));
    const figureBox = h("div");
    const list = h("div");
    const figure = createBodyMap(figureBox, { onTap: (region) => { region in pain ? delete pain[region] : (pain[region] = 5); show(); } });
    function show() {
      figure.paint(Object.fromEntries(Object.keys(pain).map((region) => [region, "picked"])));
      const rows = Object.keys(pain).map((region) => {
        const out = h("strong", { style: "min-width:28px;text-align:right" }, String(pain[region]));
        const slider = h("input", { type: "range", min: "1", max: "10", step: "1", value: String(pain[region]), "aria-label": `${region} pain level from 1 to 10`, style: "flex:1" });
        slider.addEventListener("input", () => { pain[region] = Number(slider.value); out.textContent = slider.value; });
        return h("div", { class: "row", style: "padding:4px 0" }, h("span", { style: "flex:0 0 100px" }, region), slider, out);
      });
      list.replaceChildren(...(rows.length
        ? [h("div", { class: "muted" }, "Pain level for each area, from 1 (mild) to 10 (worst imaginable)"), ...rows]
        : [h("p", { class: "muted" }, "Nothing marked.")]));
    }
    show();
    return { node: h("div", {}, h("div", {}, item.label), h("div", { class: "grid-2", style: "margin:8px 0 0" }, figureBox, list)),
      read: () => Object.entries(pain).map(([region, severity]) => ({ region, severity })) };
  },
};

function list(notice) {
  const total = info.assessments.length;
  const done = Object.keys(info.done).length;
  app.replaceChildren(
    h("h1", {}, "Daily check-in"),
    notice || null,
    h("p", { class: "muted" }, done === total
      ? "All assessments are done for today. You can open one to change an answer."
      : `${done} of ${total} done. When all are done, today's report is sent to the flight surgeon.`),
    ...info.assessments.map((a) => {
      const finished = a.id in info.done;
      return h("button", { class: `task ${finished ? "done" : ""}`, onclick: () => form(a) },
        h("span", {}, h("strong", {}, a.title), h("div", { class: "muted small" }, `${a.items.length} ${a.items.length === 1 ? "item" : "items"}`)),
        h("span", { class: `badge ${finished ? "neutral" : "ok"}` }, finished ? "✓ Done" : "To do"));
    }),
    h("a", { class: "button", href: "index.html" }, "Back to home"));
}

function form(assessment) {
  const saved = info.done[assessment.id] || {};
  const fields = assessment.items.map((item) => [item, BUILD[item.type](item, saved[item.key])]);
  const error = h("p", { class: "error" });
  async function save() {
    const data = {};
    for (const [item, field] of fields) {
      const value = field.read();
      if (value === undefined) return;
      data[item.key] = value;
    }
    const result = await post("/api/assessment", { id: assessment.id, data });
    if (result.error) { error.textContent = result.error; return; }
    info = await get("/api/assessments");
    list(result.report_sent ? h("section", { class: "card good" },
      h("h2", {}, "Report sent"),
      h("p", { style: "margin:0" }, result.all_clear
        ? "Everything is in range. Your report is on its way to Earth and will be acknowledged automatically."
        : "Your report is on its way to the flight surgeon, who will reply with feedback. You will see it under Earth link on the home screen.")) : null);
    window.scrollTo({ top: 0 });
  }
  app.replaceChildren(
    h("h1", {}, assessment.title),
    h("p", { class: "muted" }, assessment.intro),
    h("section", { class: "card" }, fields.map(([, field]) => h("div", { class: "question" }, field.node))),
    error,
    h("div", { class: "row" }, h("button", { class: "primary", onclick: save }, "Save"), h("button", { onclick: () => list() }, "Back")));
  window.scrollTo({ top: 0 });
}

list();
