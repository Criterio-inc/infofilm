# Scene builder contract

You build animated scenes for an infographic explainer film (1920×1080, 30 fps, Remotion 4). The orchestrator fills in the `{{…}}` placeholders below before handing this out.

- **Film:** {{TITLE}}, about {{MINUTES}} minutes, narrated in {{LANGUAGE}}. On-screen text is in {{LANGUAGE}} too, with correct diacritics (å ä ö é ü …) everywhere.
- **Look:** the house style: a 1950s instructional card with cream paper, navy and golden yellow, thick ink, halftone dots, and a retro-futurist world (the future as imagined in 1957: googie, chrome, rockets, monorails, friendly robots). Replace this line if the film has its own look.
- **Tone:** American 1950s commercial enthusiasm, cheerful and a little too eager, with a dry irony that the shiny machine keeps getting stuck. Replace this line if the film has its own tone.

This is an **explanatory film about real things**. Every number on screen must be true. If the subject is political, every party or side is treated exactly alike.

## Read first
1. `../script/script.md` is the manuscript. Each `## Sxx · name` is one scene. `> visual:` is the direction: follow it, or do something better that shows the same facts. Everything else is the narration.
2. `src/scenes/golden.ts` lists the **golden scenes**. Read them and match their structure and quality.
3. These files:
   - `src/theme.ts` (colours `C`; card geometry `CARD`/`WIN`)
   - `src/fonts.ts`, `src/anim.ts`, `src/timing.tsx`, `src/data.ts`, `src/lyrics.ts`
   - everything in `src/primitives/`: `Card`, `Plate`, `Captions`, `Counter`, `Stamp`, `Token`, `Appear`, `Sfx`, `Label`, `fmt`, and in `Jingle.tsx` `KineticLyrics`, `CommercialBreak`, `TestCard`, `Starburst`, `beatPulse` and `wordFrames`.
4. `../notes/research.md` is the fact base. `src/data.ts` holds every number, with its source.

## Where your code goes
- One file per scene: `src/scenes/<PascalCaseName>.tsx`, exporting a `React.FC` with no props.
- Register it ONLY in your own registry: `src/scenes/registry.ts`, or `src/scenes/group<X>.ts` when several builders work in parallel. Use one line per scene, `"scene-name": Component,`.
- Never touch another group's files, `index.ts`, the golden scenes, the primitives, `data.ts`, `theme.ts` or `Card.tsx`. Put a reusable helper of your own in `src/scenes/group<X>-kit.tsx`.
- If a number you need is missing from `data.ts`, stop and report it. Never invent one.
- Scenes are looked up by **name**, the part after `·`.

## The card is the film
Every scene is one `<Card>`: a title band, a picture window and a caption band. The card deals itself in and flies out by itself, so **never animate the whole scene in or out**.
- Pass `title={s.title}`, `kicker={s.kicker}` and `img={s.img}` from `useScene()`. `s.img` is `null` until the illustration exists, and the card then draws a halftone ground, so always pass it through.
- Everything you draw as `children` is in **window coordinates**: 0..1800 × 0..749.
- `dim` (0..1) darkens the picture when an infographic goes on top. Draw infographics on a `<Plate>` (a cream panel with an ink border).
- `caption` is the bottom band. Use `<Captions items={[{at, text}]}>`, which swaps the text on cues. Keep it under about 60 characters and on one line.
- The picture has a slow camera move (`zoom`, `focus`). Pick a `focus` that keeps the mascot or the subject in view when plates go on top, and let plates leave the mascot visible beside them.
- Many scenes work best when the picture plays alone for 2–4 s while the narration starts, and the infographic arrives on the right word.

## Time: `useScene()` (from `../timing`)
- Fields: `s.frame`, `s.durationInFrames`, `s.lead`, `s.speechEnd`, `s.after` (a jingle after the speech: `{key, at}`) and `s.intro`.
- `s.cue("phrase", n?)` gives the frame where the phrase **starts being spoken**, and `s.cueEnd(...)` the frame where it ends. Matching ignores case and punctuation.
- Use short, distinctive phrases (1–4 words) from the SAME scene's narration, and write numbers the way the narration spells them (`"three hundred and sixty-five"`).
- Never hard-code a frame for something that should land on a word; always use cues. Offsets like `cue(...) + 6` are fine.
- Look up frames with `python3 ../tools/cues.py <scene-name> "phrase" "phrase"` (from `video/`). With no phrases it lists every word with its frame.
- Lint with `python3 ../tools/lint_cues.py`, which must report 0 problems for your scenes.
- Before the narration exists the word times are **estimated** from the text. Build against them anyway: cues move to the real words by themselves once the voice is read.
- Sung lines in `src/lyrics.ts` have times in seconds from the start of the cut. A jingle starts at `s.after.at`.

## Visual language (unconditional)
- **Colours:** only from `C` in `theme.ts`. Data colours (parties, countries) come from `data.ts` and are used only for that entity's own data.
- **Fonts:** `DISPLAY` (Bowlby One SC) for titles, stamps and big numbers; `UI` (Jost) for labels and sentences; `SCRIPT` (Lobster) **only** in commercial breaks.
- **Entities** (parties, countries, institutions) appear as `Token`s or plates of the same size, type and animation, with their full name in text. No logos, no portraits and no real people in pictures. People are named only in text.
- **Numbers** come only from `data.ts`. Format them with `fmt()`, which follows the film's locale. A small source line (UI, 20 px, `C.faint`) is good next to exact figures.
- **On-screen text:** titles at most 5 words, labels at most 8. No paragraphs: the narrator speaks the sentences.
- **Up and down** in data are ▲ and ▼ in navy. Never use red and green as good and bad for a side's data.
- **The forbidden motifs** listed in `../art/style.json` ("never") are forbidden in code too. That covers shapes, symbols and words.

## Energy
- Something meaningful changes every 2–4 seconds: a new element, a swap, a counter, a camera move. The pace is a newsreel, not fireworks.
- Numbers count up and land on the word that says them (`Counter` with `at={cue(...)}`).
- `Stamp`s are for real punchlines, at most about two per scene.
- Sound effects are `<Sfx at name volume>`, at a volume of 0.2–0.35, at most about four per scene.
- When a new beat starts, the previous one steps back or leaves, so layers never pile up.
- Keep the last half-second calm, because the card is flying out.

## Technique
- Keep it deterministic: no `Math.random` and no `Date`. Use `rand(seed)` from `anim.ts`.
- For performance, use transform, opacity and SVG. Avoid big `filter: blur()` and more than about 1,500 DOM nodes.
- Images come only from `public/img/`. Everything else is CSS or SVG, with no network calls.
- TypeScript must compile: `npx tsc --noEmit -p .` (from `video/`).

## Verify like a designer
Render 5–8 stills per scene at meaningful cue frames in ONE call, and LOOK at the contact sheet:
```
node tools/stills.mjs <Sxx-scene-name> <frame,frame,…>
```
The command prints the path of a contact sheet, which you open with the Read tool. Single frames are `<id>_<frame>.png` in the same folder; open them at full size when a detail matters.

Check that:
- nothing is clipped or overlaps other text
- everything is readable
- the composition is balanced
- every frame tells its moment.

Fix and re-render until it looks like an expensive infographic film.

Other builders may be rendering at the same time. Never run more than one render command at once, never render the whole film and never render video.

## Done means
- Every scene in your group renders, is registered, and passes `lint_cues.py` and `tsc`.
- Finish with a short note per scene: what is on screen, which cues drive it, and any fact you were unsure of.
