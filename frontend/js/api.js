// The only place the screens talk to the backend. Endpoints: docs/contract.md.
// Every request says who is signed in; if the backend answers "signin", go to the sign-in page.
import { session } from "./session.js";

function headers() {
  const user = session.get();
  return { "Content-Type": "application/json", ...(user ? { "X-User": user.username } : {}) };
}

async function read(response) {
  const data = await response.json();
  if (data && data.error === "signin") {
    session.clear();
    location.href = "login.html";
    return new Promise(() => {});  // the page is leaving; never resolves
  }
  return data;
}

export async function get(path) {
  return read(await fetch(path, { headers: headers() }));
}

export async function post(path, body = {}) {
  return read(await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) }));
}
