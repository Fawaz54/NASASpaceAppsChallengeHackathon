// The tappable body figure, front and back. Used on the home screen (coloured
// by health status), the check-in and the emergency screen (to mark pain).
import { svg } from "./common.js";

export const REGIONS = [
  "Head", "Neck", "Chest", "Abdomen", "Upper back", "Lower back",
  "Left arm", "Right arm", "Left leg", "Right leg",
];

// [region, shape, attributes]. The back view is mirrored, so left and right swap sides.
function figure(x, torsoTop, torsoBottom, leftSide, rightSide) {
  return [
    ["Head", "circle", { cx: x, cy: 34, r: 18 }],
    ["Neck", "rect", { x: x - 7, y: 52, width: 14, height: 10, rx: 3 }],
    [torsoTop, "rect", { x: x - 27, y: 62, width: 54, height: 44, rx: 10 }],
    [torsoBottom, "rect", { x: x - 25, y: 108, width: 50, height: 38, rx: 8 }],
    [`${leftSide} arm`, "rect", { x: x - 46, y: 64, width: 16, height: 80, rx: 8 }],
    [`${rightSide} arm`, "rect", { x: x + 30, y: 64, width: 16, height: 80, rx: 8 }],
    [`${leftSide} leg`, "rect", { x: x - 25, y: 148, width: 23, height: 88, rx: 9 }],
    [`${rightSide} leg`, "rect", { x: x + 2, y: 148, width: 23, height: 88, rx: 9 }],
  ];
}

const SHAPES = [
  ...figure(90, "Chest", "Abdomen", "Right", "Left"),
  ...figure(250, "Upper back", "Lower back", "Left", "Right"),
];

// options.onTap(region) is called when a part is tapped.
// options.aura adds a dashed outline round each figure (used for whole-body radiation).
export function createBodyMap(container, options = {}) {
  const root = svg("svg", { viewBox: "0 0 340 262", class: "bodymap", role: "group", "aria-label": "Body figure, front and back" });
  const parts = [];
  let auras = [];

  if (options.aura) {
    auras = [90, 250].map((x) => {
      const ring = svg("rect", { x: x - 62, y: 6, width: 124, height: 238, rx: 24, class: "aura", tabindex: 0, role: "button", "aria-label": "Radiation, whole body" });
      ring.addEventListener("click", () => options.onAura?.());
      ring.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); options.onAura?.(); } });
      root.append(ring);
      return ring;
    });
  }

  for (const [region, tag, attrs] of SHAPES) {
    const part = svg(tag, { ...attrs, class: "part", tabindex: 0, role: "button", "aria-label": region });
    part.dataset.region = region;
    part.addEventListener("click", () => options.onTap?.(region));
    part.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); options.onTap?.(region); }
    });
    parts.push(part);
    root.append(part);
  }
  const front = svg("text", { x: 90, y: 258, "text-anchor": "middle" });
  front.textContent = "Front";
  const back = svg("text", { x: 250, y: 258, "text-anchor": "middle" });
  back.textContent = "Back";
  root.append(front, back);
  container.replaceChildren(root);

  const markers = [];
  return {
    // classes: {region: "ok" | "watch" | "act" | "picked" | ...}; anything not listed is cleared.
    paint(classes) {
      for (const part of parts) part.setAttribute("class", `part ${classes[part.dataset.region] || ""}`.trim());
    },
    focus(regions) {
      for (const part of parts) part.classList.toggle("focus", regions.includes(part.dataset.region));
    },
    setAura(status) {
      for (const ring of auras) ring.setAttribute("class", `aura ${status}`);
    },
    // Small dots where the crew member reported pain.
    markPain(regions) {
      markers.splice(0).forEach((marker) => marker.remove());
      for (const part of parts) {
        if (!regions.includes(part.dataset.region)) continue;
        const box = part.getBBox();
        const dot = svg("circle", { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: 5, class: "pain" });
        root.append(dot);
        markers.push(dot);
      }
    },
  };
}
