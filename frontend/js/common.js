// Helpers shared by every screen: building elements, the top bar,
// the "I need help" button, reading text aloud and Earth-link messages.
import { session, toggleTheme } from "./session.js";

export const STATUS = { ok: "Normal", watch: "Monitor", act: "Act now", neutral: "Tracked" };
export const MARK = { ok: "✓", watch: "!", act: "!!", neutral: "" };

// The screens often pass "nothing" (null or false) where an optional piece is
// left out. The browser would print that as the word "null", so drop those
// values before they reach the page.
for (const method of ["append", "replaceChildren"]) {
  const original = Element.prototype[method];
  Element.prototype[method] = function (...nodes) {
    return original.apply(this, nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
  };
}

// h("div", {class: "card"}, "text", childNode) builds an element safely (text is never parsed as HTML).
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== "string") node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

export function badge(status) {
  return h("span", { class: `badge ${status}` }, STATUS[status]);
}

// Sends anyone who is not signed in with the right kind of account to the sign-in page.
export function requireUser(role) {
  const user = session.get();
  if (!user || user.role !== role) {
    location.href = "login.html";
    return new Promise(() => {});
  }
  return user;
}

function accountControls() {
  const user = session.get();
  return [
    user ? h("span", { class: "chip" }, user.full_name) : null,
    h("button", { class: "plain icon", "aria-label": "Switch between light and dark", onclick: toggleTheme }, "◐"),
    user ? h("button", { class: "plain", onclick: () => { session.clear(); location.href = "login.html"; } }, "Sign out") : null,
  ];
}

const PAGES = [
  ["index.html", "Home"],
  ["checkin.html", "Daily check-in"],
  ["trends.html", "Trends"],
  ["ask.html", "Ask"],
  ["profile.html", "Profile"],
];

// Starts the emergency straight away (alerts crew and Earth), then opens the help screen.
export async function callForHelp() {
  const user = session.get();
  await fetch("/api/emergency/start", { method: "POST", headers: { "Content-Type": "application/json", "X-User": user ? user.username : "" }, body: "{}" });
  if (location.pathname.endsWith("emergency.html")) location.reload();
  else location.href = "emergency.html";
}

// Top bar for crew screens.
export function topbar(active) {
  document.body.prepend(h("header", { class: "topbar" },
    h("div", { class: "topbar-inner" },
      h("span", { class: "brand" }, "Crew Health"),
      h("nav", {}, PAGES.map(([href, label]) => h("a", { href, class: href === active ? "active" : "" }, label))),
      ...accountControls(),
      h("button", { class: "help", onclick: callForHelp }, "I need help"))));
}

// Top bar for the sign-in page and the flight surgeon's screen.
export function simpleBar(title) {
  document.body.prepend(h("header", { class: "topbar" },
    h("div", { class: "topbar-inner" }, h("span", { class: "brand", style: "flex:1" }, title), ...accountControls())));
}

// Reads text aloud with a voice installed on this device, so it works offline.
// Returns the utterance (or null if this browser cannot speak).
export function speak(text) {
  if (!("speechSynthesis" in window)) return null;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const local = voices.find((v) => v.localService && v.lang.startsWith("en")) || voices.find((v) => v.localService);
  if (local) utterance.voice = local;
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
  return utterance;
}

// Leaving a screen stops any reading that is still going.
window.addEventListener("pagehide", () => stopSpeaking());

export function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// A button that reads text aloud and turns into "Stop reading" while it speaks.
// autoplay starts reading straight away (used for emergency steps).
export function speakButton(getText, label = "Read aloud", { autoplay = false } = {}) {
  const button = h("button", {});
  const idle = () => { button.textContent = label; button.classList.remove("selected"); };
  const speaking = () => { button.textContent = "Stop reading"; button.classList.add("selected"); };
  const start = () => {
    const utterance = speak(getText());
    if (!utterance) return;
    speaking();
    utterance.onend = idle;
    utterance.onerror = idle;
  };
  button.addEventListener("click", () => {
    if (button.classList.contains("selected")) { stopSpeaking(); idle(); } else start();
  });
  idle();
  if (autoplay) start();
  else if ("speechSynthesis" in window && speechSynthesis.speaking) speaking();
  return button;
}

// A short tone when something needs attention. Browsers block sound until
// the user has clicked somewhere, so failure is ignored.
export function beep() {
  try {
    const context = new AudioContext();
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = 880;
    volume.gain.value = 0.08;
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.35);
  } catch { /* no sound available */ }
}

// One Earth-link message on a crew screen.
// open is a Set of message ids that are expanded, so refreshes keep them open.
export function messageNode(message, open) {
  const outgoing = message.from === "ship";
  const travelling = `On its way · arrives in ${message.eta_seconds} s (${message.eta_real_minutes} min of mission time)`;
  const report = message.kind === "daily_report";
  const status = report
    ? { Sent: travelling, Delivered: "Delivered · waiting for the flight surgeon", Reviewed: "Reviewed by the flight surgeon" }[message.report_status]
    : outgoing ? (message.arrived ? "Delivered" : travelling) : "Received";
  const node = h("details", { class: `message ${outgoing ? "" : "from-earth"} ${message.kind === "emergency" ? "emergency" : ""}`, open: open.has(message.id) },
    h("summary", {},
      h("span", { class: "chip" }, report ? "Daily report" : outgoing ? "Sent" : "Reply"),
      h("strong", {}, message.title),
      report ? h("span", { class: `badge ${message.report_status === "Reviewed" ? "ok" : "neutral"}` }, message.report_status) : null,
      h("span", { class: "muted small" }, status)),
    message.feedback ? h("div", { class: "feedback" }, h("strong", {}, "Flight surgeon's feedback: "), message.feedback) : null,
    h("p", { class: "body" }, message.body));
  node.addEventListener("toggle", () => (node.open ? open.add(message.id) : open.delete(message.id)));
  return node;
}

// A number box that refuses values outside its range. Returns {node, read}:
// read() gives the number, null if empty, or undefined (and shows why) if invalid.
export function numberField({ id, label, unit, min, max, hint, value }) {
  const input = h("input", { id, type: "number", step: "any", inputmode: "decimal", min: String(min), max: String(max), placeholder: hint || "" });
  if (value !== null && value !== undefined) input.value = value;
  const error = h("div", { class: "error" });
  input.addEventListener("input", () => { error.textContent = ""; });
  const node = h("div", {}, h("label", { for: id }, unit ? `${label} (${unit})` : label), input, error);
  return {
    node, input,
    read() {
      if (input.value === "") return null;
      const number = Number(input.value);
      if (!Number.isFinite(number) || number < min || number > max) {
        error.textContent = `Enter a number between ${min} and ${max}.`;
        input.focus();
        return undefined;
      }
      return number;
    },
  };
}
