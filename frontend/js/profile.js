// Profile: filled in once before the mission. It sets the personal baseline
// ("normal for you") and where the crew is, which sets the Earth delay.
import { get, post } from "./api.js";
import { h, topbar } from "./common.js";

const { profile, suggested, environments } = await get("/api/profile");
if (profile) topbar("profile.html");

const FIELDS = [
  ["name", "Name", "text", "Your name"],
  ["role", "Role on the crew", "text", "Flight engineer"],
  ["age", "Age", "number", "34"],
  ["sex", "Sex", "select", ["", "Female", "Male", "Other"]],
  ["height_cm", "Height (cm)", "number", "172"],
  ["weight_kg", "Weight (kg)", "number", "68"],
];
const BASELINE = [
  ["resting_hr", "Resting heart rate (bpm)", "number", "62"],
  ["systolic_bp", "Blood pressure, upper number (mmHg)", "number", "118"],
  ["sleep_hours", "Usual sleep per night (hours)", "number", "7.5"],
];
const MEDICAL = [
  ["conditions", "Medical conditions", "text", "None"],
  ["medications", "Regular medications", "text", "None"],
  ["allergies", "Allergies", "text", "None"],
];
const MISSION = [
  ["mission_name", "Mission name", "text", "Ares 3"],
  ["mission_start", "Launch date", "date", ""],
];

const inputs = {};
function field([key, label, type, hint]) {
  let input;
  if (type === "select") {
    input = h("select", { id: key }, hint.map((option) => h("option", { value: option }, option || "Choose")));
  } else {
    input = h("input", { id: key, type, placeholder: hint, step: type === "number" ? "any" : null });
  }
  const saved = profile?.[key];
  if (saved !== null && saved !== undefined) input.value = saved;
  inputs[key] = input;
  return h("div", {}, h("label", { for: key }, label), input);
}

const environment = h("select", { id: "environment" },
  Object.entries(environments).map(([key, env]) => h("option", { value: key }, env.label)));
environment.value = profile?.environment || "mars";
inputs.environment = environment;

const error = h("p", { class: "error" });

const watchButton = suggested ? h("button", { type: "button", onclick: () => {
  for (const key of ["resting_hr", "sleep_hours", "age", "sex", "height_cm", "weight_kg"]) {
    if (suggested[key] !== null && suggested[key] !== undefined) inputs[key].value = suggested[key];
  }
} }, "Fill from my Apple Watch data") : null;

async function save(event) {
  event.preventDefault();
  const values = {};
  for (const [key, input] of Object.entries(inputs)) {
    values[key] = input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value.trim();
  }
  if (!values.name) { error.textContent = "Enter your name."; inputs.name.focus(); return; }
  await post("/api/profile", values);
  location.href = "index.html";
}

document.getElementById("app").append(
  h("h1", {}, profile ? "Your profile" : "Set up your profile"),
  h("p", { class: "muted" }, "Filled in once before the mission. These values are your personal baseline: the app compares every reading with what is normal for you."),
  h("form", { onsubmit: save, novalidate: true },
    h("section", { class: "card" }, h("h2", {}, "About you"), h("div", { class: "fields" }, FIELDS.map(field))),
    h("section", { class: "card" },
      h("div", { class: "row between" }, h("h2", {}, "Your pre-flight baseline"), watchButton),
      h("p", { class: "muted" }, "Leave a box empty to use a typical value."),
      h("div", { class: "fields" }, BASELINE.map(field))),
    h("section", { class: "card" }, h("h2", {}, "Medical notes for the flight surgeon"), h("div", { class: "fields" }, MEDICAL.map(field))),
    h("section", { class: "card" }, h("h2", {}, "Mission"),
      h("div", { class: "fields" },
        h("div", {}, h("label", { for: "environment" }, "Where you are"), environment),
        MISSION.map(field)),
      h("p", { class: "muted" }, "Your location sets the signal delay to Earth and the background radiation level.")),
    error,
    h("button", { class: "primary", type: "submit" }, profile ? "Save profile" : "Save and continue"),
  ),
);
