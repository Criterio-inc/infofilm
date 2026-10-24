import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { ease, pop, prog } from "../anim";
import { DISPLAY_FONT, DISPLAY_EM, DISPLAY_UPPER, MONO, MONO_WEIGHT, UI } from "../fonts";
import { BRAND, C, CAPTION_H, CAPTION_SIZE, CARD, PLATE, S, TITLE_H, WIN } from "../theme";
import { useScene } from "../timing";
import { BURN } from "../mood";
import { Spoken } from "./Spoken";

export const ENTER = 18; // frames the card needs to land
export const EXIT = 14; // frames the card needs to leave

/**
 * The card every scene is built on. Title band (code, with the client's logo), picture window
 * (AI illustration with a slow camera move + your overlays as children), caption band.
 * Children are positioned in WINDOW coordinates: 0..WIN.w × 0..WIN.h (1800×749 at 16:9).
 * How it arrives and leaves is the profile's "motion": "deal" (dealt onto the table, flies out
 * to the left) or "slide" (a calm slide and fade, for most clients).
 */
export const Card: React.FC<{
  title?: string;
  titleNode?: React.ReactNode; // replaces the title text (e.g. a Lobster slogan)
  kicker?: string; // small label at the right of the title band
  caption?: React.ReactNode;
  img?: string | null; // path under public/, e.g. s.img ("img/film-S05.jpg"); none → a drawn halftone ground
  /** camera: zoom from→to over the scene, around focus (0..1, 0..1) */
  zoom?: [number, number];
  focus?: [number, number];
  /** 0..1 darkening of the illustration (for overlays on top) */
  dim?: number;
  children?: React.ReactNode;
}> = ({ title, titleNode, kicker, caption, img, zoom = [1.03, 1.1], focus = [0.5, 0.5], dim = 0, children }) => {
  const s = useScene();
  const f = s.frame;
  const d = s.durationInFrames;
  const z = interpolate(f, [0, d], zoom);
  // the last card does not leave: the film fades out over it
  const tout = s.last ? 0 : prog(f, d - EXIT, EXIT, ease.in);
  let move: React.CSSProperties;
  if (BRAND.motion === "slide") {
    const tin = prog(f, 0, ENTER, ease.out);
    move = { transform: `translateX(${(1 - tin) * 140 - tout * 140}px)`, opacity: tin * (1 - tout) };
  } else {
    const tin = pop(f, 0, { damping: 15, stiffness: 120, mass: 0.9 });
    move = { transform: `translate(${-tout * 2200}px, ${(1 - tin) * 1150}px) rotate(${(1 - tin) * 5 - tout * 7}deg)`, transformOrigin: "50% 100%" };
  }
  const shown = DISPLAY_UPPER ? (title ?? "").toUpperCase() : (title ?? "");
  const logoH = BRAND.logo ? Math.round((BRAND.logo.height ?? 56) * S) : 0;
  // the title shrinks so that title, kicker and logo keep one line
  const titleRoom = CARD.w * 0.62 - (BRAND.logo ? logoH * (BRAND.logo.aspect ?? 3) : 0);

  return (
    <AbsoluteFill style={move}>
      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: CARD.radius,
          background: C.surface,
          overflow: "hidden",
          boxShadow: CARD.shadow,
        }}
      >
        {/* picture window */}
        <div style={{ position: "absolute", left: 0, top: TITLE_H, width: WIN.w, height: WIN.h, overflow: "hidden" }}>
          {!img && <Ground zoom={z} focus={focus} />}
          {img && (
            <Img
              src={staticFile(img)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${z})`,
                transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
              }}
            />
          )}
          {dim > 0 && <AbsoluteFill style={{ background: C.dim, opacity: dim }} />}
          <div style={{ position: "absolute", inset: 0 }}>{children}</div>
        </div>
        {/* title band */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CARD.w,
            height: TITLE_H,
            background: C.band,
            borderBottom: CARD.border ? `${CARD.border}px solid ${C.ink}` : undefined,
            display: "flex",
            alignItems: "center",
            padding: `0 ${Math.round(56 * S)}px`,
            boxSizing: "border-box",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          {titleNode ?? (
            <div
              style={{
                ...DISPLAY_FONT,
                fontSize: Math.min(Math.round(78 * S), Math.floor(titleRoom / (Math.max(1, shown.length) * DISPLAY_EM))),
                color: C.bandText,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {shown}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(28 * S) }}>
            {kicker && (
              <div style={{ fontFamily: MONO, fontWeight: MONO_WEIGHT, fontSize: Math.round(26 * S), letterSpacing: "0.14em", color: C.kicker, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {kicker}
              </div>
            )}
            {BRAND.logo && <Img src={staticFile(BRAND.logo.src)} style={{ height: logoH, width: "auto", display: "block" }} />}
          </div>
        </div>
        {/* caption band */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: CARD.w,
            height: CAPTION_H,
            background: C.band,
            borderTop: CARD.border ? `${CARD.border}px solid ${C.ink}` : undefined,
            display: "flex",
            alignItems: "center",
            padding: `0 ${Math.round(56 * S)}px`,
            boxSizing: "border-box",
            fontFamily: UI,
            fontWeight: 600,
            fontSize: CAPTION_SIZE,
            color: C.bandText,
            whiteSpace: "nowrap",
          }}
        >
          {/* film.json "captions": the band shows the spoken words instead */}
          {BURN ? <Spoken max={Math.round((CARD.w - 112 * S) / (CAPTION_SIZE * 0.52))} /> : caption}
        </div>
        {/* ink border on top of everything */}
        {CARD.border > 0 && (
          <div style={{ position: "absolute", inset: 0, borderRadius: CARD.radius, border: `${CARD.border}px solid ${C.ink}`, pointerEvents: "none" }} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Stand-in for a missing illustration. Newsreel: halftone dots and a googie starburst on paper;
 * profile "ground": "soft": a calm gradient with a few large circles in the brand colours. */
const Ground: React.FC<{ zoom: number; focus: [number, number] }> = ({ zoom, focus }) =>
  BRAND.ground === "soft" ? (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 35%, ${C.surfaceLight} 0%, ${C.surface} 55%, ${C.surfaceDark} 100%)`,
        transform: `scale(${zoom})`,
        transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
      }}
    >
      <svg width={WIN.w} height={WIN.h} style={{ position: "absolute" }}>
        <circle cx={WIN.w * 0.82} cy={WIN.h * 0.2} r={WIN.h * 0.42} fill={C.accent} opacity={0.12} />
        <circle cx={WIN.w * 0.1} cy={WIN.h * 0.95} r={WIN.h * 0.36} fill={C.primary} opacity={0.08} />
        <circle cx={WIN.w * 0.6} cy={WIN.h * 0.9} r={WIN.h * 0.14} fill={C.highlight} opacity={0.14} />
      </svg>
    </AbsoluteFill>
  ) : (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle, ${C.accentDark}40 26%, transparent 28%) 0 0 / 26px 26px, radial-gradient(ellipse at 50% 45%, ${C.surfaceLight} 0%, ${C.surfaceDark} 100%)`,
      transform: `scale(${zoom})`,
      transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
    }}
  >
    <svg width={WIN.w} height={WIN.h} style={{ position: "absolute", opacity: 0.22 }}>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 24;
        return <line key={i} x1={WIN.w / 2} y1={WIN.h / 2} x2={WIN.w / 2 + Math.cos(a) * 1200} y2={WIN.h / 2 + Math.sin(a) * 1200} stroke={C.accent} strokeWidth={i % 2 ? 10 : 26} />;
      })}
    </svg>
  </AbsoluteFill>
  );

/** A plate inside the window for infographics: a light panel (newsreel: cream with an ink border). */
export const Plate: React.FC<{ x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.surfaceLight,
      border: PLATE.border ? `${PLATE.border}px solid ${C.ink}` : undefined,
      borderRadius: PLATE.radius,
      boxShadow: PLATE.shadow,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Caption text that swaps on cue: the latest entry whose `at` has passed is shown, sliding in. */
export const Captions: React.FC<{ items: { at: number; text: React.ReactNode }[] }> = ({ items }) => {
  const { frame } = useScene();
  const sorted = [...items].sort((a, b) => a.at - b.at);
  const cur = [...sorted].reverse().find((i) => frame >= i.at) ?? sorted[0];
  const t = prog(frame, cur.at, 10);
  return <div style={{ transform: `translateY(${(1 - t) * 30}px)`, opacity: t }}>{cur.text}</div>;
};
