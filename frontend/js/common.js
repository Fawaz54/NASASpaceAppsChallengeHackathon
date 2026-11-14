// Helpers shared by every crew screen: building elements, the top bar,
// the "I need help" button and reading text aloud.

export const STATUS = { ok: "Normal", watch: "Watch", act: "Act now" };

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

const PAGES = [
  ["index.html", "Home"],
  ["checkin.html", "Daily check-in"],
  ["trends.html", "Trends"],
  ["ask.html", "Ask"],
  ["profile.html", "Profile"],
];

// Starts the emergency straight away (alerts crew and Earth), then opens the help screen.
export async function callForHelp() {
  await fetch("/api/emergency/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (location.pathname.endsWith("emergency.html")) location.reload();
  else location.href = "emergency.html";
}

export function topbar(active) {
  const bar = h("header", { class: "topbar" },
    h("div", { class: "topbar-inner" },
      h("span", { class: "brand" }, "Crew Health"),
      h("nav", {}, PAGES.map(([href, label]) =>
        h("a", { href, class: href === active ? "active" : "" }, label))),
      h("button", { class: "help", onclick: callForHelp }, "I need help"),
    ));
  document.body.prepend(bar);
}

// Reads text aloud with a voice installed on this device, so it works offline.
export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const local = voices.find((v) => v.localService && v.lang.startsWith("en")) || voices.find((v) => v.localService);
  if (local) utterance.voice = local;
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

export function speakButton(getText, label = "Read aloud") {
  return h("button", { onclick: () => speak(getText()) }, label);
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

// One Earth-link message. perspective is "ship" or "earth": whose screen it is on.
// open is a Set of message ids that are expanded, so refreshes keep them open.
export function messageNode(message, perspective, open) {
  const outgoing = message.from === perspective;
  const status = outgoing
    ? (message.arrived ? "Delivered" : `In transit · arrives in ${message.eta_seconds} s (${message.eta_real_minutes} min of mission time)`)
    : "Received";
  const node = h("details", { class: `message ${outgoing ? "" : "from-earth"} ${message.kind === "emergency" ? "emergency" : ""}`, open: open.has(message.id) },
    h("summary", {},
      h("span", { class: "chip" }, outgoing ? "Sent" : "Reply"),
      h("strong", {}, message.title),
      h("span", { class: "muted small" }, status)),
    h("p", { class: "body" }, message.body));
  node.addEventListener("toggle", () => (node.open ? open.add(message.id) : open.delete(message.id)));
  return node;
}
