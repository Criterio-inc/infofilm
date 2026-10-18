import React from "react";
import { interpolate } from "remotion";
import { pop, prog } from "../anim";
import { YEAR } from "../data";
import { DISPLAY, UI } from "../fonts";
import { Captions, Card, Plate } from "../primitives/Card";
import { Counter, Sfx, Stamp, fmt } from "../primitives/Bits";
import { starburstPath } from "../primitives/Jingle";
import { C } from "../theme";
import { useScene } from "../timing";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OX = 300; // orbit centre inside the plate
const OY = 320;
const R = 215;
const TX = 640; // the text column

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
        <Plate x={60} y={40} w={1680} h={660}>
          {/* the orbit: Sun in the middle, the Earth laps it while the counter runs */}
          <svg width={620} height={660} style={{ position: "absolute", left: 0, top: 0 }}>
            <circle cx={OX} cy={OY} r={R} fill="none" stroke={C.ink} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" />
            <path
              d={`M${OX} ${OY - R} A${R} ${R} 0 ${lap > 0.5 ? 1 : 0} 1 ${earth.x.toFixed(1)} ${earth.y.toFixed(1)}`}
              fill="none"
              stroke={C.navy}
              strokeWidth={10}
              strokeLinecap="round"
              opacity={lap > 0 && lap < 1 ? 1 : lap >= 1 ? 0.35 : 0}
            />
            <g transform={`translate(${OX} ${OY}) rotate(${f * 0.6})`}>
              <path d={starburstPath(92, 14, 0.62)} fill={C.gold} stroke={C.ink} strokeWidth={5} />
            </g>
            <circle cx={OX} cy={OY} r={46} fill={C.yellowBtn} stroke={C.ink} strokeWidth={5} />
            <circle cx={earth.x} cy={earth.y} r={30} fill={C.navy} stroke={C.ink} strokeWidth={5} />
            <circle cx={earth.x - 8} cy={earth.y - 8} r={9} fill={C.green} />
          </svg>
          {/* the count */}
          <div style={{ position: "absolute", left: TX, top: 60, width: 1000, fontFamily: DISPLAY, color: C.ink, lineHeight: 1 }}>
            <div style={{ fontSize: 160, whiteSpace: "nowrap" }}>
              <Counter value={YEAR.days} at={tDays} dur={50} />
              {f >= tAlmost && (
                <span style={{ color: C.red, display: "inline-block", transform: `scale(${dec})`, transformOrigin: "0% 80%" }}>{decimals}</span>
              )}
            </div>
            <div style={{ fontSize: 64, marginTop: 6, opacity: prog(f, tDays + 10, 12) }}>DAYS</div>
            <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 54, color: C.navy, marginTop: 34, opacity: extra, transform: `translateX(${(1 - extra) * 40}px)` }}>
              = {intPart} days + {YEAR.hours} h {YEAR.minutes} min
            </div>
          </div>
          {/* whole days only: a quarter of a day left over every year */}
          <div style={{ position: "absolute", left: TX, top: 430, display: "flex", alignItems: "center", gap: 34, opacity: whole }}>
            <svg width={170} height={170} viewBox="-85 -85 170 170">
              <circle r={76} fill={C.paperDark} stroke={C.ink} strokeWidth={5} />
              <path d="M0 0 L0 -76 A76 76 0 0 1 76 0 Z" fill={C.red} stroke={C.ink} strokeWidth={5} transform={`scale(${quarter})`} />
            </svg>
            <div style={{ fontFamily: DISPLAY, fontSize: 64, lineHeight: 1.05, color: C.ink, opacity: quarter }}>
              ≈ ¼ DAY
              <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 34, color: C.faint }}>behind every year</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 24, bottom: 14, fontFamily: UI, fontSize: 20, color: C.faint }}>Mean tropical year · IERS</div>
        </Plate>
      </div>
      <Stamp at={tAlmost} x={1460} y={560} text="ALMOST!" size={56} rotate={7} />
      <Sfx at={tDays} name="tick" volume={0.25} />
      <Sfx at={tQuarter} name="ding" volume={0.3} />
    </Card>
  );
};
