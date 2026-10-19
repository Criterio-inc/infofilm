import React from "react";
import { interpolate } from "remotion";
import { pop, prog } from "../anim";
import { YEAR } from "../data";
import { DISPLAY_FONT, UI } from "../fonts";
import { Captions, Card, Plate } from "../primitives/Card";
import { Counter, Sfx, Stamp, fmt } from "../primitives/Bits";
import { starburstPath } from "../primitives/Jingle";
import { C, WIDE } from "../theme";
import { useScene } from "../timing";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// One layout per window shape: a row at 16:9 (orbit left, numbers right), stacked at 1:1 / 9:16
// (orbit and pie on top, numbers below). Everything else in the scene is shared.
const L = WIDE
  ? { plate: [60, 40, 1680, 660], ox: 300, oy: 320, r: 215, k: 1, svg: [620, 660], tx: 640, ty: 60, big: 160, days: 64, eq: 54, px: 640, py: 430, q: 64, qSub: 34, stamp: [1460, 560] }
  : { plate: [30, 30, 960, 738], ox: 220, oy: 200, r: 150, k: 0.7, svg: [440, 400], tx: 50, ty: 400, big: 120, days: 48, eq: 40, px: 470, py: 110, q: 52, qSub: 28, stamp: [770, 372] };
const { ox: OX, oy: OY, r: R, tx: TX } = L;

/** GOLDEN SCENE. S02 · the-year — the Earth laps the Sun while the day counter runs; "almost" adds the decimals. */
export const TheYear: React.FC = () => {
  const s = useScene();
  const f = s.frame;
  // every beat lands on a spoken word
  const tDays = s.cue("three hundred and sixty-five");
  const tAlmost = s.cue("almost");
  const tExtra = s.cue("five hours");
  const tWhole = s.cue("whole days");
  const tQuarter = s.cue("quarter of a day");

  const plate = prog(f, tDays - 16, 18);
  const lap = interpolate(f, [tDays, tDays + 50], [0, 1], CL);
  const a = -Math.PI / 2 + lap * Math.PI * 2;
  const earth = { x: OX + Math.cos(a) * R, y: OY + Math.sin(a) * R };
  const intPart = fmt(YEAR.days);
  const decimals = fmt(YEAR.tropical, 4).slice(intPart.length); // ".2422" or ",2422", per locale
  const dec = pop(f, tAlmost, { damping: 12, stiffness: 200 });
  const extra = prog(f, tExtra, 14);
  const whole = prog(f, tWhole, 16);
  const quarter = pop(f, tQuarter, { damping: 13, stiffness: 170 });

  return (
    <Card
      title={s.title}
      kicker={s.kicker}
      img={s.img}
      focus={[0.3, 0.5]}
      dim={interpolate(f, [tDays - 16, tDays], [0, 0.6], CL)}
      caption={
        <Captions
          items={[
            { at: 0, text: "One trip around the Sun" },
            { at: tDays, text: `${intPart} days …` },
            { at: tAlmost, text: "… and a little bit more" },
            { at: tWhole, text: "The calendar counts whole days" },
            { at: tQuarter, text: "≈ ¼ day behind, every year" },
          ]}
        />
      }
    >
      <div style={{ opacity: plate, transform: `translateY(${(1 - plate) * 80}px)` }}>
        <Plate x={L.plate[0]} y={L.plate[1]} w={L.plate[2]} h={L.plate[3]}>
          {/* the orbit: Sun in the middle, the Earth laps it while the counter runs */}
          <svg width={L.svg[0]} height={L.svg[1]} style={{ position: "absolute", left: 0, top: 0 }}>
            <circle cx={OX} cy={OY} r={R} fill="none" stroke={C.ink} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" />
            <path
              d={`M${OX} ${OY - R} A${R} ${R} 0 ${lap > 0.5 ? 1 : 0} 1 ${earth.x.toFixed(1)} ${earth.y.toFixed(1)}`}
              fill="none"
              stroke={C.primary}
              strokeWidth={10}
              strokeLinecap="round"
              opacity={lap > 0 && lap < 1 ? 1 : lap >= 1 ? 0.35 : 0}
            />
            <g transform={`translate(${OX} ${OY}) rotate(${f * 0.6})`}>
              <path d={starburstPath(92 * L.k, 14, 0.62)} fill={C.accent} stroke={C.ink} strokeWidth={5} />
            </g>
            <circle cx={OX} cy={OY} r={46 * L.k} fill={C.highlight} stroke={C.ink} strokeWidth={5} />
            <circle cx={earth.x} cy={earth.y} r={30 * L.k} fill={C.primary} stroke={C.ink} strokeWidth={5} />
            <circle cx={earth.x - 8 * L.k} cy={earth.y - 8 * L.k} r={9 * L.k} fill={C.positive} />
          </svg>
          {/* the count */}
          <div style={{ position: "absolute", left: TX, top: L.ty, width: 1000, ...DISPLAY_FONT, color: C.ink, lineHeight: 1 }}>
            <div style={{ fontSize: L.big, whiteSpace: "nowrap" }}>
              <Counter value={YEAR.days} at={tDays} dur={50} />
              {f >= tAlmost && (
                <span style={{ color: C.signal, display: "inline-block", transform: `scale(${dec})`, transformOrigin: "0% 80%" }}>{decimals}</span>
              )}
            </div>
            <div style={{ fontSize: L.days, marginTop: 6, opacity: prog(f, tDays + 10, 12) }}>DAYS</div>
            <div style={{ fontFamily: UI, fontWeight: 700, fontSize: L.eq, color: C.primary, marginTop: 34, opacity: extra, transform: `translateX(${(1 - extra) * 40}px)` }}>
              = {intPart} days + {YEAR.hours} h {YEAR.minutes} min
            </div>
          </div>
          {/* whole days only: a quarter of a day left over every year */}
          <div style={{ position: "absolute", left: L.px, top: L.py, display: "flex", alignItems: "center", gap: 34, opacity: whole }}>
            <svg width={170} height={170} viewBox="-85 -85 170 170">
              <circle r={76} fill={C.surfaceDark} stroke={C.ink} strokeWidth={5} />
              <path d="M0 0 L0 -76 A76 76 0 0 1 76 0 Z" fill={C.signal} stroke={C.ink} strokeWidth={5} transform={`scale(${quarter})`} />
            </svg>
            <div style={{ ...DISPLAY_FONT, fontSize: L.q, lineHeight: 1.05, color: C.ink, opacity: quarter, whiteSpace: "nowrap" }}>
              ≈ ¼ DAY
              <div style={{ fontFamily: UI, fontWeight: 600, fontSize: L.qSub, color: C.faint }}>behind every year</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 24, bottom: 14, fontFamily: UI, fontSize: 20, color: C.faint }}>Mean tropical year · IERS</div>
        </Plate>
      </div>
      <Stamp at={tAlmost} x={L.stamp[0]} y={L.stamp[1]} text="ALMOST!" size={WIDE ? 56 : 44} rotate={7} />
      <Sfx at={tDays} name="tick" volume={0.25} />
      <Sfx at={tQuarter} name="ding" volume={0.3} />
    </Card>
  );
};
