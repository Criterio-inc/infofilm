// How much the film moves, from its mood (film.json "mood", the app's Stämning), and whether the narration
// is burned in as captions (film.json "captions", the app's "Textning i bild"). tools/build_timeline.py
// writes both into the timeline. Scenes never scale motion themselves: the primitives read MOOD.
import master from "./timeline/master.json";

type Motion = {
  /** how long a camera move takes, as a factor (1 = the stop's own `dur`) */
  pace: number;
  /** the camera's slow breathing (zoom amplitude) */
  breathe: number;
  /** window light and the glint at the start, 0..1+ */
  light: number;
  /** dust in the light: how many specks, as a factor */
  dust: number;
  /** springs for stamps and pops: bouncier when playful */
  bounce: number;
  /** the vignette at the edges */
  vignette: number;
};

const TABLE: Record<string, Motion> = {
  saklig: { pace: 1.25, breathe: 0.6, light: 0.6, dust: 0.45, bounce: 0.6, vignette: 0.8 },
  varm: { pace: 1.1, breathe: 1, light: 1, dust: 0.9, bounce: 0.8, vignette: 0.9 },
  inspirerande: { pace: 0.9, breathe: 1.2, light: 1.1, dust: 1, bounce: 1, vignette: 1 },
  lekfull: { pace: 0.8, breathe: 1.3, light: 0.9, dust: 1, bounce: 1.4, vignette: 0.7 },
  allvarlig: { pace: 1.4, breathe: 0.7, light: 0.7, dust: 0.6, bounce: 0.5, vignette: 1.4 },
};
// the user's own words ("somrig och lite nostalgisk"): the middle of the scale
const OWN: Motion = { pace: 1, breathe: 1, light: 0.9, dust: 0.8, bounce: 0.9, vignette: 1 };

const tl = master as { mood?: string; captions?: boolean; liveCards?: boolean };
export const MOOD_NAME = String(tl.mood ?? "saklig").toLowerCase();
export const MOOD: Motion = TABLE[MOOD_NAME] ?? OWN;
/** true: the narration is burned in (the card's caption band shows the spoken words, a story scene a box). */
export const BURN = Boolean(tl.captions);
/** true: cards are alive (film.json "liveCards"): the picture fills the frame behind the card's bands and
 * drifts with light and dust, like a story scene; the plates and facts stay where the scene put them. */
export const LIVE = Boolean(tl.liveCards);
