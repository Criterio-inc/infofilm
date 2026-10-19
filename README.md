# infofilm – kundklipp och förklarfilmer

En Claude Code-**skill** för berättade infografikfilmer i kundens egen grafiska profil:
- **klipp** på 30–90 sekunder med ett budskap, för LinkedIn, webb, intranät och möten
- **filmer** på 2–15 minuter i flera delar.

Formaten är 16:9 och 1:1, och samma projekt renderar båda. Siffror, rubriker och etiketter ritas i kod och landar på exakt det ord som berättarrösten säger.

Detta är en fork av [fltman/infofilm](https://github.com/fltman/infofilm) av Anders Bjarby. Originalets 1950-talsjournal finns kvar som profilen `newsreel`.

```
kundprofil → research → faktagranskat manus → berättarröst (ElevenLabs, tidskodad per tecken)
           → musik (Suno) → illustrationer (Gemini) → Remotion-scener på orden → −14 LUFS + SRT
```

## Så funkar det
- **En profil per kund** (`skills/infofilm/profiles/<kund>/`). Den innehåller färger (som roller), typsnitt, logga, kortform, rörelse, bildstil, berättarröst, återanvändbar musik och `NOTES.md` med tonalitet och regler. Den görs en gång och återanvänds i varje film. `criterio` är standard.
- **Två lägen.** `klipp` består av en krok, 1–3 scener och ett slutkort med logga. `film` består av delar.
- **Flera format i ett projekt.** Scenerna lägger ut sig efter fönstrets form. `tools/render.sh` levererar `<namn>.mp4` och `<namn>-1x1.mp4`.
- **Kod ritar allt som måste stämma.** Varje siffra kommer från `data.ts` ← `notes/research.md` ← primärkällor. Bildmodellen står bara för miljö och stämning, och bilderna innehåller aldrig text.
- **Filmen spelar alltid.** Scener utan komponent visas som kort, och scener utan röst får uppskattad tajming. Du kan alltså granska hela filmen innan något kostar pengar.
- **Pengar kräver ett ja.** Röst, bilder och musik har `--dry-run` som visar kostnaden, och skillen frågar innan den spenderar.

## Appen
I `app/` finns en liten lokal app som du startar från Dock. Den har en guide för nya filmer, en projektlista och knappar för förhandsvisning, stillbilder och rendering. Röst och bilder kräver ditt godkännande innan något debiteras, och via rutan **Be Claude** ger du instruktioner till Claude i varje projekt. Installera allt på en Mac med:
```bash
git clone https://github.com/Criterio-inc/infofilm.git ~/infofilm && ~/infofilm/app/macos/setup.sh
```
Mer finns i [app/README.md](app/README.md).

## Kom igång (utan appen)
```bash
git clone https://github.com/Criterio-inc/infofilm.git
cd infofilm && ./install.sh --link       # länkar skillen till ~/.claude/skills/infofilm
```
Be sedan Claude Code om ett klipp, till exempel *"gör ett 60-sekundersklipp till LinkedIn om … för Borås Stad"*. För hand ser det ut så här:
```bash
S=~/.claude/skills/infofilm/scripts
$S/new_profile.sh boras-stad --name "Borås Stad"              # ny kund: fyll sedan i profile.json, logga, NOTES.md
$S/new_film.sh ~/filmer/bs-budget --profile boras-stad --mode klipp --format 16:9,1:1 \
               --slug bs-budget --title "Budgeten på en minut"
cd ~/filmer/bs-budget/video && npx remotion studio src/index.ts  # förhandsgranska
cd .. && tools/render.sh                                         # bs-budget.mp4 + bs-budget-1x1.mp4 + .srt
```
Kundmaterial som inte ska ligga i det här repot (anteckningar, licensierade typsnitt) kan ligga i en separat privat mapp eller ett separat repo. Peka ut den med `export INFOFILM_PROFILES=~/kundprofiler`.

## Innehåll
```
skills/infofilm/
├── SKILL.md                 # pipelinen: profil, läge, format, faserna och grindarna
├── profiles/                # criterio (standard), _mall (ny kund), newsreel (originalet) + README
├── references/              # manus, stil, röst, musik, bilder, scener, rendering, fallgropar
├── scripts/
│   ├── new_film.sh          # nytt klipp eller ny film från mallen, i en kundprofil
│   ├── new_profile.sh       # ny kundprofil från _mall
│   └── apply_profile.py     # lägg in (eller byt) profil i ett projekt
└── template/                # en komplett film som renderar (demo om skottår)
    ├── film.json            # titel, språk, profil, läge, format, delar, musikkrokar
    ├── brand/               # (skapas) kundprofilen → video/src/timeline/brand.json
    ├── tools/               # build_timeline, fetch_fonts, cues, lint_cues, make_srt, render.sh …
    └── video/               # Remotion 4: Card, EndCard, Plate, Counter, Stamp …
```

## Krav
- Claude Code. För musik behövs tillägget [Claude in Chrome](https://claude.ai/chrome) och ett [Suno](https://suno.com)-konto.
- Node 20+ med pnpm eller npm, Python 3.10+ med `numpy` och `elevenlabs`, samt `ffmpeg`.
- `ELEVENLABS_API_KEY` för rösten och `OPENROUTER_API_KEY` för illustrationerna (Gemini 3 Pro Image).

## What a 12-minute film costs (measured)
| Item | Volume | Cost |
|---|---|---|
| Illustrations | 19–30 scene images at 2K (about $0.14 each), plus retakes and style tests | $3–9 |
| Narration | 6,500–8,000 characters (eleven_v4) | about 0.5 ElevenLabs credits per character: 6,760 characters cost 3,602 credits |
| Voice design | 1–2 rounds of 3 takes | a few hundred credits |
| Music | about 7 cues, 2–4 takes each | Suno credits; WAV downloads may count against a plan quota |
| Render | 13 minutes at 1080p30 | about 50 minutes on a laptop, about 1.2 GB |

## Films made with it
- **Svenska Valjournalen 2026** (13 min). The election film the skill was extracted from.
- **Svenska Journalen: Så styrs Sverige** (10.4 min). It is about Sweden's constitution and was the skill's first test run, made end to end from `new_film.sh`. The steps were:
  1. a research agent wrote 79 sourced sections
  2. an independent reviewer found 2 MUST and 9 SHOULD issues, which were fixed before a credit was spent
  3. 19 illustrations, three Suno cues and the narration were made
  4. two golden scenes were built by hand, and 17 scenes by three parallel builders.

## Licence
MIT. The template's fonts (Bowlby One SC, Jost, Lobster) are loaded from Google Fonts under the SIL Open Font License. The sound effects are synthesised by `tools/make_sfx.py`. Your film's narration, music and images are subject to the terms of the services that made them.
