// Who is signed in, and the light/dark choice. There are no passwords in this demo.
// The signed-in user is kept per browser tab, so one tab can be an astronaut
// and another the flight surgeon. The theme is remembered for the whole browser.
const KEY = "crewhealth.user";
const THEME = "crewhealth.theme";

function read(store, key) {
  try { return store().getItem(key); } catch { return null; }
}
function write(store, key, value) {
  try { value === null ? store().removeItem(key) : store().setItem(key, value); } catch { /* storage blocked */ }
}
const tab = () => sessionStorage;
const browser = () => localStorage;

export const session = {
  get() {
    try { return JSON.parse(read(tab, KEY)); } catch { return null; }
  },
  set(user) { write(tab, KEY, JSON.stringify(user)); },
  clear() { write(tab, KEY, null); },
};

export function applyTheme() {
  document.documentElement.dataset.theme = read(browser, THEME) === "dark" ? "dark" : "light";
}
export function toggleTheme() {
  write(browser, THEME, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  applyTheme();
}
applyTheme();
