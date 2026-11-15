// Ask: the local AI explains readings and checklists in plain language.
// It only explains what the rules decided; it never chooses what to do.
import { get, post } from "./api.js";
import { h, topbar, speakButton, requireUser } from "./common.js";
import { micButton } from "./speech.js";

await requireUser("astronaut");
topbar("ask.html");
const app = document.getElementById("app");
const state = await get("/api/state");

const alert = state.alert;
const watching = state.vitals.filter((v) => v.status !== "ok");
const suggestions = alert
  ? ["Why am I seeing this checklist?", "How serious is this?", "What happens if I wait?"]
  : watching.length
    ? [`Why is my ${watching[0].label.toLowerCase()} flagged?`, "What does my blood pressure tell me?", "Why does sleep matter on a mission?"]
    : ["Are all my readings normal?", "What does my blood oxygen tell me?", "Why does exercise matter in space?"];

const input = h("input", { id: "question", type: "text", placeholder: "Type a question about your readings" });
const error = h("p", { class: "error" });
const answerBox = h("section", { class: "card", hidden: true });

async function ask(question) {
  if (!question.trim()) { error.textContent = "Type a question first."; return; }
  error.textContent = "";
  answerBox.hidden = false;
  answerBox.replaceChildren(h("p", { class: "muted", style: "margin:0" }, "Thinking…"));
  const result = await post("/api/ask", { question });
  answerBox.replaceChildren(
    h("div", { class: "muted" }, question),
    h("p", { style: "font-size:18px;margin:8px 0 12px" }, result.answer),
    h("div", { class: "row" },
      h("span", { class: "chip" }, `Based on: ${result.based_on}`),
      h("span", { class: "chip" }, result.used_ai ? `Written by local AI (${state.ai.model})` : "Written explanation (local AI not running)"),
      speakButton(() => result.answer)),
  );
}

app.append(
  h("h1", {}, "Ask about your health"),
  h("section", { class: "card" },
    alert
      ? h("p", {}, h("strong", {}, "Current alert: "), `${alert.title} (protocol ${alert.protocol_id})`)
      : h("p", {}, state.all_green ? "All of your readings are in your normal range." : "No urgent alert. Some readings are worth watching."),
    h("p", { class: "muted" }, "Answers use only your readings and the written checklists. The AI explains; it does not decide what you should do."),
    h("div", { class: "row", style: "margin-bottom:12px" }, suggestions.map((s) => h("button", { onclick: () => { input.value = s; ask(s); } }, s))),
    h("label", { for: "question" }, "Your question"),
    h("form", { class: "row", onsubmit: (event) => { event.preventDefault(); ask(input.value); } },
      h("div", { style: "flex:1;min-width:220px" }, input), h("button", { class: "primary", type: "submit" }, "Ask")),
    micButton({ available: state.speech.available, label: "Ask out loud",
      onText: (text) => { input.value = text; ask(text); } }),
    error),
  answerBox,
);
