import React from "react";
import { interpolate } from "remotion";
import { pop, prog } from "../anim";
import { EXAMPLES, isLeap } from "../data";
import { DISPLAY, UI } from "../fonts";
import { Captions, Card, Plate } from "../primitives/Card";
import { Sfx, Stamp } from "../primitives/Bits";
import { C } from "../theme";
import { useScene } from "../timing";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const COL = [60, 650, 1240]; // three columns, 500 wide, 90 apart

/** GOLDEN SCENE. S03 · the-rule — three rules on top, three years below; each verdict lands on its year. */
export const TheRule: React.FC = () => {
  const s = useScene();
  const f = s.frame;
  const tEvery = s.cue("every fourth year");
  const t29 = s.cue("twenty-ninth");
  const tOver = s.cue("overshoots");
  const tCentury = s.cue("century years");
  const tFour = s.cue("four hundred");
  // the years land on the words that name them
  const tYears = [s.cue("nineteen hundred"), s.cue("two thousand"), s.cue("twenty-one hundred")];

  const rules = [
    { at: tEvery, big: "÷ 4", label: "+1 day", sub: f >= t29 ? "29 February" : "" },
    { at: tCentury, big: "÷ 100", label: "no leap day", sub: "century years" },
    { at: tFour, big: "÷ 400", label: "leap day after all", sub: "" },
  ];

  return (
    <Card
      title={s.title}
      kicker={s.kicker}
      img={s.img}
      dim={interpolate(f, [tEvery - 16, tEvery], [0, 0.6], CL)}
      caption={
        <Captions
          items={[
            { at: 0, text: "The fix" },
            { at: tEvery, text: "Every 4th year: one extra day" },
            { at: tCentury, text: "Century years: no leap day …" },
            { at: tFour, text: "… unless they divide by 400" },
            { at: tYears[2], text: `${EXAMPLES.map((y) => `${y} ${isLeap(y) ? "yes" : "no"}`).join(" · ")}` },
          ]}
        />
      }
    >
      {rules.map((r, i) => {
        const t = prog(f, r.at - 6, 16);
        // once a newer rule arrives the older ones step back a little
        const later = rules.slice(i + 1).some((n) => f >= n.at);
        return (
          <div key={i} style={{ opacity: t * (later ? 0.55 : 1), transform: `translateY(${(1 - t) * 60}px)` }}>
            <Plate x={COL[i]} y={34} w={500} h={270}>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 110, color: C.ink, lineHeight: 1 }}>{r.big}</div>
                <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 40, color: C.navy, marginTop: 8 }}>{r.label}</div>
                <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 30, color: C.faint, height: 36 }}>{r.sub}</div>
              </div>
            </Plate>
          </div>
        );
      })}
      {EXAMPLES.map((y, i) => {
        const at = tYears[i];
        const t = prog(f, at - 4, 14);
        const v = pop(f, at + 8, { damping: 10, stiffness: 220, mass: 0.6 });
        const leap = isLeap(y);
        return (
          <div key={y} style={{ opacity: t, transform: `translateY(${(1 - t) * 50}px)` }}>
            <Plate x={COL[i] + 40} y={360} w={420} h={300} style={{ background: leap ? C.paperLight : C.paperDark }}>
              <div style={{ position: "absolute", top: 40, width: "100%", textAlign: "center", fontFamily: DISPLAY, fontSize: 120, color: C.ink, lineHeight: 1 }}>{y}</div>
              {f >= at + 8 && (
                <div
                  style={{
                    position: "absolute",
                    top: 200,
                    width: "100%",
                    textAlign: "center",
                    fontFamily: DISPLAY,
                    fontSize: 38,
                    whiteSpace: "nowrap",
                    color: leap ? C.navy : C.red,
                    transform: `scale(${v}) rotate(${leap ? -4 : 4}deg)`,
                  }}
                >
                  {leap ? "▲ LEAP YEAR" : "▼ NO LEAP DAY"}
                </div>
              )}
            </Plate>
            <Sfx at={at + 8} name="pop" volume={0.25} />
          </div>
        );
      })}
      {/* the stamp sits on the first rule's corner: that rule is the one that overshoots */}
      <Stamp at={tOver} x={400} y={318} text="OVERSHOOTS" size={40} rotate={-5} />
    </Card>
  );
};
