// Sung lines with their times in seconds from the start of each music cut (Suno aligned lyrics,
// converted with `python3 music/tools/suno_lines.py <aligned.json> NAME`).
// Scene frames: an intro cut starts at scene.intro.at, a jingle/ballad at scene.after.at → at + t * FPS.
export type Line = { t: number; end: number; text: string };

// export const THEME: Line[] = [
//   { t: 0.4, end: 4.43, text: "It's the Calendar Journal!" },
// ];
