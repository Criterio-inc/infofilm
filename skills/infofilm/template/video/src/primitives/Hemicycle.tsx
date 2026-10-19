import React from "react";
import { interpolate } from "remotion";
import { C } from "../theme";

// A parliament chart: N seats in a semicircle (default 349, the Swedish Riksdag). Domain primitive —
// an example of what a film adds to src/primitives/ in its golden phase.

const ROWS = 10;
const R0 = 0.4; // inner radius as a share of the outer radius

type Seat = { x: number; y: number; angle: number; row: number };
type Layout = { seats: Seat[]; spacing: number };

const cache = new Map<number, Layout>();
/** Seat positions (unit radius, centre at 0,0, y up) ordered left → right, like a parliament chart. */
const layoutFor = (TOTAL: number): Layout => {
  const hit = cache.get(TOTAL);
  if (hit) return hit;
  const radii = Array.from({ length: ROWS }, (_, i) => R0 + ((1 - R0) * i) / (ROWS - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((TOTAL * r) / sum));
  let diff = TOTAL - counts.reduce((a, b) => a + b, 0);
  for (let i = ROWS - 1; diff !== 0; i = (i - 1 + ROWS) % ROWS) {
    counts[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const n = counts[row];
    for (let k = 0; k < n; k++) {
      const angle = Math.PI - (Math.PI * k) / (n - 1);
      seats.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), angle, row });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const out = { seats, spacing: (1 - R0) / (ROWS - 1) };
  cache.set(TOTAL, out);
  return out;
};

/** Seat colours left → right from groups in order: [{ n: 107, color }, …]. */
export const seatColors = (groups: { n: number; color: string }[]) => groups.flatMap((g) => Array.from({ length: g.n }, () => g.color));

/** Angle (radians) at the boundary after `n` seats counted from the left. */
export const boundaryAngle = (n: number, TOTAL = 349) => {
  const layout = layoutFor(TOTAL);
  const a = layout.seats[Math.max(0, Math.min(TOTAL - 1, n - 1))].angle;
  const b = layout.seats[Math.max(0, Math.min(TOTAL - 1, n))].angle;
  return (a + b) / 2;
};

/**
 * 349 seats as a semicircle. Size = width in px (height is width/2 + a little).
 * `shown`: how many seats are visible (left → right), `colors`: per-seat colours
 * (missing = neutral cream), `dimFrom`: seats from this index are drawn faded.
 */
export const Hemicycle: React.FC<{
  width: number;
  total?: number;
  shown?: number;
  colors?: string[];
  neutral?: string;
  dimFrom?: number;
  style?: React.CSSProperties;
}> = ({ width, total: TOTAL = 349, shown = TOTAL, colors = [], neutral = C.paperDark, dimFrom, style }) => {
  const layout = layoutFor(TOTAL);
  const R = width / 2;
  const h = R + R * layout.spacing;
  const dot = R * layout.spacing * 0.42;
  return (
    <svg width={width} height={h} viewBox={`${-R} ${-R - dot * 1.2} ${width} ${h}`} style={{ overflow: "visible", ...style }}>
      {layout.seats.map((s, i) => {
        if (i >= shown) return null;
        // the newest seats grow in while filling; a full hemicycle has every seat at full size
        const pop = shown >= TOTAL ? 1 : interpolate(shown - i, [0, 6], [0.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const faded = dimFrom !== undefined && i >= dimFrom;
        return (
          <circle
            key={i}
            cx={s.x * R}
            cy={-s.y * R}
            r={dot * pop}
            fill={colors[i] ?? neutral}
            stroke={C.ink}
            strokeWidth={dot * 0.18}
            opacity={faded ? 0.25 : 1}
          />
        );
      })}
    </svg>
  );
};

/**
 * Where things sit, in px relative to the hemicycle's own top-left corner (same box as <Hemicycle width>):
 * the centre of the base line (put a count in the hole above it) and a point just outside the arc.
 */
export const hemiGeometry = (width: number, TOTAL = 349) => {
  const layout = layoutFor(TOTAL);
  const R = width / 2;
  const top = R + R * layout.spacing * 0.42 * 1.2; // y of the base line
  return {
    R,
    baseY: top,
    centreX: R,
    holeRadius: R * R0,
    /** a point outside the arc at `angle` (radians, π = far left), `out` = radius multiple */
    outside: (angle: number, out = 1.18) => ({ x: R + R * out * Math.cos(angle), y: top - R * out * Math.sin(angle) }),
  };
};

/** An arc bracket over the seats [0, n) with a label at its middle, drawn outside the hemicycle. */
export const SeatBracket: React.FC<{ width: number; n: number; total?: number; from?: number; progress?: number; color?: string }> = ({
  width,
  n,
  total = 349,
  from = 0,
  progress = 1,
  color = C.ink,
}) => {
  const layout = layoutFor(total);
  const R = width / 2;
  const rr = R * 1.06;
  const a0 = from === 0 ? Math.PI : boundaryAngle(from, total);
  const a1 = a0 + (boundaryAngle(n, total) - a0) * progress;
  const p = (a: number) => `${rr * Math.cos(a)} ${-rr * Math.sin(a)}`;
  const h = R + R * layout.spacing;
  const dot = R * layout.spacing * 0.42;
  return (
    <svg width={width} height={h} viewBox={`${-R} ${-R - dot * 1.2} ${width} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <path d={`M ${p(a0)} A ${rr} ${rr} 0 0 1 ${p(a1)}`} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" />
    </svg>
  );
};
