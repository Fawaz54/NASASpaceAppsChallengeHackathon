// Trends: the last 30 days of one reading against its normal band.
import { get } from "./api.js";
import { h, topbar } from "./common.js";
import { drawChart } from "./chart.js";

topbar("trends.html");
const app = document.getElementById("app");
const indicators = await get("/api/indicators");

const chartBox = h("div");
const title = h("h2");
const summary = h("p");
const about = h("div");
let current = Object.keys(indicators)[0];

const buttons = Object.entries(indicators).map(([metric, info]) =>
  h("button", { onclick: () => { current = metric; show(); } }, info.label));

async function show() {
  buttons.forEach((b, i) => b.classList.toggle("selected", Object.keys(indicators)[i] === current));
  const data = await get(`/api/history?metric=${current}`);
  const info = indicators[current];
  const last = data.values[data.values.length - 1];
  const inside = last >= data.band[0] && last <= data.band[1];
  title.textContent = `${info.label}, last ${data.values.length} days`;
  summary.textContent = `Today: ${last} ${data.unit}. Your usual level: ${Math.round(data.baseline * 10) / 10} ${data.unit}. `
    + (inside ? "Inside your normal range." : "Outside your normal range.");
  drawChart(chartBox, data.values, data.band, data.unit);
  about.replaceChildren(
    h("p", { class: "muted" }, "The shaded band is the normal range for you."),
    h("p", { class: "muted" }, h("strong", {}, "What it is: "), info.what),
    h("p", { class: "muted" }, h("strong", {}, "Why it matters in space: "), info.space));
}

app.append(
  h("h1", {}, "Trends"),
  h("div", { class: "row", style: "margin-bottom:14px" }, buttons),
  h("section", { class: "card" }, title, summary, chartBox, about),
);
show();
setInterval(show, 5000);
