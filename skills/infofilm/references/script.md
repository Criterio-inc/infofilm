# Research and script

## Research (`notes/research.md`)
- Write one numbered section per fact or tight cluster: `## 3.2 · Turnout`. Each section holds the claim, the exact figures, the **primary source** (a law, official statistics, the authority's own page, an official record), and the date the figure is valid for.
- Secondary sources such as news and Wikipedia help you find things, but they don't count as a source.
- Write down what is *not* known. "The outcome of Monday's vote is not yet known" is a fact the film can use.
- Copy every figure that will appear on screen into `video/src/data.ts`, with a comment naming the research section. Scenes never type numbers.
- Before a political or contested subject, decide the impartiality rules and write them into the research file: every side gets the same treatment, and you use neutral verbs.

### Delegating the research
A research subagent does this well when its prompt includes:
- the film's subject, language and "timeless, not today's news"
- the list of topics in film order
- the list of acceptable primary sources by name
- the required format: numbered sections, claim + figures + statute + URL + short statute quote, **OSÄKERT/UNCERTAIN** markers, and the date for every figure that can change
- a closing **"Traps"** section (simplifications the film must not make) and a **"Figures for data.ts"** list.

Tell it to write the file and report back in 15 lines: what was hard to verify, what is uncertain, and the three biggest traps. In one production this surfaced a pending constitutional amendment that would change the very rule a scene explained. The scene was then worded so it stays true either way, and it carries a comment to re-check after the vote.

## The manuscript (`script/script.md`)
```markdown
---
title: …
language: sv
status: draft 1
---

# PART 1 — HOW IT WORKS

## S05 · seats
<!-- title: 349 SEATS -->
<!-- facts: 1.1 2.5 -->
> visual: the chamber; robot arms set out chair after chair; a bracket over 175: 175 = MAJORITY.

Now for the main event! Parliament has three hundred and forty-nine seats. Whoever has one hundred and seventy-five of them behind them has a majority of their own.
```
- **`## Sxx · name`** starts a scene. One scene is one narration file and one card. The name is how components find their scene, so keep it a stable kebab-case word.
- **`<!-- title: -->`** is the card title: at most 5 words, in capitals, in the film's language. It must not repeat the part's kicker (film.json `parts`), because the two sit side by side in the title band.
- **`<!-- facts: -->`** lists the research sections the scene rests on. The reviewer checks every scene against them.
- **`> visual:`** is the direction for the illustration and the infographic, written as beats: what arrives on which word.
- **Narration** is everything else, read exactly as written. Each paragraph becomes one line of the TTS request.
- **Comments** (`<!-- … -->`) on one line or many are never read aloud. Use them for production notes like "⚠️ waiting for Monday's vote".

## Shape of a 12-minute film (about 27 scenes)
| Part | Scenes | Notes |
|---|---|---|
| Opening | 1 | The theme plays, the mascot says hello in pantomime, and the narrator greets the "citizens" and says what tonight's journal covers |
| Part 1 — how it works | 7–9 | One concept per card, in order of dependency |
| Commercial break 1 | 1 | The narrator: "a short message from our sponsor". A sung jingle sells the system as a household appliance ("New! Democracy in every home!") |
| Part 2 — what happened | 6–8 | The numbers, the drama, the result |
| Commercial break 2 | 1 | A shorter jingle |
| Part 3 — what happens now | 6–8 | Process, timeline, open questions |
| Closing | 1–2 | The next date to remember, then the closing ballad over the credits |

## Craft
- **Register:** a 1950s newsreel announcer who believes every word. Use exclamations, rhetorical questions and "citizens!". Keep it cheerful even about the absurd. The irony lives in the gap between the tone and the facts, never in sneering.
- **Numbers:** spell them out in the narration, rounded ("more than eight million"). The card shows the exact figure (8 051 355). Cue phrases then use the spelled-out words.
- **One idea per card.** If a scene needs two infographics, it is two scenes.
- **Recurring motifs** pay off: a number to remember ("Remember that number, citizens. One hundred and seventy-five."), the mascot's gesture, the shiny machine that keeps getting stuck.
- **No date-bound words** ("on Monday", "next week"). Write "on the nineteenth of October" or restructure.
- **Credits:** say what was AI-made (voice, music, pictures) and name the author. Name nobody who did not take part.

## Review before narration
Spawn an independent reviewer subagent with the script, the research file and web access. Its job:
1. Check every claim and number against **primary sources**, including the claims in the research file itself.
2. Check impartiality, register and date-bound wording.
3. Report findings as **MUST** (wrong or misleading), **SHOULD** (unclear, unbalanced, weak) and **COULD** (polish), each with the scene, the quote, the source and a fix.

Fix every MUST in both the script and the research, apply the SHOULDs you agree with, and log the result in `notes/`. In one production the first review caught 5 MUST errors, two of them in the research.

## Scenes that wait
When a scene depends on news that hasn't happened yet, write the scene with a production comment and keep everything else moving:
```markdown
## S25 · where-we-are
<!-- ⚠️ WAITING for the Speaker's announcement on 19 October, 13:30 -->
```
Give the scene its best current narration or leave it short. The timeline estimates its length, and the film renders with the scene as a placeholder card. After the news: update the research, rewrite, narrate just that scene, build its component and render again.
