// Flight surgeon console (the Earth side of the demo). It only shows what
// has had time to travel from the crew, and replies take the same delay back.
import { get, post } from "./api.js";
import { h } from "./common.js";

const app = document.getElementById("app");
const crewBox = h("section", { class: "card" });
const inbox = h("div");
const reply = h("textarea", { id: "reply", placeholder: "Write feedback or instructions for the crew member" });
const error = h("p", { class: "error" });
const sentNote = h("p", { class: "muted" });
const open = new Set();
const seen = new Set();

const QUICK = [
  "Report reviewed. Agree with the checklist shown. Continue and report any change.",
  "Readings reviewed. Nothing of concern. Keep up the exercise plan.",
  "Please repeat the measurement in one hour and send the result.",
];

async function send() {
  if (!reply.value.trim()) { error.textContent = "Write a reply first."; return; }
  error.textContent = "";
  await post("/api/doctor/reply", { text: reply.value });
  reply.value = "";
  refresh();
}

function message(m) {
  const fromCrew = m.from === "ship";
  const status = fromCrew ? "Received" : (m.arrived ? "Delivered to crew" : `In transit · reaches crew in ${m.eta_seconds} s (${m.eta_real_minutes} min of mission time)`);
  const tag = m.kind === "emergency" ? "Emergency" : m.kind === "alert" ? "Alert" : m.kind === "daily_report" ? "Daily report" : fromCrew ? "Update" : m.kind === "auto_ack" ? "Automatic" : "You";
  const node = h("details", { class: `message ${fromCrew ? "" : "from-earth"} ${m.kind === "emergency" ? "emergency" : ""}`, open: open.has(m.id) },
    h("summary", {},
      h("span", { class: "chip" }, tag),
      h("strong", {}, m.title),
      m.kind === "daily_report" ? h("span", { class: `badge ${m.all_green ? "ok" : "watch"}` }, m.all_green ? "All in range" : "Needs review") : null,
      h("span", { class: "muted small" }, status)),
    h("p", { class: "body" }, m.body));
  node.addEventListener("toggle", () => (node.open ? open.add(m.id) : open.delete(m.id)));
  return node;
}

async function refresh() {
  const data = await get("/api/doctor");
  const p = data.profile;
  crewBox.replaceChildren(
    h("h2", {}, "Crew member"),
    p ? h("div", {},
      h("p", {}, h("strong", {}, p.name), p.role ? `, ${p.role}` : "", ` · ${data.environment.label}`),
      h("p", { class: "muted" }, [
        p.age ? `Age ${p.age}` : null, p.sex || null,
        p.resting_hr ? `resting heart rate ${p.resting_hr} bpm` : null,
        p.systolic_bp ? `blood pressure ${p.systolic_bp} mmHg` : null,
        p.sleep_hours ? `usual sleep ${p.sleep_hours} h` : null,
      ].filter(Boolean).join(" · ") || "No baseline entered."),
      h("p", { class: "muted" }, `Conditions: ${p.conditions || "none listed"} · Medications: ${p.medications || "none listed"} · Allergies: ${p.allergies || "none listed"}`))
      : h("p", { class: "muted" }, "No profile has been set up on the crew side yet."),
    h("span", { class: "chip" }, `Signal delay: ${data.delay_label}`));

  for (const m of data.messages) {
    if (m.from === "ship" && !seen.has(m.id)) { seen.add(m.id); if (m.kind !== "daily_report" || !m.all_green) open.add(m.id); }
  }
  inbox.replaceChildren(...(data.messages.length
    ? data.messages.map(message)
    : [h("p", { class: "muted", style: "margin:0" }, "Nothing has arrived from the crew yet.")]));
  sentNote.textContent = data.in_transit ? `${data.in_transit} of your replies still travelling to the crew.` : "";
}

app.append(
  h("h1", {}, "Flight surgeon console"),
  h("p", { class: "muted" }, "Earth side. You see each message only after the signal delay, and your replies take the same time to reach the crew. Green daily reports are acknowledged automatically."),
  crewBox,
  h("section", { class: "card" },
    h("h2", {}, "Reply to the crew member"),
    h("div", { class: "row", style: "margin-bottom:8px" }, QUICK.map((text, i) =>
      h("button", { onclick: () => { reply.value = text; reply.focus(); } }, ["Agree with checklist", "Nothing of concern", "Repeat measurement"][i]))),
    h("label", { for: "reply" }, "Message"), reply, error,
    h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "primary", onclick: send }, "Send to crew"), sentNote)),
  h("section", { class: "card" }, h("h2", {}, "Inbox"), inbox),
);
refresh();
setInterval(refresh, 2000);
