import type React from "react";
import { Placeholder } from "./Placeholder";
import { golden } from "./golden";
import { built } from "./registry";

// Scenes are looked up by NAME (the part after "·" in the script heading). A name without a
// component renders as <Placeholder> (its card, title and illustration), so the film always plays.
// Parallel builders: give each group its own groupX.ts registry and spread it in here.
const REGISTRY: Record<string, React.FC> = { ...built, ...golden };

export const sceneComponent = (name: string): React.FC => REGISTRY[name] ?? Placeholder;
