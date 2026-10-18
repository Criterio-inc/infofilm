import React from "react";
import { Composition, Folder } from "remotion";
import { Video } from "./Video";
import { FPS, H, W } from "./theme";
import type { Timeline } from "./timing";
import "./fonts";
import master from "./timeline/master.json";

const TL = master as Timeline;

// "Film" = the whole film. One composition per scene ("S05-the-year") for stills and review (no music).
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Video} durationInFrames={TL.durationInFrames} fps={FPS} width={W} height={H} defaultProps={{ timeline: TL }} />
    <Folder name="scenes">
      {TL.scenes.map((s) => (
        <Composition
          key={s.id}
          id={`${s.id}-${s.name}`}
          component={Video}
          durationInFrames={s.durationInFrames}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ timeline: { ...TL, durationInFrames: s.durationInFrames, scenes: [{ ...s, from: 0 }] }, music: false }}
        />
      ))}
    </Folder>
  </>
);
