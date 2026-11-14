// Draws one metric over time as a line, with a shaded band for the normal range.
import { svg } from "./common.js";

const W = 600, H = 200, LEFT = 44, RIGHT = 12, TOP = 12, BOTTOM = 26;

export function drawChart(container, values, band, unit = "") {
  const low = Math.min(...values, band[0]);
  const high = Math.max(...values, band[1]);
  const pad = (high - low) * 0.12 || 1;
  const min = low - pad, max = high + pad;
  const x = (i) => LEFT + (i / (values.length - 1)) * (W - LEFT - RIGHT);
  const y = (v) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);

  const last = values[values.length - 1];
  const outside = last < band[0] || last > band[1];
  const text = (content, attrs) => { const node = svg("text", attrs); node.textContent = content; return node; };
  const round = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": `Last ${values.length} days. Latest value ${last} ${unit}. Normal range ${round(band[0])} to ${round(band[1])}.` },
    svg("rect", { class: "band", x: LEFT, y: y(band[1]), width: W - LEFT - RIGHT, height: Math.max(2, y(band[0]) - y(band[1])) }),
    svg("line", { class: "axis", x1: LEFT, y1: H - BOTTOM, x2: W - RIGHT, y2: H - BOTTOM }),
    svg("polyline", { class: `line ${outside ? "out" : ""}`, points: values.map((v, i) => `${x(i)},${y(v)}`).join(" ") }),
    svg("circle", { cx: x(values.length - 1), cy: y(last), r: 4, fill: outside ? "var(--act)" : "var(--accent)" }),
    text(round(band[1]), { x: LEFT - 6, y: y(band[1]) + 4, "text-anchor": "end" }),
    text(round(band[0]), { x: LEFT - 6, y: y(band[0]) + 4, "text-anchor": "end" }),
    text(`${values.length} days ago`, { x: LEFT, y: H - 8 }),
    text("Today", { x: W - RIGHT, y: H - 8, "text-anchor": "end" }),
  );
  container.replaceChildren(chart);
}
