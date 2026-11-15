// Flight surgeon console (the Earth side). It shows only what has had time to
// travel from the crew, and replies take the same delay back. It also shows
// mission control's overview of the wider (simulated) astronaut corps.
import { get, post } from "./api.js";
import { h, simpleBar, requireUser } from "./common.js";

const me = await requireUser("doctor");
simpleBar("Flight surgeon console");
const app = document.getElementById("app");

const crewBox = h("section", { class: "card" });
const inbox = h("div");
const cloudBox = h("section", { class: "card" });
const corpsBox = h("section", { class: "card" });
const target = h("select", { id: "target" });
const replyNote = h("p", { class: "muted", style: "margin:0" });
const reply = h("textarea", { id: "reply", placeholder: "Write feedback or instructions for the crew member" });
const error = h("p", { class: "error" });
const sentNote = h("p", { class: "muted", style: "margin:0" });
const open = new Set();
const seen = new Set();
let replyTo = null;      // id of the daily report being answered
let astronauts = [];
let crewSignature = "";
let shownInbox = "";

const QUICK = [
  ["Agree with checklist", "Report reviewed. Agree with the checklist shown. Continue and report any change."],
  ["Nothing of concern", "Readings reviewed. Nothing of concern. Keep up the exercise plan."],
  ["Repeat measurement", "Please repeat the measurement in one hour and send the result."],
];

function answer(message) {
  replyTo = message.kind === "daily_report" ? message.id : null;
  target.value = message.crew;
  replyNote.textContent = replyTo ? `Replying to ${message.title}. Your reply marks it as reviewed.` : `Replying to ${message.context.crew}.`;
  reply.focus();
  reply.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function send() {
  if (!reply.value.trim()) { error.textContent = "Write a reply first."; return; }
  const result = await post("/api/doctor/reply", { text: reply.value, crew: target.value, reply_to: replyTo });
  if (result.error) { error.textContent = result.error; return; }
  error.textContent = "";
  reply.value = "";
  replyTo = null;
  replyNote.textContent = "";
  refresh();
}

const TAG = { emergency: "Emergency", alert: "Alert", daily_report: "Daily report", update: "Update", auto_ack: "Automatic", feedback: "Your reply" };

function message(m) {
  const fromCrew = m.from === "ship";
  const status = fromCrew ? `From ${m.context.crew}` : (m.arrived ? `Delivered to ${m.context.crew}` : `On its way to ${m.context.crew} · ${m.eta_seconds} s (${m.eta_real_minutes} min of mission time)`);
  const node = h("details", { class: `message ${fromCrew ? "" : "from-earth"} ${m.kind === "emergency" ? "emergency" : ""}`, open: open.has(m.id) },
    h("summary", {},
      h("span", { class: "chip" }, TAG[m.kind] || "Message"),
      h("strong", {}, m.title),
      m.kind === "daily_report" ? h("span", { class: `badge ${m.all_green ? "ok" : "watch"}` }, m.all_green ? "✓ All in range" : "! Needs review") : null,
      m.kind === "daily_report" ? h("span", { class: `badge ${m.report_status === "Reviewed" ? "ok" : "neutral"}` }, m.report_status) : null,
      h("span", { class: "muted small" }, status),
      m.cloud === "stored" ? h("span", { class: "chip" }, "Saved to Azure") : null,
      m.cloud === "waiting" ? h("span", { class: "chip" }, "Waiting to upload") : null),
    h("p", { class: "body" }, m.body),
    h("p", { class: "muted small" }, `Recorded at: ${m.context.location} · mission day ${m.context.mission_day} · background radiation ${m.context.background_dose_rate_msv_per_day} mSv/day · gravity ${m.context.gravity_g} g`),
    fromCrew ? h("button", { onclick: () => answer(m) }, m.kind === "daily_report" ? "Write feedback on this report" : "Reply") : null);
  node.addEventListener("toggle", () => (node.open ? open.add(m.id) : open.delete(m.id)));
  return node;
}

function renderCrew(data) {
  const signature = JSON.stringify(data.astronauts);
  if (signature === crewSignature) return;   // nothing changed; leave the open dropdown alone
  crewSignature = signature;
  astronauts = data.astronauts;
  const keep = target.value;
  target.replaceChildren(...astronauts.map((a) => h("option", { value: a.username }, `${a.full_name} (${a.username})`)));
  if (astronauts.some((a) => a.username === keep)) target.value = keep;
  crewBox.replaceChildren(
    h("h2", {}, "Your crew"),
    astronauts.length ? h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Name", "Location", "Signal delay", "Baseline", "Medical notes"].map((t) => h("th", {}, t)))),
      h("tbody", {}, astronauts.map((a) => {
        const p = a.profile;
        return h("tr", {},
          h("td", {}, h("strong", {}, a.full_name), p.role ? h("div", { class: "muted small" }, p.role) : null),
          h("td", {}, a.location), h("td", {}, a.delay_label),
          h("td", { class: "small" }, [p.age ? `age ${p.age}` : null, p.resting_hr ? `${p.resting_hr} bpm` : null,
            p.systolic_bp ? `${p.systolic_bp} mmHg` : null, p.sleep_hours ? `${p.sleep_hours} h sleep` : null].filter(Boolean).join(" · ") || "not given"),
          h("td", { class: "small" }, `Conditions: ${p.conditions || "none"} · Medications: ${p.medications || "none"} · Allergies: ${p.allergies || "none"}`));
      }))))
      : h("p", { class: "muted", style: "margin:0" }, "No astronaut has created an account yet."));
}

function renderCloud(cloud) {
  const state = !cloud.configured ? ["Not set up", "neutral"]
    : cloud.connected === false ? ["No connection: messages are waiting", "watch"]
    : cloud.connected ? ["✓ Connected", "ok"] : ["Connecting…", "neutral"];
  cloudBox.replaceChildren(
    h("div", { class: "row between" }, h("h2", { style: "margin:0" }, "Medical archive (Microsoft Azure)"),
      h("span", { class: `badge ${state[1]}` }, state[0])),
    !cloud.configured
      ? h("p", { class: "muted", style: "margin:8px 0 0" }, "Add the storage link to private/azure.json to keep every report in the cloud. Steps are in docs/azure.md.")
      : h("div", {},
        h("p", { class: "muted", style: "margin-top:8px" },
          `${cloud.account} · ${cloud.file_count} files stored` + (cloud.waiting ? ` · ${cloud.waiting} waiting to upload` : "")),
        ...cloud.files.slice(0, 8).map((file) => h("div", { class: "small", style: "padding:4px 0;border-top:1px solid var(--line)" }, file.name))));
}

async function refresh() {
  const data = await get("/api/doctor");
  renderCrew(data);
  for (const m of data.messages) {  // new items from the crew open themselves, except routine green reports
    if (m.from === "ship" && !seen.has(m.id)) { seen.add(m.id); if (m.kind !== "daily_report" || !m.all_green) open.add(m.id); }
  }
  const inboxSignature = JSON.stringify(data.messages);
  if (inboxSignature !== shownInbox) {   // redraw only when something changed, so buttons stay put
    shownInbox = inboxSignature;
    inbox.replaceChildren(...(data.messages.length
      ? data.messages.map(message)
      : [h("p", { class: "muted", style: "margin:0" }, "Nothing has arrived from the crew yet.")]));
  }
  sentNote.textContent = data.in_transit ? `${data.in_transit} of your replies still travelling to the crew.` : "";
  renderCloud(data.cloud);
}

// Mission control overview of the wider corps. The dataset is simulated and says so.
async function renderCorps() {
  const corps = await get("/api/crew");
  let showAll = false;
  const table = h("div");
  const columns = [["id", "ID"], ["phase", "Mission phase"], ["days_in_mission", "Day"], ["heart_rate", "HR"], ["systolic_bp", "BP"],
    ["spo2", "SpO2"], ["body_temp", "Temp"], ["sleep_hours", "Sleep"], ["dose_rate", "mSv/day"], ["cumulative_dose", "Total mSv"]];
  const toggle = h("button", { onclick: () => { showAll = !showAll; draw(); } });
  function draw() {
    const rows = showAll ? corps.crew : corps.flagged;
    toggle.textContent = showAll ? "Show only those needing review" : `Show all ${corps.total} crew members`;
    const head = h("thead", {}, h("tr", {}, [...columns.map(([, label]) => h("th", {}, label)), h("th", {}, "Review reason")]));
    const body = h("tbody", {}, rows.map((person) => {
      const reason = person.reasons ? h("span", { class: "badge watch" }, `! ${person.reasons.join(", ")}`) : "";
      return h("tr", {}, columns.map(([key]) => h("td", {}, String(person[key]))), h("td", {}, reason));
    }));
    table.replaceChildren(h("div", { class: "scroll" }, h("table", {}, head, body)));
  }
  corpsBox.replaceChildren(
    h("div", { class: "row between" }, h("h2", { style: "margin:0" }, "Astronaut corps overview"),
      h("span", { class: "badge neutral" }, "Simulated data")),
    h("p", { class: "muted", style: "margin-top:8px" },
      `${corps.total} crew members across ${corps.phases.length} mission phases; ${corps.flagged.length} need review. This is a simulated crew built by the team from published ranges, not real astronaut records.`),
    h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Mission phase", "Crew", "Need review", "Average radiation (mSv/day)"].map((t) => h("th", {}, t)))),
      h("tbody", {}, corps.phases.map((p) => h("tr", {}, h("td", {}, p.phase), h("td", {}, String(p.count)),
        h("td", {}, String(p.flagged)), h("td", {}, String(p.average_dose_rate))))))),
    h("div", { class: "row between", style: "margin:14px 0 6px" }, h("h3", { style: "margin:0" }, "Crew members"), toggle),
    table);
  draw();
}

app.append(
  h("h1", {}, `Welcome, ${me.full_name}`),
  h("p", { class: "muted" }, "Earth side. You see each message only after the signal delay, and your replies take the same time to reach the crew. Daily reports that are all in range are acknowledged automatically."),
  crewBox,
  h("section", { class: "card" }, h("h2", {}, "Inbox"), inbox),
  h("section", { class: "card" },
    h("h2", {}, "Reply"),
    h("div", { class: "fields" }, h("div", {}, h("label", { for: "target" }, "To"), target)),
    replyNote,
    h("div", { class: "row", style: "margin:8px 0" }, QUICK.map(([label, text]) => h("button", { onclick: () => { reply.value = text; reply.focus(); } }, label))),
    h("label", { for: "reply" }, "Message"), reply, error,
    h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "primary", onclick: send }, "Send to crew"), sentNote)),
  cloudBox, corpsBox);
refresh();
renderCorps();
setInterval(refresh, 2000);
