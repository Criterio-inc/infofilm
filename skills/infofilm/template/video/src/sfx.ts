// Sound effects (paths under public/), synthesised by tools/make_sfx.py. Replace freely.
export const SFX = {
  whoosh: "sfx/whoosh.wav", // card dealt in / out
  hit: "sfx/hit.wav", // stamps
  tick: "sfx/tick.wav", // counters start
  ding: "sfx/ding.wav", // a reveal lands
  pop: "sfx/pop.wav", // small elements, tokens
  riser: "sfx/riser.wav", // before a big reveal
  shutter: "sfx/shutter.wav",
  type: "sfx/type.wav",
} as const;
