// Every number the film shows. Scenes import from here — never type a number into a scene.
// Each value carries its source (the section in notes/research.md and the primary source).

export const YEAR = {
  /** mean tropical year in days — research 1.1 (IERS / USNO) */
  tropical: 365.2422,
  /** the same, as days + hours + minutes (5 h 48 min 45 s, rounded) — research 1.1 */
  days: 365,
  hours: 5,
  minutes: 49,
  /** mean calendar year of the Gregorian rule — research 1.4 */
  gregorian: 365.2425,
} as const;

/** The leap-year rule, with the years the narration names — research 1.3–1.5 */
export const RULE = [
  { every: 4, leap: true },
  { every: 100, leap: false },
  { every: 400, leap: true },
] as const;

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const EXAMPLES = [1900, 2000, 2100] as const;
