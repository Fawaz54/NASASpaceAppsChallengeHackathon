// The round lens that follows the pointer over the 3D body and inverts what is
// under it (light becomes dark, and the status colours stay recognisable).
// The normal pointer is left alone everywhere. Touch screens get no lens.
import { h } from "./common.js";

// view: the element the pointer moves over. frame: the element the lens is placed in.
export function attachLens(view, frame) {
  const lens = h("div", { class: "stage-lens", "aria-hidden": "true" });
  frame.append(lens);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const target = { x: 0, y: 0 };
  const shown = { x: 0, y: 0 };
  let moving = false;
  let inside = false;

  function follow() {
    const ease = calm.matches ? 1 : 0.22;
    shown.x += (target.x - shown.x) * ease;
    shown.y += (target.y - shown.y) * ease;
    lens.style.translate = `${shown.x}px ${shown.y}px`;
    moving = Math.abs(target.x - shown.x) + Math.abs(target.y - shown.y) > 0.1;
    if (moving) requestAnimationFrame(follow);
  }

  view.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const box = frame.getBoundingClientRect();
    target.x = event.clientX - box.left;
    target.y = event.clientY - box.top;
    if (!inside) {   // appear where the pointer is, not slide in from the corner
      inside = true;
      shown.x = target.x;
      shown.y = target.y;
      lens.classList.add("on");
    }
    if (!moving) { moving = true; requestAnimationFrame(follow); }
  });
  view.addEventListener("pointerleave", () => { inside = false; lens.classList.remove("on"); });
  view.addEventListener("pointerdown", () => lens.classList.add("down"));
  addEventListener("pointerup", () => lens.classList.remove("down"));
}
