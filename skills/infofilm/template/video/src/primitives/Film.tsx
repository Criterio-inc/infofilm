import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rand } from "../anim";
import { C, H, W } from "../theme";

/** The table the cards are dealt onto: deep navy with faint atomic-age starbursts. */
export const Backdrop: React.FC = () => {
  const stars = Array.from({ length: 26 }, (_, i) => ({
    x: rand(`sx${i}`) * W,
    y: rand(`sy${i}`) * H,
    r: 10 + rand(`sr${i}`) * 26,
    rot: rand(`so${i}`) * 90,
  }));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #2c4462 0%, ${C.navyDeep} 70%)` }}>
      <svg width={W} height={H} style={{ position: "absolute", opacity: 0.1 }}>
        {stars.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`} fill={C.gold}>
            <path d={`M0 ${-s.r} L${s.r * 0.18} 0 L0 ${s.r} L${-s.r * 0.18} 0 Z`} />
            <path d={`M${-s.r} 0 L0 ${s.r * 0.18} L${s.r} 0 L0 ${-s.r * 0.18} Z`} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Old-film look on top of everything: grain, flicker, a few dust specks and a vignette. */
export const FilmLook: React.FC = () => {
  const f = useCurrentFrame();
  const seed = f % 8;
  const flicker = 0.035 + rand(`fl${f}`) * 0.035;
  const specks = Array.from({ length: 3 }, (_, i) => ({
    on: rand(`d${f}-${i}`) > 0.72,
    x: rand(`dx${f}-${i}`) * W,
    y: rand(`dy${f}-${i}`) * H,
    r: 1.5 + rand(`dr${f}-${i}`) * 3,
    hair: rand(`dh${f}-${i}`) > 0.85,
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.09, mixBlendMode: "overlay" }}>
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
      <svg width={W} height={H} style={{ position: "absolute", opacity: 0.35 }}>
        {specks
          .filter((s) => s.on)
          .map((s, i) =>
            s.hair ? (
              <path key={i} d={`M${s.x} ${s.y} q 18 -10 30 6 t 26 4`} stroke={C.ink} strokeWidth={1.2} fill="none" />
            ) : (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.ink} />
            ),
          )}
      </svg>
      <AbsoluteFill style={{ background: "#000", opacity: flicker }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Gate weave: the whole picture drifts a pixel or two, like film in a projector. */
export const Weave: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const dx = (rand(`wx${Math.floor(f / 2)}`) - 0.5) * 2.2;
  const dy = (rand(`wy${Math.floor(f / 2)}`) - 0.5) * 2.2;
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>;
};
