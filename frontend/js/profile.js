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
  age: ["Age", "years", "34"], height_cm: ["Height", "cm", "172"], weight_kg: ["Weight", "kg", "68"],
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
        number("height_cm"), number("weight_kg"))),
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
