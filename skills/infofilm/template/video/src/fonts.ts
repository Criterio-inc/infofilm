import { loadFont as loadBowlby } from "@remotion/google-fonts/BowlbyOneSC";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";
import { loadFont as loadLobster } from "@remotion/google-fonts/Lobster";

// latin-ext is not needed for å ä ö (Latin-1), but keep it for é/ü in names
const subsets: ("latin" | "latin-ext")[] = ["latin", "latin-ext"];

/** Card titles, stamps, big numbers — always uppercase. */
export const DISPLAY = loadBowlby("normal", { weights: ["400"], subsets }).fontFamily;
/** Captions, labels, sentences. */
export const UI = loadJost("normal", { weights: ["400", "600", "700"], subsets }).fontFamily;
/** Commercial breaks only: "Nyhet!" slogans. */
export const SCRIPT = loadLobster("normal", { weights: ["400"], subsets }).fontFamily;
