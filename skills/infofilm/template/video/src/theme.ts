// The look, from the client profile (brand/profile.json → timeline/brand.json, written by
// tools/build_timeline.py) and the format (16:9, 1:1 or 9:16). Change the profile, not this file —
// scenes use only C, the geometry below and the fonts in fonts.ts.
import master from "./timeline/master.json";
import brand from "./timeline/brand.json";

export type Brand = {
  format: "16:9" | "1:1" | "9:16";
  width: number;
  height: number;
  mode: "klipp" | "film";
  name: string;
  palette: Partial<Record<keyof typeof NEWSREEL, string>>;
  card?: { radius?: number; border?: number; shadow?: string };
  plate?: { radius?: number; border?: number; shadow?: string };
  motion?: "deal" | "slide";
  backdrop?: "starbursts" | "plain";
  filmLook?: boolean;
  ground?: "starburst" | "soft";
  logo: { src: string; height?: number; aspect?: number } | null;
  endCard?: { line?: string; url?: string };
};

// the role every colour plays; a profile that leaves one out falls back to the newsreel's
const NEWSREEL = {
  backdrop: "#1a2839", // the table behind the cards
  backdropLight: "#2c4462",
  surfaceLight: "#fceed2", // plates, light panels
  surface: "#f6e1bd", // the card itself
  surfaceDark: "#ebd2a8",
  band: "#edc884", // title and caption bands
  bandText: "#121617",
  kicker: "#253850", // the small label in the title band
  ink: "#121617", // outlines and main text
  primary: "#253850", // the brand's main colour: labels, ▲ ▼, key shapes
  accent: "#dca844",
  accentDark: "#cf973b",
  signal: "#e2432e", // used sparingly: the one thing that must be seen
  positive: "#569445",
  highlight: "#e8c13a",
  faint: "rgba(18,22,23,0.55)", // source lines, secondary text
  dim: "#1a2839", // what the picture fades towards under a plate (Card dim): dark, or white for light looks
};

export const BRAND = brand as unknown as Brand;
export const FORMAT = BRAND.format;
export const W = BRAND.width;
export const H = BRAND.height;
export const FPS = 30;
/** Number formatting for fmt() (film.json "locale"): "sv-SE" → 8 051 355 · 28,02 */
export const LOCALE: string = (master as { locale?: string }).locale ?? "en-US";

export const C = { ...NEWSREEL, ...BRAND.palette } as const;

/** The film's scale: 1 at 16:9. Narrow formats get slightly smaller bands and margins. */
export const S = FORMAT === "16:9" ? 1 : 0.8;
/** true when the picture window is wide (16:9): lay things out in a row; otherwise stack them. */
export const WIDE = FORMAT === "16:9";

const M = FORMAT === "16:9" ? { x: 60, y: 34 } : FORMAT === "1:1" ? { x: 30, y: 30 } : { x: 30, y: 60 };
// The card on the backdrop. Everything a scene draws inside the picture window uses window coordinates.
export const CARD = {
  x: M.x,
  y: M.y,
  w: W - 2 * M.x,
  h: H - 2 * M.y,
  radius: BRAND.card?.radius ?? 26,
  border: BRAND.card?.border ?? 5,
  shadow: BRAND.card?.shadow ?? "0 24px 60px rgba(0,0,0,0.55), 0 4px 0 rgba(0,0,0,0.25)",
} as const;
export const PLATE = {
  radius: BRAND.plate?.radius ?? 18,
  border: BRAND.plate?.border ?? 4,
  shadow: BRAND.plate?.shadow ?? "0 10px 0 rgba(18,22,23,0.25)",
} as const;
export const TITLE_H = Math.round(152 * S);
export const CAPTION_H = Math.round(111 * S);
/** caption band text size; captions stay on one line, so narrow formats get fewer characters */
export const CAPTION_SIZE = Math.round(38 * S);
// 16:9 → 1800×749 · 1:1 → 1020×798 · 9:16 → 1020×1574
export const WIN = { x: CARD.x, y: CARD.y + TITLE_H, w: CARD.w, h: CARD.h - TITLE_H - CAPTION_H } as const;
