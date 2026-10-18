import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { count, pop, prog } from "../anim";
import { DISPLAY, UI } from "../fonts";
import { C, LOCALE } from "../theme";
import { useScene } from "../timing";
import { SFX } from "../sfx";

/** Number formatting in the film's locale (film.json): "sv-SE" → 8 051 355 · 28,02; "en-US" → 8,051,355 · 28.02 */
export const fmt = (v: number, decimals = 0) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

/** A number that counts up from `from` and lands at frame at+dur. */
export const Counter: React.FC<{ value: number; at: number; dur?: number; from?: number; decimals?: number; suffix?: string; style?: React.CSSProperties }> = ({
  value,
  at,
  dur = 22,
  from = 0,
  decimals = 0,
  suffix = "",
  style,
}) => {
  const { frame } = useScene();
  const v = count(frame, at, dur, from, value);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {fmt(decimals ? v : Math.round(v), decimals)}
      {suffix}
    </span>
  );
};

/** A rubber stamp that slams down at `at` (with a thump). Position is its centre. */
export const Stamp: React.FC<{
  at: number;
  x: number;
  y: number;
  text: React.ReactNode;
  size?: number;
  rotate?: number;
  color?: string;
  bg?: string;
  sound?: boolean;
}> = ({ at, x, y, text, size = 64, rotate = -6, color = C.navy, bg = C.paperLight, sound = true }) => {
  const { frame } = useScene();
  if (frame < at) return null;
  const t = pop(frame, at, { damping: 11, stiffness: 260, mass: 0.6 });
  const scale = 1.8 - 0.8 * t;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
          opacity: Math.min(1, t * 1.6),
          background: bg,
          border: `5px solid ${C.ink}`,
          borderRadius: 14,
          padding: `${size * 0.16}px ${size * 0.42}px`,
          fontFamily: DISPLAY,
          fontSize: size,
          lineHeight: 1.05,
          color,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 0 rgba(18,22,23,0.3)",
        }}
      >
        {text}
      </div>
      {sound && (
        <Sequence from={at} layout="none">
          <Audio src={staticFile(SFX.hit)} volume={0.3} />
        </Sequence>
      )}
    </>
  );
};

/** Fade + rise in at `at`; optional fade out at `out`. */
export const Appear: React.FC<{ at: number; out?: number; dy?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  out,
  dy = 30,
  dur = 12,
  style,
  children,
}) => {
  const { frame } = useScene();
  const a = prog(frame, at, dur);
  const b = out !== undefined ? 1 - prog(frame, out, 10) : 1;
  return <div style={{ opacity: a * b, transform: `translateY(${(1 - a) * dy}px)`, ...style }}>{children}</div>;
};

/** One sound effect at a scene-relative frame. */
export const Sfx: React.FC<{ at: number; name: keyof typeof SFX; volume?: number }> = ({ at, name, volume = 0.3 }) => (
  <Sequence from={Math.max(0, at)} layout="none">
    <Audio src={staticFile(SFX[name])} volume={volume} />
  </Sequence>
);

export const Label: React.FC<{ children: React.ReactNode; size?: number; color?: string; weight?: number; style?: React.CSSProperties }> = ({
  children,
  size = 34,
  color = C.ink,
  weight = 600,
  style,
}) => <div style={{ fontFamily: UI, fontWeight: weight, fontSize: size, color, lineHeight: 1.15, ...style }}>{children}</div>;

/** A round marker with letters (a party, a country, a team): every token the same size and type; colour is data. */
export const Token: React.FC<{ label: string; color: string; size?: number; style?: React.CSSProperties }> = ({ label, color, size = 90, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      border: `${Math.max(3, size * 0.045)}px solid ${C.ink}`,
      display: "grid",
      placeItems: "center",
      fontFamily: DISPLAY,
      fontSize: size * (label.length > 1 ? 0.3 : 0.4),
      color: C.paperLight,
      textShadow: "0 2px 0 rgba(0,0,0,0.35)",
      boxSizing: "border-box",
      ...style,
    }}
  >
    {label}
  </div>
);
