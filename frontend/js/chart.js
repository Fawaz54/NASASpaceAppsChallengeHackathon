// Draws one reading over time as a line, with labelled axes, tick marks,
// a shaded band for the normal range and an optional crew-average line.
import { svg } from "./common.js";

const W = 560, H = 250, LEFT = 58, RIGHT = 16, TOP = 14, BOTTOM = 48;

function niceStep(span, target) {
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= rough);
}

export function drawChart(container, { values, band, unit, label, average }) {
  const all = [...values, ...band, ...(average ? [average] : [])];
  const low = Math.min(...all), high = Math.max(...all);
  const step = niceStep((high - low) || 1, 4);
  const min = Math.floor((low - step * 0.3) / step) * step;
  const max = Math.ceil((high + step * 0.3) / step) * step;
  const x = (i) => LEFT + (i / (values.length - 1)) * (W - LEFT - RIGHT);
  const y = (v) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  const text = (content, attrs) => { const node = svg("text", attrs); node.textContent = content; return node; };
  const tidy = (v) => String(Math.round(v * 100) / 100);

  const last = values[values.length - 1];
  const outside = last < band[0] || last > band[1];
  const parts = [svg("rect", { class: "band", x: LEFT, y: y(band[1]), width: W - LEFT - RIGHT, height: Math.max(2, y(band[0]) - y(band[1])) })];

  // y axis: ticks, grid lines and values
  for (let v = min; v <= max + step / 1000; v += step) {
    parts.push(svg("line", { class: "grid", x1: LEFT, y1: y(v), x2: W - RIGHT, y2: y(v) }),
      svg("line", { class: "axis", x1: LEFT - 5, y1: y(v), x2: LEFT, y2: y(v) }),
      text(tidy(v), { x: LEFT - 9, y: y(v) + 4, "text-anchor": "end" }));
  }
  // x axis: a dated tick every five days
  const today = new Date();
  for (let i = values.length - 1; i >= 0; i -= 5) {
    const day = new Date(today);
    day.setDate(today.getDate() - (values.length - 1 - i));
    parts.push(svg("line", { class: "axis", x1: x(i), y1: H - BOTTOM, x2: x(i), y2: H - BOTTOM + 5 }),
      text(day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), { x: x(i), y: H - BOTTOM + 18, "text-anchor": "middle" }));
  }
  parts.push(
    svg("line", { class: "axis", x1: LEFT, y1: TOP, x2: LEFT, y2: H - BOTTOM }),
    svg("line", { class: "axis", x1: LEFT, y1: H - BOTTOM, x2: W - RIGHT, y2: H - BOTTOM }),
    text(`${label} (${unit})`, { class: "title", transform: `translate(14 ${(TOP + H - BOTTOM) / 2}) rotate(-90)`, "text-anchor": "middle" }),
    text("Date", { class: "title", x: (LEFT + W - RIGHT) / 2, y: H - 8, "text-anchor": "middle" }));
  if (average) {
    parts.push(svg("line", { class: "average", x1: LEFT, y1: y(average), x2: W - RIGHT, y2: y(average) }),
      text(`Crew average ${tidy(average)}`, { x: W - RIGHT - 4, y: y(average) - 5, "text-anchor": "end" }));
  }
  parts.push(
    svg("polyline", { class: `line ${outside ? "out" : ""}`, points: values.map((v, i) => `${x(i)},${y(v)}`).join(" ") }),
    svg("circle", { cx: x(values.length - 1), cy: y(last), r: 4.5, fill: outside ? "var(--act)" : "var(--accent)" }));

  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": `${label} over the last ${values.length} days. Latest value ${last} ${unit}. Normal range ${tidy(band[0])} to ${tidy(band[1])}.` }, ...parts);
  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  wrap.append(chart);
  container.replaceChildren(wrap);
}
