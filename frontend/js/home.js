// Owner: Frontend 1. Draws the home screen from the state in docs/contract.md.
import { getState, setScenario } from "./api.js";

const BADGE = { ok: "Normal for you", watch: "Watch", act: "Act now" };
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let shownAlert = null;

function render(state) {
  $("crew-name").textContent = state.crew.name;
  $("mission-day").textContent = `Mission day ${state.crew.mission_day}`;
  $("earth-delay").textContent = `Earth delay ${state.earth_link.delay_minutes} min each way`;

  const tiles = state.areas.map((area) => {
    const tile = el("div", `card tile ${area.status}`);
    tile.append(
      el("div", "muted", area.label),
      el("div", "value", `${area.value} ${area.unit}`),
      el("div", "badge", BADGE[area.status]),
    );
    return tile;
  });
  $("tiles").replaceChildren(...tiles);

  const alert = state.alert;
  $("banner").hidden = !alert;
  $("alert").hidden = !alert;
  // Only rebuild the checklist when the alert changes, so ticks survive refreshes.
  const alertId = alert ? alert.protocol_id : null;
  if (alert && alertId !== shownAlert) {
    $("banner").textContent = `${alert.title}. Follow the ${alert.steps.length} steps below.`;
    $("protocol").textContent = `Protocol ${alert.protocol_id}`;
    const steps = alert.steps.map((step) => {
      const item = el("li");
      const label = el("label");
      const box = el("input");
      box.type = "checkbox";
      label.append(box, step);
      item.append(label);
      return item;
    });
    $("steps").replaceChildren(...steps);
  }
  shownAlert = alertId;

  const link = state.earth_link;
  $("earth").textContent = link.summary_sent
    ? `Summary sent to flight surgeon. Reply expected in ${link.reply_eta_minutes} min.`
    : "No summary waiting to send to Earth.";
}

async function refresh() {
  render(await getState());
}

$("scenarios").addEventListener("click", async (event) => {
  const name = event.target.dataset.scenario;
  if (!name) return;
  await setScenario(name);
  refresh();
});

refresh();
setInterval(refresh, 3000);

// TODO (Frontend 1): chart of the alerting reading against its normal band,
// icons on the tiles, and the layout from the mockup.
