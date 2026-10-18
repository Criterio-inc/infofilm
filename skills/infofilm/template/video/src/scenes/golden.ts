import type React from "react";
import { TheRule } from "./TheRule";
import { TheYear } from "./TheYear";

// Golden examples — the quality bar every scene builder matches. Replace them with your own film's
// best two scenes once they exist (build those yourself, before fanning out to builders).
export const golden: Record<string, React.FC> = {
  "the-year": TheYear,
  "the-rule": TheRule,
};
