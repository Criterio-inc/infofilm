// Berättarläge: a scene without a card. The illustration fills the frame, a camera moves between stops that
// land on spoken words, light falls in and dust drifts in it, and the facts are drawn on top: plates, and
// marks that sit on things in the picture (a ring round the laptop) and follow the camera. How much it moves
// comes from the film's mood (mood.ts). Use it for scenes where the picture carries the story; the facts
// still get their infographics, on top of it. Children are in SCREEN coordinates (0..W × 0..H).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { ease, pop, prog, rand } from "../anim";
import { C, H, PLATE, S, W } from "../theme";
import { DISPLAY_FONT, DISPLAY_UPPER, UI } from "../fonts";
import { BURN, MOOD } from "../mood";
import { useScene } from "../timing";
import { ENTER, EXIT } from "./Card";
import { SubtitleBox } from "./Spoken";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A camera stop. `at`: a spoken phrase ("microsoft 365", the move starts just before it) or a scene frame.
 * cx, cy: the point in the picture to look at (0..1 of its width and height). z: how close (1 = the
 * picture's height fills the frame; 1.2–1.8 is usual). dur: frames the move takes (the mood stretches it). */
export type Stop = { at: number | string; cx: number; cy: number; z: number; dur?: number };

export type Cam = { pw: number; ph: number; left: number; top: number; cx: number; cy: number; z: number };
const CamContext = React.createContext<Cam>({ pw: W, ph: H, left: 0, top: 0, cx: 0.5, cy: 0.5, z: 1 });
/** Where the camera is now (inside <Story>). */
export const useCam = () => React.useContext(CamContext);
/** A point in the picture (fractions) → a point on the screen, for the camera now. */
export const toScreen = (cam: Cam, x: number, y: number) => ({ x: cam.left + x * cam.pw, y: cam.top + y * cam.ph });

function camera(frame: number, stops: { at: number; cx: number; cy: number; z: number; dur: number }[], img: [number, number]) {
  let cur = { cx: stops[0].cx, cy: stops[0].cy, z: stops[0].z };
  for (let i = 1; i < stops.length; i++) {
    const s = stops[i];
    if (frame < s.at) break;
    const t = ease.inOut(Math.min(1, (frame - s.at) / s.dur));
    cur = { cx: cur.cx + (s.cx - cur.cx) * t, cy: cur.cy + (s.cy - cur.cy) * t, z: cur.z + (s.z - cur.z) * t };
  }
  // a slow breath, so the picture is never quite still
  const z = Math.max(1, cur.z * (1 + 0.012 * MOOD.breathe * Math.sin(frame / 70)));
  // the picture covers the frame at z = 1, whatever the format
  const base = Math.max(H / img[1], W / img[0]);
  const pw = img[0] * base * z;
  const ph = img[1] * base * z;
  const vw = W / pw;
  const vh = H / ph;
  const cx = Math.min(1 - vw / 2, Math.max(vw / 2, cur.cx));
  const cy = Math.min(1 - vh / 2, Math.max(vh / 2, cur.cy));
  return { pw, ph, left: W / 2 - cx * pw, top: H / 2 - cy * ph, cx, cy, z };
}

const Light: React.FC<{ frame: number; from: [number, number] }> = ({ frame, from }) => {
  const k = MOOD.light;
  const breathe = (0.55 + 0.15 * Math.sin(frame / 45) + 0.06 * Math.sin(frame / 13)) * k;
  const angle = 118 + 4 * Math.sin(frame / 120);
  const glint = interpolate(frame, [20, 110], [-0.4, 1.4], { ...CL, easing: ease.inOut });
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 90% at ${from[0] * 100}% ${from[1] * 100}%, rgba(255,236,196,${0.55 * breathe}) 0%, rgba(255,236,196,0) 70%)`, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, rgba(255,240,210,${0.28 * breathe}) 0%, rgba(255,240,210,0) 45%)`, mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${glint * 100 - 12}%, rgba(255,255,255,${0.22 * k}) ${glint * 100}%, transparent ${glint * 100 + 12}%)`, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, ${C.primary}${Math.round(Math.min(1, 0.2 * MOOD.vignette) * 255).toString(16).padStart(2, "0")} 100%)` }} />
    </>
  );
};

const Dust: React.FC<{ frame: number; cam: Cam; from: [number, number] }> = ({ frame, cam, from }) => {
  const n = Math.round(46 * MOOD.dust);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const depth = 0.4 + rand(i * 7) * 0.9; // nearer specks are bigger and move more against the camera
        const x = (rand(i) * 1.2 - 0.1 + frame * 0.00025 * depth + 0.012 * Math.sin(frame / (40 + 30 * rand(i * 5)) + i)) % 1.15;
        const y = ((rand(i * 3 + 1) - frame * 0.0006 * depth + 1.2) % 1.2) - 0.1;
        const px = (x - (cam.cx - 0.4) * 0.5 * depth) * W;
        const py = (y - (cam.cy - 0.5) * 0.4 * depth) * H;
        const inLight = Math.max(0.15, 1 - Math.hypot(x - from[0] - 0.07, y - from[1] - 0.05) * 1.3);
        const size = (3 + 7 * depth * rand(i * 11)) * S;
        const twinkle = 0.6 + 0.4 * Math.sin(frame / (12 + 10 * rand(i * 13)) + i);
        return (
          <div
            key={i}
            style={{ position: "absolute", left: px, top: py, width: size, height: size, borderRadius: "50%", background: "rgba(255,244,214,1)", boxShadow: "0 0 8px 2px rgba(236,196,120,0.75)", opacity: 0.85 * inLight * twinkle, filter: `blur(${depth > 1 ? 2 : 0.6}px)` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** The scene's title, as in a documentary: kicker and title on a light plate, then it steps aside. */
const StoryTitle: React.FC<{ frame: number; title: string; kicker?: string; until: number }> = ({ frame, title, kicker, until }) => {
  const a = interpolate(frame, [8, 26, until - 20, until], [0, 1, 1, 0], CL);
  const rise = interpolate(frame, [8, 30], [24, 0], { ...CL, easing: ease.out });
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: Math.round(80 * S), top: Math.round(70 * S), opacity: a, transform: `translateY(${rise}px)`, background: "rgba(255,255,255,0.88)", padding: `${Math.round(20 * S)}px ${Math.round(32 * S)}px ${Math.round(24 * S)}px`, borderRadius: PLATE.radius, boxShadow: "0 10px 40px rgba(22,34,46,0.18)", maxWidth: W - 160 * S }}>
      {kicker && <div style={{ fontFamily: UI, fontWeight: 700, fontSize: Math.round(22 * S), letterSpacing: 4, textTransform: "uppercase", color: C.bandText, background: C.band, display: "inline-block", padding: "6px 14px", borderRadius: 6 }}>{kicker}</div>}
      <div style={{ ...DISPLAY_FONT, fontSize: Math.round(80 * S), color: C.band, marginTop: 10, lineHeight: 1 }}>{DISPLAY_UPPER ? title.toUpperCase() : title}</div>
    </div>
  );
};

/**
 * A scene in berättarläge. Example:
 *   <Story stops={[{ at: 0, cx: 0.3, cy: 0.52, z: 1.25 }, { at: "microsoft 365", cx: 0.36, cy: 0.6, z: 1.45 }]} light={[0.08, 0.3]}>
 *     <Ring at="filerna kommer" box={[0.35, 0.47, 0.47, 0.8]} label="Filerna: etapp 2" />
 *   </Story>
 */
export const Story: React.FC<{
  stops: Stop[];
  /** where the light comes from, as a point on the screen (0..1); false = no light */
  light?: [number, number] | false;
  dust?: boolean;
  /** the scene's title on a plate at the start (default: the scene title, until the third second) */
  title?: string | false;
  titleUntil?: number;
  /** the picture; default the scene's own illustration */
  img?: string | null;
  children?: React.ReactNode;
}> = ({ stops, light = [0.08, 0.3], dust = true, title, titleUntil = 125, img, children }) => {
  const s = useScene();
  const f = s.frame;
  const d = s.durationInFrames;
  const src = img ?? s.img;
  const size: [number, number] = s.imgSize ?? [2400, 1350];
  const resolved = stops.map((x) => ({ ...x, at: typeof x.at === "string" ? Math.max(0, s.cue(x.at) - 8) : x.at, dur: Math.round((x.dur ?? 42) * MOOD.pace) }));
  const cam = camera(f, resolved, size);
  // in and out like a card (the film's last scene holds and fades with the film)
  const a = prog(f, 0, ENTER, ease.out) * (s.last ? 1 : 1 - prog(f, d - EXIT, EXIT, ease.in));
  return (
    <AbsoluteFill style={{ opacity: a, overflow: "hidden", background: C.backdrop }}>
      {src && <Img src={staticFile(src)} style={{ position: "absolute", left: cam.left, top: cam.top, width: cam.pw, height: cam.ph }} />}
      {light && <Light frame={f} from={light} />}
      {dust && light && <Dust frame={f} cam={cam} from={light} />}
      <CamContext.Provider value={cam}>{children}</CamContext.Provider>
      {title !== false && <StoryTitle frame={f} title={title ?? s.title} kicker={s.kicker} until={titleUntil} />}
      {BURN && <SubtitleBox />}
    </AbsoluteFill>
  );
};

// ── marks and plates for the facts ──

const at = (s: ReturnType<typeof useScene>, x: number | string) => (typeof x === "string" ? s.cue(x) : x);
/** A stroke drawn on: t 0→1. */
export const drawn = (len: number, t: number) => ({ strokeDasharray: len, strokeDashoffset: len * (1 - t) });

/** A light plate on the screen that comes in on `at` and leaves before `out` (phrases or frames). */
export const StoryPlate: React.FC<{ at: number | string; out?: number | string; x: number; y: number; w: number; from?: "left" | "right" | "below"; style?: React.CSSProperties; children?: React.ReactNode }> = ({ at: a0, out, x, y, w, from = "right", style, children }) => {
  const s = useScene();
  const a = prog(s.frame, at(s, a0) - 4, 16);
  const b = out === undefined ? 1 : 1 - prog(s.frame, at(s, out) - 10, 12, ease.in);
  if (a * b <= 0) return null;
  const dx = from === "right" ? 50 : from === "left" ? -50 : 0;
  const dy = from === "below" ? 40 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, padding: `${Math.round(20 * S)}px ${Math.round(26 * S)}px`, background: "rgba(255,255,255,0.93)", borderRadius: PLATE.radius, boxShadow: "0 14px 40px rgba(22,34,46,0.22)", fontFamily: UI, color: C.ink, opacity: a * b, transform: `translate(${(1 - a) * dx}px, ${(1 - a) * dy - (1 - b) * 14}px)`, boxSizing: "border-box", ...style }}>
      {children}
    </div>
  );
};

/** A small capital label for a plate. */
export const Kick: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: UI, fontSize: Math.round(22 * S), fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: C.faint }}>{children}</div>
);

/** A hand-drawn ring round an area of the picture [x1, y1, x2, y2] (fractions), drawn on at `at`, following
 * the camera, with an optional label beside it. */
export const Ring: React.FC<{ at: number | string; out?: number | string; box: [number, number, number, number]; color?: string; label?: string; side?: "left" | "right" }> = ({ at: a0, out, box, color = C.highlight, label, side = "right" }) => {
  const s = useScene();
  const cam = useCam();
  const t0 = at(s, a0);
  const t = prog(s.frame, t0, 22, ease.inOut);
  const fadeOut = out === undefined ? 1 : 1 - prog(s.frame, at(s, out) - 10, 12);
  if (t <= 0 || fadeOut <= 0) return null;
  const p1 = toScreen(cam, box[0], box[1]);
  const p2 = toScreen(cam, box[2], box[3]);
  const rx = (p2.x - p1.x) / 2 + 26 * S;
  const ry = (p2.y - p1.y) / 2 + 22 * S;
  const pulse = 1 + 0.02 * MOOD.bounce * Math.sin((s.frame - t0) / 6);
  const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))) * 1.08;
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const tag = prog(s.frame, t0 + 14, 14);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fadeOut, pointerEvents: "none" }}>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height="100%">
        <ellipse cx={cx} cy={cy} rx={rx * pulse} ry={ry * pulse} fill="none" stroke={color} strokeWidth={9 * S} strokeLinecap="round" transform={`rotate(-4 ${cx} ${cy})`} style={drawn(len, t)} />
      </svg>
      {label && (
        <div style={{ position: "absolute", left: side === "right" ? cx + rx + 18 : cx - rx - 18, top: cy - ry, transform: `translate(${side === "right" ? 0 : -100}%, ${(1 - tag) * 16}px)`, opacity: tag, padding: "12px 20px", background: "rgba(255,255,255,0.93)", borderRadius: PLATE.radius, boxShadow: "0 10px 30px rgba(22,34,46,0.2)", fontFamily: UI, fontSize: Math.round(30 * S), fontWeight: 700, color: C.band, whiteSpace: "nowrap" }}>
          {label}
        </div>
      )}
    </div>
  );
};

/** Something placed on a point in the picture (fractions), following the camera; it pops in on `at`. */
export const Pin: React.FC<{ at: number | string; out?: number | string; x: number; y: number; children: React.ReactNode }> = ({ at: a0, out, x, y, children }) => {
  const s = useScene();
  const cam = useCam();
  const p = pop(s.frame, at(s, a0), { damping: 14 / MOOD.bounce, stiffness: 170 });
  const b = out === undefined ? 1 : 1 - prog(s.frame, at(s, out) - 10, 12);
  if (p <= 0.01 || b <= 0) return null;
  const q = toScreen(cam, x, y);
  return <div style={{ position: "absolute", left: q.x, top: q.y, transform: `translate(-50%,-50%) scale(${p})`, opacity: Math.min(1, p * 1.5) * b }}>{children}</div>;
};

/** Things (an icon, `children`) fly in an arc from a point in the picture to a point on the screen. */
export const Fly: React.FC<{ at: number | string; from: [number, number]; to: { x: number; y: number }; n?: number; children: React.ReactNode }> = ({ at: a0, from, to, n = 3, children }) => {
  const s = useScene();
  const cam = useCam();
  const t0 = at(s, a0);
  const a = toScreen(cam, from[0], from[1]);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const t = prog(s.frame, t0 + i * 7, Math.round(26 * MOOD.pace), ease.inOut);
        if (t <= 0 || t >= 1) return null;
        const x = a.x + (to.x - a.x) * t;
        const y = a.y + (to.y - a.y) * t - Math.sin(t * Math.PI) * (180 + 40 * i) * S;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${1 - 0.45 * t}) rotate(${(1 - t) * -14 + i * 4}deg)`, opacity: Math.min(1, t * 6, (1 - t) * 8), filter: "drop-shadow(0 6px 10px rgba(22,34,46,0.25))" }}>
            {children}
          </div>
        );
      })}
    </>
  );
};

/** A stamp that pops in with rays (the scene's one big "do this"). x, y: its centre on the screen. */
export const Stamp: React.FC<{ at: number | string; x: number; y: number; size?: number; color?: string; children: React.ReactNode }> = ({ at: a0, x, y, size = 104, color = C.primary, children }) => {
  const s = useScene();
  const t0 = at(s, a0);
  const f = s.frame;
  if (f < t0) return null;
  const go = pop(f, t0, { damping: 12 / MOOD.bounce, stiffness: 180 });
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2;
        const r = interpolate(f - t0, [0, 18], [90, 210], { ...CL, easing: ease.out }) * S;
        const o = interpolate(f - t0, [0, 6, 22], [0, 1, 0], CL);
        return <div key={i} style={{ position: "absolute", left: x + Math.cos(ang) * r * 1.3, top: y + Math.sin(ang) * r * 0.7, width: (26 + 20 * rand(i)) * S, height: 7 * S, borderRadius: 4, background: i % 2 ? C.highlight : C.positive, opacity: o, transform: `translate(-50%,-50%) rotate(${(ang * 180) / Math.PI}deg)` }} />;
      })}
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * go}) rotate(${-6 * go}deg)`, opacity: Math.min(1, go * 1.6), background: color, color: "#fff", ...DISPLAY_FONT, fontSize: Math.round(size * S), padding: `${Math.round(18 * S)}px ${Math.round(48 * S)}px`, borderRadius: 14, border: "6px solid #fff", boxShadow: "0 18px 40px rgba(22,34,46,0.3)", whiteSpace: "nowrap" }}>
        {children}
      </div>
    </>
  );
};

/** A round check mark drawn on at `at` (✓ in the positive colour). */
export const DrawCheck: React.FC<{ at: number | string; size?: number }> = ({ at: a0, size = 70 }) => {
  const s = useScene();
  const t = prog(s.frame, at(s, a0), 16, ease.inOut);
  return (
    <svg width={size * S} height={size * S} viewBox="0 0 70 70" style={{ flex: "none" }}>
      <circle cx="35" cy="35" r="32" fill={t > 0 ? C.positive : "#d3dae1"} />
      <path d="M20 36 L31 47 L51 24" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={drawn(50, t)} />
    </svg>
  );
};

/** A red ✕ drawn over whatever it is placed on (position the parent relatively), on `at`. */
export const CrossOut: React.FC<{ at: number | string }> = ({ at: a0 }) => {
  const s = useScene();
  const t0 = at(s, a0);
  // pathLength 1: the stroke draws evenly however the box is stretched
  const leg = (d: string, t: number) => <path d={d} pathLength={1} stroke={C.signal} strokeWidth={9} strokeLinecap="round" fill="none" style={{ strokeDasharray: 1, strokeDashoffset: 1 - t }} />;
  return (
    <svg style={{ position: "absolute", left: "-6%", top: "-6%", overflow: "visible" }} width="112%" height="112%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {leg("M12 14 L88 88", prog(s.frame, t0, 14, ease.inOut))}
      {leg("M88 14 L12 88", prog(s.frame, t0 + 7, 14, ease.inOut))}
    </svg>
  );
};

/** A simple envelope icon (e-post), for Fly and plates. */
export const Envelope: React.FC<{ size?: number; color?: string }> = ({ size = 80, color = C.primary }) => (
  <svg width={size * S} height={size * 0.7 * S} viewBox="0 0 100 70">
    <rect x="3" y="3" width="94" height="64" rx="8" fill="#fff" stroke={color} strokeWidth="6" />
    <path d="M6 8 L50 40 L94 8" fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
  </svg>
);
