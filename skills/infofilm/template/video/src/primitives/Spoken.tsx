// The narration burned in as captions (film.json "captions"): a sentence at a time, a long one in two halves,
// the words already said in full colour. In a card it fills the caption band; in a story scene it is a box at
// the bottom. The SRT file is delivered as well, whichever is chosen.
import React from "react";
import { interpolate } from "remotion";
import { FPS, S, W } from "../theme";
import { UI } from "../fonts";
import type { Word } from "../timing";
import { useScene } from "../timing";

/** Sentences; one longer than `max` characters is split in two near the middle, so no word is left alone. */
export function phrases(words: Word[], max = 52) {
  const sentences: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?]$/.test(w.w)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length) sentences.push(cur);
  const len = (ws: Word[]) => ws.map((x) => x.w).join(" ").length;
  return sentences.flatMap((s) => {
    if (len(s) <= max) return [s];
    let best = 1;
    for (let k = 1; k < s.length; k++) if (Math.abs(len(s.slice(0, k)) - len(s.slice(k))) < Math.abs(len(s.slice(0, best)) - len(s.slice(best)))) best = k;
    return [s.slice(0, best), s.slice(best)];
  });
}

/** The phrase being spoken now (with the time in seconds), or null between sentences. */
function current(words: Word[], t: number, max: number) {
  const list = phrases(words, max);
  const i = list.findIndex((p, k) => t >= p[0].s - 0.1 && (k === list.length - 1 ? t <= p[p.length - 1].e + 0.6 : t < list[k + 1][0].s - 0.1));
  return i < 0 ? null : list[i];
}

/** The spoken words as a line of text (for a caption band). `dim` is the colour of words not yet said. */
export const Spoken: React.FC<{ max?: number; dim?: number }> = ({ max = 52, dim = 0.55 }) => {
  const s = useScene();
  const t = (s.frame - s.lead) / FPS;
  const p = current(s.words, t, max);
  if (!p) return null;
  return (
    <span>
      {p.map((w, k) => (
        <span key={k} style={{ opacity: t >= w.s ? 1 : dim }}>
          {w.w}
          {k < p.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
};

/** The captions as a box at the bottom of the frame (a story scene). */
export const SubtitleBox: React.FC<{ bottom?: number }> = ({ bottom = Math.round(70 * S) }) => {
  const s = useScene();
  const t = (s.frame - s.lead) / FPS;
  const p = current(s.words, t, 52);
  if (!p) return null;
  const a = interpolate(t, [p[0].s - 0.1, p[0].s + 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: UI,
          fontWeight: 600,
          fontSize: Math.round(46 * S),
          lineHeight: 1.25,
          color: "#fff",
          background: "rgba(22,34,46,0.62)",
          padding: `${Math.round(12 * S)}px ${Math.round(26 * S)}px`,
          borderRadius: 14,
          maxWidth: W - 160,
          textAlign: "center",
          opacity: a,
          textShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}
      >
        <Spoken />
      </div>
    </div>
  );
};
