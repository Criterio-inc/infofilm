import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { SceneData } from "./timing";
import { SFX } from "./sfx";
import { EXIT } from "./primitives/Card";

/** Plays the scene's narration and the card's whoosh in/out. Visual transitions live in <Card>. */
export const SceneShell: React.FC<{ scene: SceneData; children: React.ReactNode }> = ({ scene, children }) => (
  <AbsoluteFill>
    {children}
    {scene.audio && (
      <Sequence from={scene.lead} layout="none">
        <Audio src={staticFile(scene.audio)} />
      </Sequence>
    )}
    <Audio src={staticFile(SFX.whoosh)} volume={0.18} />
    <Sequence from={scene.durationInFrames - EXIT} layout="none">
      <Audio src={staticFile(SFX.whoosh)} volume={0.12} />
    </Sequence>
  </AbsoluteFill>
);
