import { continueRender, delayRender, staticFile } from "remotion";
import brand from "./timeline/brand.json";

// The profile's fonts, loaded from local files in public/brand/fonts/ (tools/fetch_fonts.py fetches
// Google fonts into the profile; a client's own fonts are files in the profile). No network at render.
type Role = { family: string; weight?: number; uppercase?: boolean; widthEm?: number };
type Face = { family: string; weight: number; style: string; src: string; unicodeRange?: string };
const F = (brand as unknown as { fonts: { display: Role; ui: Role; script?: Role; faces: Face[] } }).fonts;

if (typeof document !== "undefined") {
  const handle = delayRender("loading the profile's fonts");
  Promise.all(
    F.faces.map((f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.src)}) format("woff2")`, {
        weight: String(f.weight),
        style: f.style,
        ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
      });
      document.fonts.add(face);
      return face.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error("[font-missing]", e);
      continueRender(handle);
    });
}

const stack = (r: Role) => `"${r.family}", system-ui, sans-serif`;

/** Card titles, stamps, big numbers. Spread DISPLAY_FONT into a style: it carries the weight too
 * (Bowlby One SC has one weight, a client's Inter is set at 800). */
export const DISPLAY = stack(F.display);
export const DISPLAY_WEIGHT = F.display.weight ?? 400;
export const DISPLAY_FONT = { fontFamily: DISPLAY, fontWeight: DISPLAY_WEIGHT } as const;
/** Captions, labels, sentences: set fontWeight yourself (400, 600, 700). */
export const UI = stack(F.ui);
/** Commercial breaks and slogans only (newsreel: Lobster). Falls back to DISPLAY. */
export const SCRIPT = stack(F.script ?? F.display);
export const SCRIPT_WEIGHT = (F.script ?? F.display).weight ?? 400;
/** The weight that goes with a family from this file (for components that take a `font` prop). */
export const weightOf = (family: string) => (family === DISPLAY ? DISPLAY_WEIGHT : family === SCRIPT ? SCRIPT_WEIGHT : 400);
/** Whether the profile sets titles in capitals (the newsreel does, most clients don't). */
export const DISPLAY_UPPER = F.display.uppercase ?? false;
/** Average glyph width of DISPLAY in em, for shrinking long titles to fit one line. */
export const DISPLAY_EM = F.display.widthEm ?? 0.62;
