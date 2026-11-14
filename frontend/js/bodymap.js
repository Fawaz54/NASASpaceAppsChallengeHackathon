// Owner: Frontend 2. Tappable body figure, front and back.
// Region names must match docs/contract.md exactly.
export const REGIONS = [
  "Head", "Neck", "Chest", "Abdomen", "Upper back", "Lower back",
  "Left arm", "Right arm", "Left leg", "Right leg",
];

// TODO: draw the figure as an SVG inside `container`, one shape per region.
// TODO: tapping a region toggles it and asks for a severity from 1 to 10.
// TODO: return the marked regions as [{region, severity}].
export function createBodyMap(container) {
  throw new Error("Frontend 2: build the body map here");
}
