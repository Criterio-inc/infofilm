import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-ish out — the house curve
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (t: number) => t,
};

/** 0→1 over [start, start+dur], eased. */
export const prog = (frame: number, start: number, dur: number, fn: (t: number) => number = ease.out) =>
  fn(clamp01((frame - start) / Math.max(1, dur)));

/** Lerp shorthand. */
export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

/** Remotion spring starting at `at` (frames). */
export const pop = (frame: number, at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) =>
  spring({ frame: frame - at, fps: FPS, config: { damping: 14, stiffness: 160, mass: 0.8, ...cfg } });

/** Standard entrance: fade + rise + slight scale, returns style. */
export const enter = (frame: number, at: number, dur = 14, dy = 40) => {
  const t = prog(frame, at, dur);
  return {
    opacity: t,
    transform: `translateY(${(1 - t) * dy}px) scale(${0.96 + 0.04 * t})`,
  } as const;
};

/** Standard exit near the end of a scene: fade + drift up. */
export const exit = (frame: number, end: number, dur = 10) => {
  const t = prog(frame, end - dur, dur, ease.in);
  return { opacity: 1 - t, transform: `translateY(${-t * 24}px)` } as const;
};

/** Combine entrance at `at` and exit before `end` into one style. */
export const life = (frame: number, at: number, end: number, dur = 14) => {
  const a = enter(frame, at, dur);
  const b = exit(frame, end);
  return { opacity: a.opacity * b.opacity, transform: `${a.transform} ${b.transform}` } as const;
};

export const sec = (s: number) => Math.round(s * FPS);

/** Count from a to b between frames [start, start+dur]. */
export const count = (frame: number, start: number, dur: number, a: number, b: number) =>
  interpolate(frame, [start, start + dur], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.out,
  });

/** Deterministic pseudo-random in [0,1) from an integer/string seed. */
export const rand = (seed: number | string) => {
  let h = typeof seed === "number" ? seed * 2654435761 : 0;
  if (typeof seed === "string") for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
};
