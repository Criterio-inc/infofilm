# Profiles: one look and sound per client

A profile holds everything a client keeps from film to film. `scripts/new_film.sh --profile <id>` puts it into a new project, so a new clip starts in the client's colours, type, logo, narrator and music.

| Profile | What |
|---|---|
| `criterio` | Criterio AB's own look. It is the **default**. Its colours, fonts and logo are placeholders until they are filled in from Criterio's brand guidelines. |
| `_mall` | The starting point for a new client: a clean, modern, light look with no film grain. |
| `newsreel` | The original house style: a 1950s instructional-card newsreel with a mascot and Suno jingles. |

Profiles are looked up in `$INFOFILM_PROFILES/<id>` first, then here. Point `INFOFILM_PROFILES` at a private folder or repository when client material should not live in the skill's repository.

## A new client
```bash
scripts/new_profile.sh boras-stad --name "Borås Stad"     # copies _mall, fetches the fonts
```
Then fill it in from the client's brand guidelines:
1. `profile.json`: the colours (`palette`), fonts, logo, card shape, motion, and the end-card line and address.
2. `logo.svg` (or a PNG with a transparent background; set `logo.file`). It sits on the `band` colour, so pick the variant for that background.
3. `style.json`: the look of the illustrations, plus the `never` list.
4. `design.json`: the narrator's voice brief. Once a voice is designed and saved, add `voice.json` (`{"voice_id": …}`) so every film reuses it.
5. `NOTES.md`: tone of voice, words to use and avoid, who approves, and which services the client allows.
6. After changing fonts, run `python3 ../template/tools/fetch_fonts.py <profile-dir>`.

Check the look by making a demo clip and looking at its stills:
```bash
scripts/new_film.sh /tmp/test --profile boras-stad --mode klipp --format 16:9,1:1
cd /tmp/test/video && node tools/stills.mjs S01-the-year 120,520 && node tools/stills.mjs S03-end-card 120
```

## profile.json
| Key | What |
|---|---|
| `name`, `kicker` | The client's name. The kicker is the small label in the title band. |
| `language`, `locale` | The defaults for a new film (`sv`, `sv-SE`). The locale formats numbers: 8 051 355 · 28,02. |
| `formats` | Optional. The default formats, for example `["16:9", "1:1"]`. |
| `palette` | Colours by **role**, never by name (see below). A missing role falls back to the newsreel's colour. |
| `fonts.display` / `ui` / `script` | `{"family", "google": true, "weights": […]}` for Google Fonts, or `{"family", "files": [{"file": "fonts/X.woff2", "weight": 700}]}` for the client's own font files. `display` also takes `uppercase` (titles in capitals) and `widthEm` (the average glyph width, used to fit long titles). |
| `card` | `radius`, `border` (0 means no ink border) and `shadow`. |
| `plate` | The same for the infographic panels. |
| `motion` | `"slide"` (a calm slide and fade) or `"deal"` (the newsreel's card dealt onto the table). |
| `backdrop` | `"plain"` (a gradient) or `"starbursts"`. |
| `filmLook` | `true` adds grain, flicker, dust and gate weave (newsreel only). |
| `ground` | What shows when there is no picture: `"soft"` (brand-colour circles) or `"starburst"`. |
| `logo` | `{"file": "logo.svg", "height": 56}` or `null`. |
| `endCard` | `{"line", "url"}`, shown by the built-in `end-card` scene. |

### Palette roles
| Role | Use |
|---|---|
| `backdrop`, `backdropLight` | The table behind the card. |
| `surface`, `surfaceLight`, `surfaceDark` | The card, the plates and their darker variant. |
| `band`, `bandText`, `kicker` | The title and caption bands, their text, and the kicker. |
| `ink` | Outlines and main text. |
| `primary` | The brand's main colour: labels, ▲ ▼ and key shapes. |
| `accent`, `accentDark`, `highlight` | Secondary brand colours. |
| `signal` | Used sparingly, for the one thing that must be seen. |
| `positive` | A neutral "yes" colour. Never use red and green as good and bad for a side. |
| `dim` | What the picture fades towards under a plate: dark for dark looks, white for light ones. |
| `faint` | Source lines and secondary text. |

Check contrast: `bandText` on `band` and `ink` on `surfaceLight` should reach at least 4.5:1 (WCAG AA).

## Assets reused across films (optional)
| In the profile | Goes to | Use |
|---|---|---|
| `img/ref-*.png` | `art/img/` | A recurring character's reference image. Set `"reference": "img/ref-….png"` in `style.json`. |
| `voice.json` | `voice/voice.json` | The client's saved narrator, so there is no new voice design for each film. |
| `music/*.wav` + `music/cuts.json` | `music/suno/` + `music/cuts.json` | The client's sound. The keys are wired by mode: **klipp**: `sting` (a sound logo of 2–5 s before the first word), `bed` (a loop under the speech), `outro` (after the end card). **film**: `theme`, `bed`, `jingle`, `ballad`. A key without a file is simply skipped. |
