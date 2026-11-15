// The body figure on the home screen: a slowly turning cloud of points with the
// organs inside it. Only organs that a reading feeds are shown: brain (sleep),
// lungs (blood oxygen), heart (heart rate and blood pressure), abdomen
// (temperature, blood sugar, water) and bones and muscles (exercise). The loose
// halo of points round the body is radiation exposure.
//
// Moving it: it turns on its own, drag to turn and tilt it (the tilt springs
// back), scroll or pinch to zoom, or use the + and − buttons. A round lens
// follows the pointer over it and inverts the colours underneath. Every organ is
// also a button in the list beside the figure, so nothing needs the mouse.
//
// The points are read from models/body.bin (made by tools/build_body.py).
import * as THREE from "./vendor/three.module.min.js";
import { h, svg, MARK, STATUS } from "./common.js";
import { attachLens } from "./cursor.js";

THREE.ColorManagement.enabled = false;   // colours go to the screen exactly as written in theme.css

// [area, name, what feeds it, how far to zoom in when it is chosen], listed top to bottom
const AREAS = [
  ["radiation", "Radiation", "whole-body exposure", 1],
  ["mind", "Brain", "sleep", 2.7],
  ["lungs", "Lungs", "blood oxygen", 2.1],
  ["heart", "Heart", "heart rate and blood pressure", 2.6],
  ["general", "Abdomen", "temperature, blood sugar and water", 2.2],
  ["bone", "Bones and muscles", "exercise", 1.15],
];

// How each group of points is drawn: point size, how deep the shape is (for shading),
// and a tone that sets the organs apart when they all share one status colour
// (above 0 is lighter, below 0 is deeper).
const LOOK = {
  body: { size: 0.0092, shell: true, reach: 0.3 },
  radiation: { size: 0.012, twinkle: 0.75 },
  mind: { size: 0.0135, reach: 0.09, tone: 0.06 },
  lungs: { size: 0.0125, reach: 0.11, tone: 0.3 },
  heart: { size: 0.015, reach: 0.07, tone: -0.22 },
  general: { size: 0.0128, reach: 0.12, tone: 0.16 },
  bone: { size: 0.0115, reach: 0.2, tone: 0.1 },
};

const VIEW_ANGLE = 26;          // camera field of view, in degrees
const MAX_TILT = THREE.MathUtils.degToRad(25);
const MAX_ZOOM = 4.5;
const calm = matchMedia("(prefers-reduced-motion: reduce)");

const VERTEX = `
  attribute float seed;
  uniform float uSize, uPixel, uPulse, uShell, uTime, uTwinkle, uReach;
  uniform vec3 uCentre;
  varying float vAlpha;
  varying float vNear;
  void main() {
    vec3 p = uCentre + (position - uCentre) * (1.0 + uPulse);
    vec4 seen = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * seen;
    float alpha = 0.72 + 0.28 * seed;
    if (uShell > 0.5) {   // the skin: dense along the outline, faint where it faces you, fainter still on the far side
      float facing = normalize(normalMatrix * normal).z;
      alpha *= mix(1.0, 0.1, pow(abs(facing), 0.9)) * (facing < 0.0 ? 0.45 : 1.0);
    }
    // 1 for points on the side nearest to you, -1 for the far side
    vNear = clamp((seen.z - (modelViewMatrix * vec4(uCentre, 1.0)).z) / uReach, -1.0, 1.0);
    alpha *= 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.5 + seed * 1.6) + seed * 40.0));
    vAlpha = alpha;
    gl_PointSize = max(1.2, uSize * uPixel * (0.7 + 0.6 * seed) / -seen.z);
  }`;
const FRAGMENT = `
  uniform vec3 uColor, uPaper, uInk;
  uniform float uOpacity, uRing, uTone;
  varying float vAlpha;
  varying float vNear;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float shape = smoothstep(0.5, 0.34, d);
    if (uRing > 0.5) shape *= smoothstep(0.2, 0.3, d) + smoothstep(0.12, 0.06, d);
    float alpha = shape * vAlpha * uOpacity;
    if (alpha < 0.02) discard;
    // Far points fade toward the page and near ones deepen, so each organ reads as a solid shape.
    vec3 colour = mix(uColor, uTone > 0.0 ? uPaper : uInk, abs(uTone));
    colour = mix(colour, uPaper, 0.5 * max(-vNear, 0.0));
    colour = mix(colour, uInk, 0.2 * max(vNear, 0.0));
    gl_FragColor = vec4(colour, alpha);
  }`;

async function loadCloud() {
  const response = await fetch(new URL("../models/body.bin", import.meta.url));
  if (!response.ok) throw new Error("body.bin is missing");
  const raw = await response.arrayBuffer();
  const length = new DataView(raw).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, length)));
  const count = header.count;
  const packed = new Int16Array(raw, 8 + length, count * 3);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i += 1) positions[i] = (packed[i] / 32767) * header.extent;
  return {
    header, positions,
    normals: new Int8Array(raw, 8 + length + count * 6, count * 3),
    seeds: new Uint8Array(raw, 8 + length + count * 9, count),
  };
}

function pointMaterial(options) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uSize: { value: options.size },
      uPixel: { value: 1 }, uPulse: { value: 0 }, uCentre: { value: new THREE.Vector3(...(options.centre || [0, 0, 0])) },
      uShell: { value: options.shell ? 1 : 0 }, uTime: { value: 0 }, uTwinkle: { value: options.twinkle || 0 },
      uRing: { value: options.ring ? 1 : 0 }, uReach: { value: options.reach || 1000 }, uTone: { value: options.tone || 0 },
      uPaper: { value: new THREE.Color() }, uInk: { value: new THREE.Color() },
    },
    transparent: !options.solid, depthWrite: !!options.solid, depthTest: options.depthTest !== false,
    alphaToCoverage: !!options.solid,
  });
}

// options.onSelect(area) is called when an organ is chosen; area is null when the choice is cleared.
export function createOrganFigure(container, { onSelect }) {
  let statuses = {};
  let selected = null;
  let hovered = null;

  // ----- the page parts: the 3D view, the list of organs, the lines between them, zoom buttons -----
  const view = h("div", { class: "stage-view", "aria-hidden": "true" });
  const lines = svg("svg", { class: "stage-lines", "aria-hidden": "true" });
  const keys = {};
  const rail = h("ul", { class: "stage-rail", "aria-label": "Organs and their status" }, AREAS.map(([area, name, feeds]) => {
    const key = h("button", { class: "organ-key", type: "button",
      onclick: () => onSelect(selected === area ? null : area),
      onpointerenter: () => { hovered = area; }, onpointerleave: () => { if (hovered === area) hovered = null; },
      onfocus: () => { hovered = area; }, onblur: () => { if (hovered === area) hovered = null; } },
      h("span", { class: "dot", "aria-hidden": "true" }),
      h("span", { class: "name" }, name), h("span", { class: "mark", "aria-hidden": "true" }),
      h("span", { class: "feeds" }, feeds));
    const line = svg("path", {});
    const pin = svg("circle", { r: 2.5 });
    lines.append(line, pin);
    keys[area] = { key, line, pin, name, feeds };
    return h("li", {}, key);
  }));
  const zoomBy = (factor) => { zoomTo(goal.zoom * factor); };
  const tools = h("div", { class: "stage-tools" },
    h("button", { type: "button", class: "icon", "aria-label": "Zoom out", onclick: () => zoomBy(1 / 1.45) }, "−"),
    h("button", { type: "button", class: "icon", "aria-label": "Zoom in", onclick: () => zoomBy(1.45) }, "+"),
    h("button", { type: "button", onclick: () => { goal.zoom = 1; goal.focus.set(0, 0, 0); turn.offset = 0; if (selected) onSelect(null); } }, "Reset view"));
  const hint = h("p", { class: "stage-hint" }, "Drag to turn. Scroll or pinch to zoom.");
  const frame = h("div", { class: "stage-frame" }, view, tools, hint);
  const stage = h("div", { class: "stage" }, frame, lines, rail);
  attachLens(view, frame);
  container.replaceChildren(stage);

  // ----- the 3D scene -----
  const goal = { zoom: 1, focus: new THREE.Vector3() };
  const now = { zoom: 1, focus: new THREE.Vector3() };
  const turn = { angle: -0.5, offset: 0, speed: 0, push: 0, tilt: 0, tiltGoal: 0, lean: 0, leanGoal: 0 };
  let renderer, camera, scene, pivot, distance = 10, width = 1, height = 1;
  let groups = {};        // area -> {material, centre, samples}
  let painMarks = null, painSpots = {}, anchors = {};
  let heartRate = 64;
  let ready = false;

  function zoomTo(value, towards) {
    const next = Math.min(MAX_ZOOM, Math.max(1, value));
    if (towards) goal.focus.sub(towards).multiplyScalar(goal.zoom / next).add(towards);  // keep that spot under the pointer
    goal.zoom = next;
    const room = 1 - 1 / next;                                                              // no sideways drift when zoomed out
    goal.focus.set(THREE.MathUtils.clamp(goal.focus.x, -0.7 * room, 0.7 * room), THREE.MathUtils.clamp(goal.focus.y, -1.5 * room, 1.5 * room), 0);
  }

  function colours() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim() || "#888";
    return { paper: read("--bg"), ink: read("--text"), body: read("--pt-body"), ok: read("--pt-ok"), watch: read("--pt-watch"), act: read("--pt-act"), neutral: read("--pt-neutral"), quiet: read("--pt-quiet") };
  }
  let palette = colours();
  new MutationObserver(() => { palette = colours(); refreshKeys(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function refreshKeys() {
    for (const [area, { key, name, feeds }] of Object.entries(keys)) {
      const status = statuses[area] || "neutral";
      key.className = `organ-key ${status}${selected === area ? " chosen" : ""}`;
      key.setAttribute("aria-pressed", String(selected === area));
      key.setAttribute("aria-label", `${name}: ${feeds}. ${STATUS[status] || ""}`);
      key.querySelector(".mark").textContent = MARK[status] || "";
    }
  }
  refreshKeys();

  function resize() {
    width = view.clientWidth || 1;
    height = view.clientHeight || 1;
    if (!renderer) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Far enough back to fit the whole figure, top to toe and hand to hand.
    const span = Math.max(2.55, 1.6 / camera.aspect);
    distance = span / 2 / Math.tan(THREE.MathUtils.degToRad(VIEW_ANGLE / 2));
    camera.updateProjectionMatrix();
    lines.setAttribute("viewBox", `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
  }

  async function start() {
    const cloud = await loadCloud();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    view.append(renderer.domElement);
    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, 1, 0.1, 100);
    scene = new THREE.Scene();
    pivot = new THREE.Group();
    scene.add(pivot);

    for (const group of cloud.header.groups) {
      const from = group.start * 3, to = (group.start + group.count) * 3;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(cloud.positions.slice(from, to), 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(cloud.normals.slice(from, to), 3, true));
      geometry.setAttribute("seed", new THREE.BufferAttribute(cloud.seeds.slice(group.start, group.start + group.count), 1, true));
      const organ = group.area !== "body" && group.area !== "radiation";
      const look = LOOK[group.area];
      const material = pointMaterial({ ...look, centre: group.centre, solid: organ });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.renderOrder = organ ? 0 : 1;
      pivot.add(points);
      // A thinned copy of the points, used to work out what the pointer is over.
      const step = Math.max(1, Math.floor(group.count / 420));
      const samples = [];
      for (let i = from; i < to; i += 3 * step) samples.push(cloud.positions[i], cloud.positions[i + 1], cloud.positions[i + 2]);
      groups[group.area] = { material, centre: group.centre, samples, size: look.size, opacity: 1, grow: 1 };
    }
    anchors = cloud.header.anchors;
    painSpots = cloud.header.pain;

    painMarks = new THREE.Points(new THREE.BufferGeometry(), pointMaterial({ size: 0.075, ring: true, depthTest: false }));
    painMarks.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    painMarks.geometry.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(0), 1));
    painMarks.frustumCulled = false;
    painMarks.renderOrder = 2;
    pivot.add(painMarks);

    new ResizeObserver(resize).observe(stage);
    resize();
    listen();
    ready = true;
    stage.classList.add("ready");
    showPain();
    lookAtChoice();
    let visible = true;
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(stage);
    let last = performance.now();
    (function frame(time) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      if (visible && !document.hidden) draw(time / 1000, dt);
    })(last);
  }

  // ----- pointer: hover, drag to turn, pinch and scroll to zoom -----
  const pointer = { x: -1, y: -1, inside: false };
  const touches = new Map();
  let drag = null;

  function spotUnder(event) {   // the place in the scene (at the figure's depth) under the pointer
    const box = view.getBoundingClientRect();
    const half = Math.tan(THREE.MathUtils.degToRad(VIEW_ANGLE / 2)) * distance / now.zoom;
    return new THREE.Vector3(
      now.focus.x + ((event.clientX - box.left) / box.width * 2 - 1) * half * camera.aspect,
      now.focus.y - ((event.clientY - box.top) / box.height * 2 - 1) * half, 0);
  }

  function listen() {
    view.addEventListener("pointerdown", (event) => {
      touches.set(event.pointerId, event);
      view.setPointerCapture(event.pointerId);
      const box = view.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      hovered = whatIsUnderPointer();   // a tap on a touch screen has no hover before it
      if (touches.size === 1) drag = { x: event.clientX, y: event.clientY, startY: event.clientY, moved: 0 };
      else drag = null;
      stage.classList.add("dragging");
    });
    view.addEventListener("pointermove", (event) => {
      const box = view.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.inside = true;
      if (touches.size === 2 && touches.has(event.pointerId)) {   // pinch
        const [a, b] = [...touches.values()];
        const before = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        touches.set(event.pointerId, event);
        const [c, d] = [...touches.values()];
        zoomTo(goal.zoom * Math.hypot(c.clientX - d.clientX, c.clientY - d.clientY) / (before || 1));
        return;
      }
      if (!drag) return;
      const dx = event.clientX - drag.x;
      drag.moved += Math.abs(dx) + Math.abs(event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
      turn.offset += dx * 0.008;
      turn.push = dx * 0.008;
      turn.tiltGoal = THREE.MathUtils.clamp((event.clientY - drag.startY) * 0.006, -MAX_TILT, MAX_TILT);
    });
    const release = (event) => {
      touches.delete(event.pointerId);
      if (drag && drag.moved < 6 && event.type === "pointerup") onSelect(hovered && hovered !== selected ? hovered : null);
      if (touches.size === 0) { drag = null; turn.tiltGoal = 0; stage.classList.remove("dragging"); }
    };
    view.addEventListener("pointerup", release);
    view.addEventListener("pointercancel", release);
    view.addEventListener("pointerleave", () => { pointer.inside = false; if (!drag) hovered = null; });
    view.addEventListener("wheel", (event) => {
      // Scrolling down when fully zoomed out is left alone, so the page still scrolls.
      const next = Math.min(MAX_ZOOM, Math.max(1, goal.zoom * Math.exp(-event.deltaY * 0.0016)));
      if (next === goal.zoom) return;
      event.preventDefault();
      zoomTo(next, spotUnder(event));
    }, { passive: false });
    // Like the page it is modelled on: scrolling the page also turns the figure a little.
    let scrolled = scrollY;
    addEventListener("scroll", () => { if (!calm.matches) turn.offset += (scrollY - scrolled) * 0.0022; scrolled = scrollY; }, { passive: true });
  }

  const probe = new THREE.Vector3();
  function whatIsUnderPointer() {
    let best = null, bestScore = Infinity;
    for (const [area, group] of Object.entries(groups)) {
      if (area === "body") continue;
      const reach = area === "radiation" ? 9 : 15;
      for (let i = 0; i < group.samples.length; i += 3) {
        probe.set(group.samples[i], group.samples[i + 1], group.samples[i + 2]).applyMatrix4(pivot.matrixWorld).project(camera);
        const gap = Math.hypot((probe.x + 1) / 2 * width - pointer.x, (1 - probe.y) / 2 * height - pointer.y);
        if (gap > reach) continue;
        const score = gap + probe.z * 400 + (area === "radiation" ? 1000 : 0);   // prefer what is nearer to you; the halo last
        if (score < bestScore) { bestScore = score; best = area; }
      }
    }
    return best;
  }

  // ----- one frame -----
  function draw(time, dt) {
    const still = calm.matches;
    // Turning: a steady drift, slower while you are pointing at it, plus whatever the last drag left behind.
    const drift = still || drag ? 0 : pointer.inside ? 0.035 : selected ? 0.1 : 0.2;
    turn.speed += (drift - turn.speed) * 0.06;
    turn.angle += turn.speed * dt;
    if (!drag) { turn.offset += turn.push; turn.push *= 0.92; }
    turn.tilt += (turn.tiltGoal - turn.tilt) * 0.08;
    pivot.rotation.set(0.06 + turn.tilt, turn.angle + turn.offset, 0);

    now.zoom += (goal.zoom - now.zoom) * 0.09;
    now.focus.lerp(goal.focus, 0.09);
    camera.position.set(now.focus.x, now.focus.y + 0.12 / now.zoom, distance / now.zoom);
    camera.lookAt(now.focus.x, now.focus.y, 0);
    pivot.updateMatrixWorld();
    camera.updateMatrixWorld();

    if (pointer.inside && !drag) hovered = whatIsUnderPointer();
    view.style.cursor = hovered && pointer.inside ? "pointer" : drag ? "grabbing" : "grab";

    const pixel = height * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(VIEW_ANGLE / 2)));
    const beat = (time * heartRate / 60) % 1;
    const pulse = { heart: still ? 0 : 0.05 * (Math.exp(-(((beat - 0.08) / 0.05) ** 2)) + 0.55 * Math.exp(-(((beat - 0.3) / 0.06) ** 2))),
      lungs: still ? 0 : 0.022 * Math.sin(time * 2 * Math.PI / 4.6) };
    for (const [area, group] of Object.entries(groups)) {
      const status = statuses[area] || "neutral";
      const uniforms = group.material.uniforms;
      let opacity = 1, grow = 1, colour = palette[status] || palette.neutral;
      if (area === "body") { colour = palette.body; opacity = selected && selected !== "radiation" ? 0.5 : 0.92; }
      else if (area === "radiation") {
        colour = status === "neutral" ? palette.quiet : palette[status];
        opacity = selected === "radiation" || hovered === "radiation" ? 1 : selected ? 0.25 : status === "act" ? 0.95 : status === "watch" ? 0.8 : 0.55;
        grow = selected === "radiation" || hovered === "radiation" ? 1.5 : status === "act" ? 1.35 + (still ? 0 : 0.25 * Math.sin(time * 7)) : 1;
      } else {
        opacity = selected && selected !== area && hovered !== area ? 0.2 : 1;
        grow = hovered === area || selected === area ? 1.22 : 1;
        if (status === "act" && !still) grow *= 1.12 + 0.14 * Math.sin(time * 7);   // an organ in danger throbs
      }
      group.opacity += (opacity - group.opacity) * 0.12;
      group.grow += (grow - group.grow) * 0.12;
      uniforms.uOpacity.value = group.opacity;
      uniforms.uSize.value = group.size * group.grow / Math.sqrt(now.zoom);   // points stay fine when you zoom in
      uniforms.uColor.value.set(colour);
      uniforms.uPaper.value.set(palette.paper);
      uniforms.uInk.value.set(palette.ink);
      uniforms.uPixel.value = pixel;
      uniforms.uTime.value = still ? 0 : time;
      uniforms.uPulse.value = pulse[area] || 0;
    }
    const mark = painMarks.material.uniforms;
    mark.uColor.value.set(palette.act);
    mark.uPixel.value = pixel;
    mark.uSize.value = 0.075 * (still ? 1 : 1 + 0.12 * Math.sin(time * 3)) / Math.sqrt(now.zoom);
    renderer.render(scene, camera);
    drawLines();
    for (const [area, { key }] of Object.entries(keys)) key.classList.toggle("near", hovered === area);
  }

  // The thin lines from each name in the list to its organ. They follow the figure as it turns.
  function drawLines() {
    const railBox = rail.getBoundingClientRect(), stageBox = stage.getBoundingClientRect(), viewBox = view.getBoundingClientRect();
    const beside = railBox.left > viewBox.left + viewBox.width * 0.5 && railBox.top < viewBox.bottom;   // list sits to the right, not underneath
    for (const [area, { key, line, pin }] of Object.entries(keys)) {
      const spot = anchors[area];
      let show = beside && !!spot && (now.zoom < 1.2 || selected === area);
      if (show) {
        probe.set(spot[0], spot[1], spot[2]).applyMatrix4(pivot.matrixWorld).project(camera);
        const x = viewBox.left - stageBox.left + (probe.x + 1) / 2 * viewBox.width;
        const y = viewBox.top - stageBox.top + (1 - probe.y) / 2 * viewBox.height;
        const box = key.getBoundingClientRect();
        const fromX = box.left - stageBox.left - 4, fromY = box.top - stageBox.top + box.height / 2;
        show = y > 4 && y < viewBox.height - 4 && x < fromX - 30;
        if (show) {
          line.setAttribute("d", `M${fromX} ${fromY}H${fromX - 22}L${x.toFixed(1)} ${y.toFixed(1)}`);
          pin.setAttribute("cx", x.toFixed(1));
          pin.setAttribute("cy", y.toFixed(1));
        }
      }
      const lit = hovered === area || selected === area;
      line.setAttribute("class", `${show ? "" : "off"}${lit ? " lit" : ""}`);
      pin.setAttribute("class", `${show ? "" : "off"}${lit ? " lit" : ""}`);
    }
  }

  // Moves in on the chosen organ, or back out to the whole figure.
  function lookAtChoice() {
    const area = AREAS.find(([id]) => id === selected);
    if (!ready) return;
    if (!area) { goal.zoom = 1; goal.focus.set(0, 0, 0); return; }
    goal.focus.set(0, selected === "radiation" ? 0 : groups[selected].centre[1], 0);
    zoomTo(area[3]);
  }

  let painRegions = [];
  function showPain() {
    if (!ready) return;
    const spots = painRegions.filter((region) => painSpots[region]).flatMap((region) => painSpots[region]);
    painMarks.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(spots), 3));
    painMarks.geometry.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(spots.length / 3).fill(0.5), 1));
    painMarks.visible = spots.length > 0;
  }

  start().catch(() => {
    stage.classList.add("flat");
    view.replaceChildren(h("p", { class: "muted" }, "The 3D figure could not start in this browser. The list still shows every organ and its status."));
  });

  return {
    // statuses: {area: "ok" | "watch" | "act" | "neutral"}; chosen is the area that is open, if any.
    paint(next, chosen) {
      statuses = next;
      if ((chosen || null) !== selected) {
        selected = chosen || null;
        lookAtChoice();
      }
      refreshKeys();
    },
    // Rings where the crew member reported pain.
    markPain(regions) {
      painRegions = regions;
      showPain();
    },
    // The heart beats at the crew member's own rate.
    setHeartRate(bpm) {
      if (Number.isFinite(bpm) && bpm > 20 && bpm < 240) heartRate = bpm;
    },
  };
}
