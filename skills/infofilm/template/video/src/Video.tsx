import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Backdrop, FilmLook, Weave } from "./primitives/Film";
import { SceneShell } from "./SceneShell";
import { sceneComponent } from "./scenes";
import { SceneProvider, Timeline } from "./timing";
import { Music } from "./Music";

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
  </AbsoluteFill>
);
