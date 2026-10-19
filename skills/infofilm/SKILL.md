---
name: infofilm
description: Make narrated infographic clips and explainer films for clients, in the client's own look — a 30–90 s clip (klipp) with one message, or a 2–15 minute film in parts — in 16:9 and/or 1:1, with code-drawn infographics that land on the spoken word. Each client is a profile (colours, fonts, logo, illustration style, narrator, music) reused across films; Criterio AB's is the default, the original 1950s newsreel is one of them. Pipeline: research → fact-checked script → ElevenLabs narrator with per-character timestamps → Suno music → Gemini illustrations → Remotion scenes cued to words → −14 LUFS master + SRT. Use when the user asks for a film, clip, explainer video, infographic film, "ett klipp om …", "gör en film om …", "en film till <kund>", a new client profile, or another film "like the election film".
---

# infofilm: infographic clips and films for clients

A film made with this skill is a sequence of **cards**. Each card has a title band (with the client's logo), a picture window and a caption band. An AI illustration plays in the window, and **code-drawn infographics** arrive on top of it **on the exact word** that names them. A narrator carries the meaning.

Every number, title and label is drawn in code from a fact base. Pictures never carry text.

The template in `template/` is a complete, working film: a demo about leap years. Scaffold it, then replace the demo with your film piece by piece. The film renders at every step: scenes without a component show their card, and scenes without narration get estimated timing. That way you can always look at the whole thing before you spend money.

## Profile, mode and format: decide these first
- **Profile** (`profiles/`, or `$INFOFILM_PROFILES`): the client's look and sound, kept across films. It holds the palette by role, fonts, logo, card shape, motion, illustration style (`style.json`), narrator (`design.json`, `voice.json`), reusable music, and `NOTES.md` (tone, approvals, allowed services). `criterio` (Criterio AB) is the default. `newsreel` is the original 1950s house style; `_mall` is the starting point for a new client (`scripts/new_profile.sh`). **Read the profile's `NOTES.md` before writing a script or a prompt.** See [profiles/README.md](profiles/README.md).
- **Mode**:
  - `klipp`: 30–90 s, ONE message, 2–5 scenes, no parts and no commercial breaks. It is a hook in the first 2 seconds, 1–3 scenes that each show one thing, then the built-in `end-card` (logo, line, address).
  - `film`: 2–15 min in parts, as below.
- **Format**: `16:9`, `1:1` and/or `9:16`. One project renders every format in film.json `formats`. Scenes lay out from `WIN` and `WIDE` in `theme.ts`, so they work in each (see [references/scenes.md](references/scenes.md)). Illustrations are generated in a shape that suits all the chosen formats.

A client that is new to the skill gets a profile first (phase 2), before any film.

## Standing rules (they override convenience)

1. **Money: ask first.** ElevenLabs, image generation and Suno downloads cost real money or quota. Before every paid batch, state what it is, how many items, and the estimated cost; `--dry-run` prints it. Wait for a yes. A yes covers that batch only, unless the user has given standing approval ("you have the go-ahead for images, voice and music"). Log every approval and cost in `notes/log.md`.
2. **Never guess a fact.**
   - Every claim and number comes from `notes/research.md`, which cites primary sources. Every on-screen number comes from `video/src/data.ts`, which cites the research section.
   - Current events must be verified against primary sources. If something cannot be verified, it stays out of the film, or the scene waits; see "Scenes that wait" in [references/script.md](references/script.md).
3. **Text and numbers are drawn in code, never by the image model.** Image prompts forbid text, and every image is inspected anyway.
4. **The user listens, Whisper doesn't.** Never transcribe generated speech to check it; Whisper hears more errors than there are. Give the user a listening page instead.
5. **Impartial, and in the client's voice.** Follow the tone in the profile's `NOTES.md`. Satire (the newsreel's) aims at the system, never at a party, group or person. Treat sides identically in size, colour logic and animation. No real people or logos in pictures; the client's logo is drawn in code (the title band and the end card), never by the image model.
6. **Correct diacritics everywhere** (å ä ö é ü …), including in prompts to subagents. Tell every subagent explicitly.
7. **Read the user's words literally.** "Dystopian", "retro" or "Fallout-ish" are moods, not prop lists. When a style word could mean several things, show proposals and confirm before building on it (see [references/style.md](references/style.md)).

## The pipeline

Work through these phases in order. The ⛔ steps are gates: stop and get the user's decision before going on.

### 0 · Kick-off
- Confirm the client (profile), mode (klipp or film), format(s), subject, audience, channel (web, LinkedIn, intranet, a meeting), language, length and purpose. When the user names a client without a profile, make one first (phase 2). Check `ELEVENLABS_API_KEY` and `OPENROUTER_API_KEY` in the environment, Chrome with the claude-in-chrome extension and a Suno login, and `node`, `pnpm`/`npm`, `ffmpeg` and `python3` with `numpy` and `elevenlabs`.
- Scaffold:
  ```
  <skill>/scripts/new_film.sh <dir> --profile criterio --mode klipp --format 16:9,1:1 --slug my-clip --title "My Clip"
  ```
  This copies the template, puts the profile in (`brand/`, `art/style.json`, `voice/`, `music/`), installs Remotion, synthesises the sound effects, builds a first timeline and typechecks. Language and locale come from the profile; override them with `--lang`/`--locale`. To switch an existing project to another profile, run `scripts/apply_profile.py <profile-dir> <project-dir>`.
- Keep decisions in `notes/log.md`, with dates and who decided.
- Renders need room. Check `df -h`, and point `OUTDIR` at a big disk when the system disk is under about 20 GB free.

### 1 · Research → `notes/research.md`
- Write numbered sections (`## 2.3 · The threshold`), one fact or cluster per section, each with its primary source: legislation, official statistics, the authority's own pages.
- Mark anything uncertain. For a recent event, record the date the facts are valid for.
- See [references/script.md](references/script.md).

### 2 · Look ⛔ (once per client, not once per film)
- An existing profile is the look: use it as it is. A new client needs a profile first: `scripts/new_profile.sh <id> --name "…"`, then the colours, fonts and logo from the client's brand guidelines. Ask for the guidelines and the logo file, and never guess a client's colours. After that come the illustration style in `style.json` and the narrator brief in `design.json`.
- Show the profile with the demo's stills in each format (`profiles/README.md`), plus 2–3 test illustrations in the proposed style (`python3 art/gen.py --dry-run`, then ask).
- A recurring character is optional. If the client wants one, generate the reference portrait (`kind: "ref"`) and a model sheet, get them approved, and store the reference in the profile's `img/`.
- ⛔ The user approves the profile. Details: [references/style.md](references/style.md) and [references/images.md](references/images.md).

### 3 · Script → `script/script.md` ⛔
- **klipp**: a hook in the first sentence, 1–3 scenes of 10–25 s that each show one thing, then `## Sxx · end-card`, all under one `# KLIPP` heading. Budget about 120–150 words for 60 s. The scaffold's `script.md` shows the shape.
- **film**: an opening, 2–4 parts and a closing. The newsreel profile adds a theme, commercial breaks and a ballad. Each scene is one card of 15–40 s.
- The words budget is minutes × about 127 words per minute (a calm Swedish narrator: measure, often 140–150).
- Spell numbers out in the narration; the cards show the exact digits.
- Avoid date-bound words like "on Monday". The film outlives the week.
- **Review before anyone pays.** Have an independent subagent check the script **and the research** against primary sources, sorting its findings into MUST, SHOULD and COULD. Fix everything rated MUST. Reviews have caught errors in the research itself.
- ⛔ The user approves the script. Format and craft: [references/script.md](references/script.md).

### 4 · Narrator ⛔
0. If the profile has a `voice.json`, the client's narrator already exists: skip to step 2.
1. Design 3 takes with `voice/design_voice.py preview <tag>` (ask first), and let the user pick one. Save it with `create`.
2. Do a test reading of 2 representative scenes and let the user approve the pace and pronunciation.
3. Read everything: `python3 voice/narrate.py --dry-run`, then ask, then run it.
4. Once the client approves a new voice, copy `voice/voice.json` into the profile so later films reuse it.

Edit a scene later and only that scene is billed again. Details and pitfalls: [references/voice.md](references/voice.md).

### 5 · Music (Suno, official web UI, via Chrome)
Reuse the profile's music when it has any: `new_film.sh` has already copied it in and wired it. A **klipp** needs at most a `sting` (a sound logo of 2–5 s), a `bed` and an `outro`. Make them once per client and store them in the profile's `music/` with its `cuts.json`.

A newsreel **film** needs these cues:
- an opening **theme** of about 20 s, which works brilliantly in Speech mode as a deadpan close-harmony voice
- one instrumental **bed** per part, looped and ducked under the voice
- a sung **jingle** for each commercial break
- a **closing ballad**, typically a Cover of the theme.

Prompt for American 1950s idioms; genre words like "schlager" drag the music somewhere else. The user likes takes in Suno, unless they have handed you the choice. Download WAV through Suno's own menu, fetch the aligned lyrics for the cut points, and write `music/cuts.json` and `video/src/lyrics.ts`. Details: [references/music.md](references/music.md).

### 6 · Illustrations
- One 21:9 2K image per scene, `film-Sxx` in `art/shots.json`, drawn from the mascot reference. Cost: `python3 art/gen.py --dry-run`, then ask.
- **Look at every image** for text, doubled props, extra limbs and the wrong outfit, and regenerate the bad ones.
- Run `python3 tools/sync_art.py` and then `python3 tools/build_timeline.py`. Details: [references/images.md](references/images.md).

### 7 · Scenes (Remotion)
- Every scene lays out from `WIN` and `WIDE` (`theme.ts`), so it works in every format the film renders. Check stills in each format: `FORMAT=1:1 python3 tools/build_timeline.py`, then the stills, then rebuild without `FORMAT`.
- A **klipp** of 2–5 scenes needs no builders: build every scene yourself.
- Build **two golden scenes yourself**: the scenes that carry the film's central infographics. Make them meet the bar, and register them in `golden.ts`, replacing the demo's `TheYear`/`TheRule`.
- Then fan out to 2–3 parallel builder subagents with `video/CONTRACT.md` (fill in its `{{…}}` lines). Each builder has its own group registry and verifies with contact sheets.
- Builders can start before the narration exists, because cues follow the estimated words and then move to the real ones by themselves. If the script changes while they work (a review lands), send each builder the exact changes for its scenes with SendMessage.
- Review every scene's sheet yourself.
- Details: [references/scenes.md](references/scenes.md).

### 8 · Render and deliver
- Run `tools/render.sh`. For each format it rebuilds the timeline, lints the cues, typechecks, renders and applies two-pass loudnorm to −14 LUFS / −1 dBTP. The main format becomes `<slug>.mp4`, the others `<slug>-1x1.mp4` and so on, plus one SRT. `tools/render.sh 1:1` renders a single format.
- Verify loudness per segment and spot-check frames from the mp4, then open the film for the user.
- Details: [references/render.md](references/render.md).

### 9 · Revisions
- Changed text: re-narrate just that scene, then rebuild the timeline. Cues follow the words automatically.
- Changed picture: regenerate the image, sync, rebuild.
- Changed music: edit `cuts.json`.

Visual fixes cost nothing but a re-render; only new narration, images or downloads cost money.

## Map of the template

| Path | What |
|---|---|
| `film.json` | title, slug, language, locale, profile, mode, formats, part kickers and beds, scene intro/after music, TTS model, outDir |
| `brand/` | the client profile (profile.json, logo, fonts, NOTES.md); `tools/build_timeline.py` turns it into `video/src/timeline/brand.json` |
| `script/script.md` | the manuscript: `## Sxx · name`, `<!-- title: -->`, `<!-- facts: -->`, `> visual:`, narration |
| `notes/research.md`, `notes/log.md` | the fact base; decisions and costs |
| `voice/` | `design.json` + `design_voice.py` (voice design), `narrate.py` (narration + timestamps), `listen.py` (listening page), `voice.json` |
| `music/` | `suno/*.wav`, `cuts.json`, `tools/beats.py` (tempo), `tools/suno_lines.py` (aligned lyrics → lines) |
| `art/` | `style.json` (the look, the never-list), `shots.json`, `gen.py`, `img/` |
| `tools/` | `build_timeline.py`, `cues.py`, `lint_cues.py`, `make_srt.py`, `sync_art.py`, `art_sheet.py`, `make_sfx.py`, `fetch_fonts.py`, `render.sh` |
| `video/src/` | `theme.ts` (palette `C` by role, `W`/`H`, `CARD`/`WIN`, `WIDE`), `fonts.ts` (`DISPLAY_FONT`, `UI`), `timing.tsx` (`useScene`, `cue`), `data.ts`, `lyrics.ts`, `Music.tsx`, `primitives/` (Card, EndCard, Bits, Film, Jingle, Hemicycle), `scenes/` |
| `video/tools/` | `stills.mjs` (contact sheet of chosen frames), `review.mjs` (N frames per scene, many scenes); `BROWSER_EXECUTABLE=<chrome>` uses an installed browser |

Known traps, with their fixes: [references/pitfalls.md](references/pitfalls.md).
