# Scenes (Remotion)

## How a scene is found and timed
- `tools/build_timeline.py` writes `video/src/timeline/master.json`: one entry per script scene, with frame ranges, the narration file, per-word times, the card title and kicker, music hooks and the illustration path.
- `Video.tsx` plays the scenes in order. `scenes/index.ts` looks each one up by **name** in the registries; unknown names render as `Placeholder` (the card and its picture). So the film plays from day one.
- Inside a scene, `useScene()` gives `frame`, `durationInFrames`, `lead`, `speechEnd`, `title`, `kicker`, `img`, `after`, and `cue(phrase, n?)` / `cueEnd(...)`. Those return the scene frame where a phrase starts or ends being spoken.
- Before narration exists the word times are estimated from the text, so scenes can be built and reviewed for free. When the narration lands, the cues move to the real words without code changes.
- Tools:
  - `python3 tools/cues.py <name> "phrase"` prints frames.
  - `python3 tools/lint_cues.py` fails on any cue that doesn't occur in its scene's narration.

## Golden scenes first
The scaffold ships the demo's golden scenes (`TheYear.tsx`, `TheRule.tsx`, registered in `golden.ts`). Delete them and register your own.
Build the two scenes that carry the film's central infographics **yourself**, before you fan out. They set the bar for density, timing, type sizes, plate placement, captions and stamps, and every builder copies their structure. The template ships two: `TheYear.tsx` (a counter, an orbit, a decimal snapping on with a stamp) and `TheRule.tsx` (three rules, then three verdicts landing on their years).

The anatomy of a golden scene:
1. Cue constants at the top: `const tSeats = s.cue("three hundred and forty-nine")`.
2. Derived animation values from `prog` / `pop` / `interpolate` at those cues.
3. One `<Card>`:
   - `title`, `kicker` and `img` from `useScene()`
   - a `focus` that keeps the subject visible
   - `dim` rising as the plate arrives
   - `<Captions>` that swap on the same cues.
4. The infographic on a `<Plate>`, with numbers from `data.ts` through `<Counter>` / `fmt()`.
5. At most about two `Stamp`s and about four `Sfx`, all on cues.

## Fan-out to builders
For a film of 25+ scenes, run 2–3 builder subagents in parallel:
1. Split the scenes into contiguous groups (A: opening + part 1; B: commercial breaks + part 2; C: part 3 + closing).
2. Create the empty registries `src/scenes/groupA.ts`, `groupB.ts` and `groupC.ts` (same shape as `registry.ts`), and spread them into `index.ts` **before** the builders start.
3. Fill in the `{{…}}` lines in `video/CONTRACT.md` (title, minutes, language, look, tone).
4. Prompt each builder with: the contract path, its scene ids, "register only in groupX.ts", "never edit another group's files, the primitives, data.ts or the golden scenes", "verify every scene with `node tools/stills.mjs` and look at the sheet", "correct diacritics (å ä ö …) in all on-screen text", and "finish with a note per scene and any fact you were unsure of".
5. Set `STILLS_DIR` to a scratch folder per builder so their sheets don't collide.

When they finish, run `lint_cues.py` and `tsc`, then review every scene yourself with `node tools/review.mjs 6 S02-name S03-name …` (one sheet per scene, 6 evenly spaced frames). Look at every sheet.

## What to look for in a sheet
- Clipping: text cut by a plate or the window edge, decimals cut off, long titles. The card shrinks long titles automatically, but labels don't shrink.
- Overlap: stamps over numbers, labels over bars, plates over the mascot's face.
- Something that should land on a word arriving early or late. Check the cue.
- Dead air: more than 4 s with nothing new.
- Layers piling up: the previous beat should step back when the next arrives.
- A wrong number. Compare against `data.ts` and the research.

## Primitives
| Name | Use |
|---|---|
| `Card` | the scene's frame: `title`, `titleNode` (custom title, e.g. a Lobster slogan), `kicker`, `img`, `zoom`, `focus`, `dim`, `caption`, children in window coordinates |
| `Plate` | a cream panel with an ink border for an infographic |
| `Captions` | caption text that swaps on cues |
| `Counter` | a number that counts up and lands on a frame |
| `Stamp` | a rubber stamp slamming down, with a thump |
| `Token` | a round letter marker for an entity |
| `Appear` | fade + rise in, optional out |
| `Sfx` | one sound effect at a frame |
| `Label` | Jost text |
| `fmt` | locale number formatting |
| `KineticLyrics` | sung lines as big bouncing type, word by word on the beat |
| `CommercialBreak` | a test card under the narrator, a CRT switch on the jingle, then the picture with kinetic lyrics, glitter and your product shots as children |
| `TestCard`, `Starburst`, `starburstPath`, `sparklePath` | 50s ad shapes |
| `beatPulse`, `onBeat`, `wordFrames`, `lineAt` | beat and lyric timing |

Domain primitives (a hemicycle for a parliament, a map, a timeline ruler) belong in `src/primitives/` too. Build them in the golden phase, so all builders share one.

## Determinism and performance
- No `Math.random` and no `Date`: use `rand(seed)`.
- Animate transform, opacity and SVG attributes. Avoid large blurs and thousands of DOM nodes.
- Every Remotion bundle copies `public/`. The still tools delete their bundle on exit, but a crashed process can leave hundreds of MB in the temp folder, so check after a long day.
