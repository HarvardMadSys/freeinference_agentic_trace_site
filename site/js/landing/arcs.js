/**
 * The arithmetic of a donut: each slice's share of the total, and the SVG path of its ring segment. Angles are in
 * radians, clockwise from the top; the donut is centred on the origin. Plain functions, tested with `node --test`.
 */

const FULL_TURN = 2 * Math.PI;

// A slice this close to the full turn is drawn as a whole ring: an arc whose ends meet would draw nothing.
const WHOLE_RING_TOLERANCE = 1e-9;

/** Each of `slices` (`[{ name, count }]`) with its `share` of their total count, in their order. */
export function sliceShares(slices) {
  let total = 0;
  for (const slice of slices) {
    total += slice.count;
  }
  return slices.map((slice) => ({ ...slice, share: slice.count / total }));
}

/**
 * The ring segments of `slices` (`[{ name, count }]`) between `innerRadius` and `outerRadius`, in their order,
 * clockwise from the top: each slice with its `share`, its `startAngle` and `endAngle`, and its SVG `path`.
 */
export function donutArcs(slices, outerRadius, innerRadius) {
  const arcs = [];
  let startAngle = 0;
  for (const slice of sliceShares(slices)) {
    const endAngle = startAngle + slice.share * FULL_TURN;
    const path = ringSegmentPath(startAngle, endAngle, outerRadius, innerRadius);
    arcs.push({ ...slice, startAngle, endAngle, path });
    startAngle = endAngle;
  }
  return arcs;
}

/** The point at `angle` (clockwise from the top) on the circle of `radius` round the origin, as "x y". */
export function pointAt(angle, radius) {
  return `${round(radius * Math.sin(angle))} ${round(-radius * Math.cos(angle))}`;
}

/**
 * The SVG path of the ring segment from `startAngle` to `endAngle` between the two radii: along the outer circle,
 * in to the inner one, and back along it. A segment of the full turn is the whole ring, two circles drawn as halves.
 */
export function ringSegmentPath(startAngle, endAngle, outerRadius, innerRadius) {
  if (endAngle - startAngle >= FULL_TURN - WHOLE_RING_TOLERANCE) {
    return wholeRingPath(outerRadius, innerRadius);
  }
  // An arc longer than half the circle needs SVG's large-arc flag, or the shorter way round is drawn.
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${pointAt(startAngle, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pointAt(endAngle, outerRadius)}`,
    `L ${pointAt(endAngle, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pointAt(startAngle, innerRadius)}`,
    "Z",
  ].join(" ");
}

// The whole ring: the outer circle and the inner one, each as two half arcs, filled with the even-odd rule so the
// inner circle is a hole.
function wholeRingPath(outerRadius, innerRadius) {
  const halfTurn = Math.PI;
  return [
    `M ${pointAt(0, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${pointAt(halfTurn, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${pointAt(0, outerRadius)}`,
    `M ${pointAt(0, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${pointAt(halfTurn, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${pointAt(0, innerRadius)}`,
    "Z",
  ].join(" ");
}

// A coordinate to a hundredth of a pixel, so a path's text stays short; -0 is written as 0.
function round(value) {
  return Math.round(value * 100) / 100 + 0;
}
