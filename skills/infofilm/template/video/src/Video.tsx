import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, FilmLook, Weave } from "./primitives/Film";
import { SceneShell } from "./SceneShell";
import { sceneComponent } from "./scenes";
import { SceneProvider, Timeline } from "./timing";
import { Music } from "./Music";

/** The picture fades to black over the last second, after the music has started to fade. */
const FadeOut: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const f = useCurrentFrame();
  const end = timeline.durationInFrames;
  const len = Math.min(timeline.fadeOutFrames ?? 60, Math.round(timeline.fps * 1.2));
  const o = interpolate(f, [end - len, end - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ background: "#000", opacity: o }} /> : null;
};

export const Video: React.FC<{ timeline: Timeline; music?: boolean }> = ({ timeline, music = true }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Weave>
      <Backdrop />
      {timeline.scenes.map((s) => {
        const Comp = sceneComponent(s.name);
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={`${s.id} ${s.name}`}>
            <SceneProvider scene={s}>
              <SceneShell scene={s}>
                <Comp />
              </SceneShell>
            </SceneProvider>
          </Sequence>
        );
      })}
    </Weave>
    {music && <Music timeline={timeline} />}
    <FilmLook />
    <FadeOut timeline={timeline} />
  </AbsoluteFill>
);
