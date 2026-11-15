// First screen: sign in with a username, or create an astronaut or flight surgeon account.
// There are no passwords in this demo.
import { post } from "./api.js";
import { h, simpleBar } from "./common.js";
import { session } from "./session.js";

session.clear();
simpleBar("Crew Health");
const app = document.getElementById("app");

function enter(account) {
  session.set(account);
  location.href = account.role === "doctor" ? "doctor.html" : "index.html";
}

// ----- sign in -----
const username = h("input", { id: "username", type: "text", autocomplete: "username", placeholder: "Your username" });
const signInError = h("p", { class: "error" });
async function signIn(event) {
  event.preventDefault();
  if (!username.value.trim()) { signInError.textContent = "Enter your username."; return; }
  const result = await post("/api/login", { username: username.value });
  if (result.error) { signInError.textContent = result.error; return; }
  enter(result);
}

// ----- flight surgeon account -----
const doctorName = h("input", { id: "doctor-name", type: "text", placeholder: "Dr. Jordan Lee" });
const doctorUser = h("input", { id: "doctor-user", type: "text", placeholder: "jlee" });
const doctorError = h("p", { class: "error" });
const doctorForm = h("form", { hidden: true, onsubmit: async (event) => {
  event.preventDefault();
  const result = await post("/api/signup", { role: "doctor", full_name: doctorName.value, username: doctorUser.value });
  if (result.error) { doctorError.textContent = result.error; return; }
  enter(result);
} },
  h("div", { class: "fields", style: "margin-top:12px" },
    h("div", {}, h("label", { for: "doctor-name" }, "Full name"), doctorName),
    h("div", {}, h("label", { for: "doctor-user" }, "Username"), doctorUser)),
  doctorError,
  h("button", { class: "primary", type: "submit" }, "Create flight surgeon account"));

app.append(
  h("div", { class: "narrow" },
    h("h1", {}, "Welcome"),
    h("section", { class: "card" },
      h("h2", {}, "Sign in"),
      h("form", { onsubmit: signIn },
        h("label", { for: "username" }, "Username"), username, signInError,
        h("button", { class: "primary", type: "submit", style: "margin-top:8px" }, "Sign in"))),
    h("section", { class: "card" },
      h("h2", {}, "Create a new account"),
      h("p", { class: "muted" }, "Astronauts fill in a health profile. Flight surgeons only need a name."),
      h("div", { class: "row" },
        h("a", { class: "button", href: "profile.html" }, "I am an astronaut"),
        h("button", { onclick: () => { doctorForm.hidden = false; doctorName.focus(); } }, "I am a flight surgeon")),
      doctorForm)));
