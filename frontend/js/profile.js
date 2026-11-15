// Astronaut profile. Without a signed-in user this is "create an account";
// otherwise it edits the profile. The values set the personal baseline
// ("normal for you") and where the crew is, which sets the Earth delay.
import { get, post } from "./api.js";
import { h, topbar, simpleBar, numberField } from "./common.js";
import { session } from "./session.js";

const user = session.get();
const creating = !user || user.role !== "astronaut";
const { profile, suggested, environments, ranges } = await get("/api/profile");
if (creating) simpleBar("Crew Health"); else topbar("profile.html");

const TEXT = {
  role: ["Role on the crew", "Flight engineer"],
  conditions: ["Medical conditions", "None"],
  medications: ["Regular medications", "None"],
  allergies: ["Allergies", "None"],
  mission_name: ["Mission name", "Ares 3"],
};
const NUMBERS = {
  age: ["Age", "years", "34"],
  resting_hr: ["Resting heart rate", "bpm", "62"], systolic_bp: ["Blood pressure, upper number", "mmHg", "118"],
  sleep_hours: ["Usual sleep per night", "hours", "7.5"],
};

const fields = {};
function textField(key, type = "text") {
  const [label, hint] = TEXT[key] || [];
  const input = h("input", { id: key, type, placeholder: hint || "" });
  if (profile?.[key]) input.value = profile[key];
  fields[key] = { read: () => input.value.trim(), input };
  return h("div", {}, h("label", { for: key }, label), input);
}
function number(key) {
  const [label, unit, hint] = NUMBERS[key];
  const field = numberField({ id: key, label, unit, hint, min: ranges[key][0], max: ranges[key][1], value: profile?.[key] });
  fields[key] = field;
  return field.node;
}

// Height and weight can be typed in metric or US units. They are always saved
// in centimetres and kilograms, so the rest of the app has one unit to deal with.
const CM_PER_FOOT = 30.48, CM_PER_INCH = 2.54, KG_PER_POUND = 0.45359237;
const round1 = (value) => Math.round(value * 10) / 10;

function unitField({ key, label, units, toMetric, fromMetric, unitKey }) {
  const [low, high] = ranges[key];
  const choice = h("select", { id: `${key}-unit`, "aria-label": `${label} unit`, style: "width:auto" },
    units.map(([value, text]) => h("option", { value }, text)));
  choice.value = profile?.[unitKey] || units[0][0];
  const boxes = h("div", { class: "row", style: "flex-wrap:nowrap" });
  const error = h("div", { class: "error" });
  let inputs = [];
  let metric = profile?.[key] ?? null;   // the saved value, used to refill the boxes when the unit changes

  function draw() {
    const parts = fromMetric(choice.value, metric);   // [[hint, value], ...]
    inputs = parts.map(([hint, value], index) => {
      const input = h("input", { id: index === 0 ? key : `${key}-${index}`, type: "number", step: "any", inputmode: "decimal",
        min: "0", placeholder: hint, "aria-label": `${label} ${hint}` });
      if (value !== null) input.value = value;
      input.addEventListener("input", () => { error.textContent = ""; });
      return input;
    });
    boxes.replaceChildren(...inputs, choice);
  }
  function read() {
    if (inputs.every((input) => input.value === "")) return null;
    const numbers = inputs.map((input) => (input.value === "" ? 0 : Number(input.value)));
    const value = toMetric(choice.value, numbers);
    if (numbers.some((n) => !Number.isFinite(n) || n < 0) || value < low || value > high) {
      const limits = [low, high].map((limit) => fromMetric(choice.value, limit).map(([hint, v]) => `${v} ${hint}`).join(" "));
      error.textContent = `Enter a ${label.toLowerCase()} between ${limits[0]} and ${limits[1]}.`;
      inputs[0].focus();
      return undefined;
    }
    return round1(value);
  }
  choice.addEventListener("change", () => {
    // Keep whatever was typed, converted to the new unit.
    const typed = inputs.some((input) => input.value !== "") ? inputs.map((input) => Number(input.value) || 0) : null;
    const previous = choice.dataset.previous || units[0][0];
    if (typed) metric = toMetric(previous, typed);
    choice.dataset.previous = choice.value;
    draw();
  });
  choice.dataset.previous = choice.value;
  draw();
  fields[key] = { read, input: { set value(v) { metric = v; draw(); } } };
  fields[unitKey] = { read: () => choice.value };
  return h("div", {}, h("label", { for: key }, label), boxes, error);
}

const heightField = () => unitField({
  key: "height_cm", unitKey: "height_unit", label: "Height", units: [["cm", "cm"], ["ft", "ft and in"]],
  toMetric: (unit, [a, b = 0]) => (unit === "cm" ? a : a * CM_PER_FOOT + b * CM_PER_INCH),
  fromMetric: (unit, cm) => {
    if (unit === "cm") return [["cm", cm === null ? null : Math.round(cm)]];
    if (cm === null) return [["ft", null], ["in", null]];
    const inches = Math.round(cm / CM_PER_INCH);
    return [["ft", Math.floor(inches / 12)], ["in", inches % 12]];
  },
});
const weightField = () => unitField({
  key: "weight_kg", unitKey: "weight_unit", label: "Weight", units: [["kg", "kg"], ["lb", "lb"]],
  toMetric: (unit, [a]) => (unit === "kg" ? a : a * KG_PER_POUND),
  fromMetric: (unit, kg) => [[unit, kg === null ? null : (unit === "kg" ? round1(kg) : Math.round(kg / KG_PER_POUND))]],
});

const fullName = h("input", { id: "name", type: "text", placeholder: "Your full name" });
if (profile?.name) fullName.value = profile.name;
const username = h("input", { id: "username", type: "text", placeholder: "Used to sign in, for example mkelly" });

const sex = h("select", { id: "sex" }, ["", "Female", "Male", "Other"].map((o) => h("option", { value: o }, o || "Choose")));
sex.value = profile?.sex || "";
const environment = h("select", { id: "environment" }, Object.entries(environments).map(([key, env]) => h("option", { value: key }, env.label)));
environment.value = profile?.environment || "mars";
const launch = h("input", { id: "mission_start", type: "date" });
if (profile?.mission_start) launch.value = profile.mission_start;

const error = h("p", { class: "error" });
const watchButton = suggested ? h("button", { type: "button", onclick: () => {
  for (const key of ["resting_hr", "sleep_hours", "age", "height_cm", "weight_kg"]) {
    if (suggested[key] !== null && suggested[key] !== undefined) fields[key].input.value = suggested[key];
  }
  if (suggested.sex) sex.value = suggested.sex;
} }, "Fill from Apple Watch data") : null;

async function save(event) {
  event.preventDefault();
  error.textContent = "";
  const values = { name: fullName.value.trim(), full_name: fullName.value.trim(), sex: sex.value,
    environment: environment.value, mission_start: launch.value };
  if (!values.name) { error.textContent = "Enter your full name."; fullName.focus(); return; }
  for (const [key, field] of Object.entries(fields)) {
    const value = field.read();
    if (value === undefined) return;   // out of range; the field shows why
    values[key] = value;
  }
  if (creating) {
    const result = await post("/api/signup", { ...values, role: "astronaut", username: username.value });
    if (result.error) { error.textContent = result.error; return; }
    session.set(result);
  } else {
    await post("/api/profile", values);
    session.set({ ...user, full_name: values.name });
  }
  location.href = "index.html";
}

document.getElementById("app").append(
  h("h1", {}, creating ? "Create your astronaut account" : "Your profile"),
  h("p", { class: "muted" }, "Filled in once before the mission. These values are your personal baseline: the app compares every reading with what is normal for you."),
  h("form", { onsubmit: save, novalidate: true },
    h("section", { class: "card" }, h("h2", {}, "About you"),
      h("div", { class: "fields" },
        h("div", {}, h("label", { for: "name" }, "Full name"), fullName),
        creating ? h("div", {}, h("label", { for: "username" }, "Username"), username) : null,
        textField("role"), number("age"),
        h("div", {}, h("label", { for: "sex" }, "Sex"), sex),
        heightField(), weightField())),
    h("section", { class: "card" },
      h("div", { class: "row between" }, h("h2", {}, "Your pre-flight baseline"), watchButton),
      h("p", { class: "muted" }, "Leave a box empty to use a typical value."),
      h("div", { class: "fields" }, number("resting_hr"), number("systolic_bp"), number("sleep_hours"))),
    h("section", { class: "card" }, h("h2", {}, "Medical notes for the flight surgeon"),
      h("div", { class: "fields" }, textField("conditions"), textField("medications"), textField("allergies"))),
    h("section", { class: "card" }, h("h2", {}, "Mission"),
      h("div", { class: "fields" },
        h("div", {}, h("label", { for: "environment" }, "Where you are"), environment),
        textField("mission_name"),
        h("div", {}, h("label", { for: "mission_start" }, "Launch date"), launch)),
      h("p", { class: "muted" }, "Your location sets the signal delay to Earth, the background radiation and gravity.")),
    error,
    h("div", { class: "row" },
      h("button", { class: "primary", type: "submit" }, creating ? "Create account" : "Save profile"),
      creating ? h("a", { class: "button", href: "login.html" }, "Back to sign in") : null)),
);
