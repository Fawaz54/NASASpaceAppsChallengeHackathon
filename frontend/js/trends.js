// Trends: the last 30 days of one reading against its normal band.
import { get } from "./api.js";
import { h, topbar, requireUser } from "./common.js";
import { drawChart } from "./chart.js";

await requireUser("astronaut");
topbar("trends.html");
const app = document.getElementById("app");
const indicators = await get("/api/indicators");
const names = Object.keys(indicators);

const chartBox = h("div");
const title = h("h2");
const summary = h("p");
const about = h("div");
let current = names[0];

const buttons = names.map((metric) => h("button", { onclick: () => { current = metric; show(); } }, indicators[metric].label));

async function show() {
  buttons.forEach((b, i) => b.classList.toggle("selected", names[i] === current));
  const data = await get(`/api/history?metric=${current}`);
  const info = indicators[current];
  const last = data.values[data.values.length - 1];
  title.textContent = `${info.label}, last ${data.values.length} days`;
  summary.textContent = `Today: ${last} ${data.unit}. Your usual level: ${Math.round(data.baseline * 10) / 10} ${data.unit}.`
    + (data.crew_average ? ` Simulated crew average: ${data.crew_average} ${data.unit}.` : "");
  drawChart(chartBox, { values: data.values, band: data.band, unit: data.unit, label: data.label, average: data.crew_average });
  about.replaceChildren(
    h("p", { class: "muted small" }, "Shaded band: your normal range. Dashed line: average of the simulated crew of 100."),
    h("p", { class: "muted" }, h("strong", {}, "What it is: "), info.what),
    h("p", { class: "muted" }, h("strong", {}, "Why it matters in space: "), info.space));
}

app.append(
  h("h1", {}, "Trends"),
  h("div", { class: "row", style: "margin-bottom:14px" }, buttons),
  h("section", { class: "card" }, title, summary, chartBox, about));
show();
setInterval(show, 5000);
