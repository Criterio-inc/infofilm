// The look. One palette for the whole film: cream paper, navy, golden yellow, ink, a signal red.
// Change it here (and in art/style.json, so the illustrations match) — scenes use only C.
import master from "./timeline/master.json";

export const W = 1920;
export const H = 1080;
export const FPS = 30;
/** Number formatting for fmt() (film.json "locale"): "sv-SE" → 8 051 355 · 28,02 */
export const LOCALE: string = (master as { locale?: string }).locale ?? "en-US";

export const C = {
  paperLight: "#fceed2",
  paper: "#f6e1bd",
  paperDark: "#ebd2a8",
  band: "#edc884", // title and caption bands
  gold: "#dca844",
  ochre: "#cf973b",
  navy: "#253850",
  navyDeep: "#1a2839", // the backdrop behind the cards
  ink: "#121617",
  red: "#e2432e",
  green: "#569445",
  yellowBtn: "#e8c13a",
  faint: "rgba(18,22,23,0.55)",
} as const;

// The card on the backdrop. Everything a scene draws inside the picture window uses window coordinates.
export const CARD = { x: 60, y: 34, w: 1800, h: 1012, radius: 26, border: 5 } as const;
export const TITLE_H = 152;
export const CAPTION_H = 111;
export const WIN = { x: CARD.x, y: CARD.y + TITLE_H, w: CARD.w, h: CARD.h - TITLE_H - CAPTION_H } as const; // 1800×749
