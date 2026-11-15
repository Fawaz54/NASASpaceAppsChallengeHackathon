// Emergency: pressing "I need help" alerts the crew and Earth straight away,
// then asks a fixed set of questions and shows the steps to take.
// The follow-up questions depend on what happened; the danger signs are always asked.
import { get, post } from "./api.js";
import { h, topbar, speakButton, speak, messageNode, requireUser } from "./common.js";
import { createBodyMap } from "./bodymap.js";

await requireUser("astronaut");
topbar("emergency.html");
const app = document.getElementById("app");
const triage = await get("/api/triage");
let state = await get("/api/state");

const repliesBox = h("div");
const openReplies = new Set();
const seenReplies = new Set();

function statusCard(emergency) {
  return h("section", { class: "card banner" },
    h("h2", {}, "Help has been called"),
    h("p", {}, "The crew medical officer has been alerted on board."),
    h("p", {}, `A message is on its way to the flight surgeon. Signal delay: ${state.environment.delay_label}, so follow the steps here while you wait.`),
    h("button", { onclick: async () => { await post("/api/emergency/resolve"); location.href = "index.html"; } },
      emergency.stage === "steps" ? "I am okay now: close the emergency" : "Pressed by mistake: cancel"));
}

function idle() {
  app.replaceChildren(
    h("h1", {}, "Need help?"),
    h("section", { class: "card" },
      h("p", {}, "Pressing the button alerts the crew medical officer and sends a message to Earth immediately. Then you will be asked a few short questions and shown what to do."),
      h("button", { class: "help big", onclick: async () => { await post("/api/emergency/start", {}); state = await get("/api/state"); show(); } }, "I need help")));
}

function questions(emergency) {
  const answers = {
    type: emergency.prefill.type,
    details: {},
    regions: new Set(emergency.prefill.regions),
    severity: emergency.prefill.severity || 5,
    onset: emergency.prefill.onset,
    signs: new Set(),
  };

  // In your own words (pre-fills the answers below).
  const description = h("textarea", { id: "description", placeholder: "For example: I scratched my left arm on a panel and it is bleeding a little" });
  description.value = emergency.description || "";
  const aiNote = h("p", { class: "muted" }, emergency.description
    ? (emergency.prefill_by_ai ? "The local AI filled in what it understood below. Check it and correct anything." : "Filled in what could be matched from your words below. Check it and correct anything.")
    : (state.ai.available ? "Optional. The local AI will fill in the answers below from what you write." : "Optional. Matching words will be filled in below."));
  const describeButton = h("button", { onclick: async () => {
    if (!description.value.trim()) return;
    describeButton.textContent = "Reading…";
    describeButton.disabled = true;
    state.emergency = await post("/api/emergency/describe", { description: description.value });
    show();
  } }, "Fill in from my words");

  // 1. What happened, then questions specific to it.
  const followUps = h("div");
  const typeButtons = triage.types.map((type) =>
    h("button", { class: type.id === answers.type ? "selected" : "", onclick: () => { answers.type = type.id; answers.details = {}; showType(); } }, type.label));
  function showType() {
    typeButtons.forEach((b, i) => b.classList.toggle("selected", triage.types[i].id === answers.type));
    const type = triage.types.find((t) => t.id === answers.type);
    followUps.replaceChildren(...(type ? type.questions.map((q) => {
      const buttons = q.choices.map((choice) => h("button", { onclick: () => {
        if (q.multiple) {
          const chosen = new Set(answers.details[q.key] || []);
          chosen.has(choice) ? chosen.delete(choice) : chosen.add(choice);
          answers.details[q.key] = [...chosen];
          buttons.forEach((b) => b.classList.toggle("selected", chosen.has(b.textContent)));
        } else {
          answers.details[q.key] = choice;
          buttons.forEach((b) => b.classList.toggle("selected", b.textContent === choice));
        }
      } }, choice));
      return h("div", { class: "question" }, h("div", {}, q.question, q.multiple ? h("span", { class: "muted" }, " (choose all that apply)") : null),
        h("div", { class: "row", style: "margin-top:8px" }, buttons));
    }) : []));
  }
  showType();

  // 2. Where
  const figureBox = h("div");
  const picked = h("p", { class: "muted" });
  const figure = createBodyMap(figureBox, { onTap: (region) => {
    answers.regions.has(region) ? answers.regions.delete(region) : answers.regions.add(region);
    paint();
  } });
  function paint() {
    figure.paint(Object.fromEntries([...answers.regions].map((r) => [r, "picked"])));
    picked.textContent = answers.regions.size ? `Marked: ${[...answers.regions].join(", ")}` : "Nothing marked. Skip this if it is not in one place.";
  }
  paint();

  // 3. Pain level
  const severityOut = h("strong", { style: "min-width:28px;text-align:right;font-size:20px" }, String(answers.severity));
  const severity = h("input", { type: "range", min: "1", max: "10", step: "1", value: String(answers.severity), "aria-label": "Pain level from 1 to 10", style: "flex:1" });
  severity.addEventListener("input", () => { answers.severity = Number(severity.value); severityOut.textContent = severity.value; });

  // 4. Onset
  const onsetButtons = triage.onsets.map((onset) =>
    h("button", { class: onset === answers.onset ? "selected" : "", onclick: () => {
      answers.onset = onset;
      onsetButtons.forEach((b) => b.classList.toggle("selected", b.textContent === onset));
    } }, onset));

  // 5. Danger signs, always asked
  const signRows = triage.signs.map((sign) => {
    const yes = h("button", { onclick: () => { answers.signs.add(sign.id); yes.classList.add("selected"); no.classList.remove("selected"); } }, "Yes");
    const no = h("button", { class: "selected", onclick: () => { answers.signs.delete(sign.id); no.classList.add("selected"); yes.classList.remove("selected"); } }, "No");
    return h("div", { class: "row between", style: "padding:8px 0;border-top:1px solid var(--line)" },
      h("span", { style: "flex:1;min-width:200px" }, sign.question), h("div", { class: "row" }, yes, no));
  });

  app.replaceChildren(
    h("h1", {}, "Tell us what is wrong"),
    statusCard(emergency),
    h("section", { class: "card" }, h("label", { for: "description" }, "In your own words"), description, aiNote, describeButton),
    h("section", { class: "card" }, h("h2", {}, "1. What happened?"), h("div", { class: "row" }, typeButtons), followUps),
    h("section", { class: "card" }, h("h2", {}, "2. Where is it?"), h("div", { class: "grid-2", style: "margin:0" }, figureBox, picked)),
    h("section", { class: "card" }, h("h2", {}, "3. What is your pain level?"),
      h("p", { class: "muted" }, "From 1 (mild, easy to ignore) to 10 (the worst pain you can imagine)."),
      h("div", { class: "row" }, severity, severityOut)),
    h("section", { class: "card" }, h("h2", {}, "4. When did it start?"), h("div", { class: "row" }, onsetButtons)),
    h("section", { class: "card" }, h("h2", {}, "5. Danger signs"),
      h("p", { class: "muted" }, "These are always asked, whatever happened."), signRows),
    h("button", { class: "primary big", onclick: async () => {
      state.emergency = await post("/api/emergency/answer", {
        type: answers.type, details: answers.details, regions: [...answers.regions],
        severity: answers.severity, onset: answers.onset, signs: [...answers.signs] });
      show();
      window.scrollTo({ top: 0 });
    } }, "Show me what to do"),
  );
}

function steps(emergency) {
  const protocol = emergency.protocol;
  const spoken = `${protocol.title}. ${protocol.steps.map((s, i) => `Step ${i + 1}. ${s}`).join(". ")}`;
  app.replaceChildren(
    h("h1", {}, protocol.title),
    h("section", { class: "card" },
      h("p", {}, protocol.why),
      h("div", { class: "muted" }, `Protocol ${protocol.protocol_id} · chosen from your answers`),
      h("ul", { class: "steps" }, protocol.steps.map((step) =>
        h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", {}, step))))),
      h("div", { class: "row" }, speakButton(() => spoken, "Read steps aloud"), h("a", { class: "button", href: "ask.html" }, "Ask a question"))),
    statusCard(emergency),
    h("section", { class: "card" }, h("h2", {}, "Earth link"), repliesBox),
  );
  speak(spoken);
  showReplies();
}

function showReplies() {
  if (!state.emergency || state.emergency.stage !== "steps") return;
  const relevant = state.messages.filter((m) => m.kind === "emergency" || m.from === "earth");
  for (const m of relevant) {
    if (m.from === "earth" && !seenReplies.has(m.id)) { seenReplies.add(m.id); openReplies.add(m.id); }
  }
  repliesBox.replaceChildren(...relevant.map((m) => messageNode(m, openReplies)));
}

function show() {
  const emergency = state.emergency;
  if (!emergency) idle();
  else if (emergency.stage === "questions") questions(emergency);
  else steps(emergency);
}

show();
setInterval(async () => {
  const fresh = await get("/api/state");
  state.messages = fresh.messages;
  showReplies();
}, 2000);
