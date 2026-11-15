// The body figure on the home screen. Only organs that a reading feeds are
// coloured: brain (sleep), lungs (blood oxygen), heart (heart rate and blood
// pressure), abdomen (temperature, blood sugar, water) and bones and muscles
// (exercise). The dashed outline round the body is radiation exposure.
import { svg } from "./common.js";

// [area, label, tag, attributes]
const ORGANS = [
  ["mind", "Brain: sleep", "ellipse", { cx: 150, cy: 52, rx: 26, ry: 19 }],
  ["lungs", "Lungs: blood oxygen", "path", { d: "M141 148 C120 150 109 172 107 214 C106 236 118 242 141 232 Z" }],
  ["lungs", "Lungs: blood oxygen", "path", { d: "M159 148 C180 150 191 172 193 214 C194 236 182 242 159 232 Z" }],
  ["heart", "Heart: heart rate and blood pressure", "path", { d: "M150 222 C128 206 126 186 139 181 C146 179 150 185 150 189 C150 185 155 179 162 181 C175 186 172 206 150 222 Z" }],
  ["general", "Abdomen: temperature, blood sugar and water", "path", { d: "M118 256 C132 246 170 246 182 256 C192 276 186 304 150 308 C114 304 108 276 118 256 Z" }],
  ["bone", "Muscles: exercise", "ellipse", { cx: 79, cy: 196, rx: 10, ry: 30 }],
  ["bone", "Muscles: exercise", "ellipse", { cx: 221, cy: 196, rx: 10, ry: 30 }],
  ["bone", "Muscles: exercise", "ellipse", { cx: 127, cy: 440, rx: 11, ry: 28 }],
  ["bone", "Muscles: exercise", "ellipse", { cx: 173, cy: 440, rx: 11, ry: 28 }],
];
const BONES = [  // thigh bones
  ["bone", "Bones: exercise", { x1: 128, y1: 336, x2: 127, y2: 398 }],
  ["bone", "Bones: exercise", { x1: 172, y1: 336, x2: 173, y2: 398 }],
];
// Where reported pain is marked, by body region.
const PAIN_SPOT = {
  "Head": [150, 30], "Neck": [150, 108], "Chest": [150, 168], "Abdomen": [150, 280],
  "Upper back": [150, 140], "Lower back": [150, 300], "Left arm": [221, 250], "Right arm": [79, 250],
  "Left leg": [173, 400], "Right leg": [127, 400],
};

export function createOrganFigure(container, { onSelect }) {
  const root = svg("svg", { viewBox: "0 0 300 520", class: "organs", role: "group", "aria-label": "Body figure coloured by health status" });
  const clickable = (node, area, label) => {
    node.dataset.area = area;
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", label);
    const title = svg("title");
    title.textContent = label;
    node.append(title);
    node.addEventListener("click", () => onSelect(area));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(area); }
    });
    return node;
  };

  const glow = clickable(svg("rect", { x: 22, y: 6, width: 256, height: 508, rx: 110, class: "glow" }), "radiation", "Outline: radiation exposure");
  const skin = [
    svg("circle", { cx: 150, cy: 56, r: 40, class: "skin" }),
    svg("rect", { x: 138, y: 92, width: 24, height: 26, rx: 8, class: "skin" }),
    svg("path", { class: "skin", d: "M96 122 C116 112 184 112 204 122 C214 128 212 160 208 200 C204 250 204 290 200 328 L100 328 C96 290 96 250 92 200 C88 160 86 128 96 122 Z" }),
    svg("rect", { x: 64, y: 126, width: 30, height: 190, rx: 15, class: "skin" }),
    svg("rect", { x: 206, y: 126, width: 30, height: 190, rx: 15, class: "skin" }),
    svg("rect", { x: 104, y: 318, width: 44, height: 190, rx: 20, class: "skin" }),
    svg("rect", { x: 152, y: 318, width: 44, height: 190, rx: 20, class: "skin" }),
  ];
  const organs = ORGANS.map(([area, label, tag, attrs]) => clickable(svg(tag, { ...attrs, class: "organ" }), area, label));
  const bones = BONES.map(([area, label, attrs]) => clickable(svg("line", { ...attrs, class: "organ bone" }), area, label));
  root.append(glow, ...skin, ...bones, ...organs);
  container.replaceChildren(root);

  const markers = [];
  return {
    // statuses: {area: "ok" | "watch" | "act" | "neutral"}
    paint(statuses, selected) {
      for (const node of [...organs, ...bones]) {
        const bone = node.classList.contains("bone") ? " bone" : "";
        node.setAttribute("class", `organ${bone} ${statuses[node.dataset.area] || "neutral"}${node.dataset.area === selected ? " focus" : ""}`);
      }
      glow.setAttribute("class", `glow ${statuses.radiation || ""}${selected === "radiation" ? " focus" : ""}`);
    },
    markPain(regions) {
      markers.splice(0).forEach((marker) => marker.remove());
      for (const region of regions) {
        if (!PAIN_SPOT[region]) continue;
        const dot = svg("circle", { cx: PAIN_SPOT[region][0], cy: PAIN_SPOT[region][1], r: 6, class: "pain" });
        root.append(dot);
        markers.push(dot);
      }
    },
  };
}
