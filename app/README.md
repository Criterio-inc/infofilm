# Infofilm-appen

Infofilm-appen är ett litet lokalt skal runt infofilm-skillen. Den startas från Dock, öppnas i ett eget fönster och samlar hela arbetsgången på ett ställe:

| Del | Vad den gör |
|---|---|
| **Filmer** | Visar alla projekt med kund, typ, format, status och vad som är nästa steg. |
| **Ny film** | En guide där du väljer kund (profil), klipp eller film och format, och skriver en brief. Claude kan sedan börja direkt med research och manus. |
| **Projektsidan** | Har ett avsnitt per steg: manus, röst, bilder, scener och rendering. |
| **Be Claude** | Fri instruktion till Claude i projektet, t.ex. "gör scen 2 luftigare". Samtalet fortsätter där det slutade. |
| **Kostnadsgrindar** | Röst och bilder kostar pengar. Knappen **Vad kostar det?** visar vad som skulle debiteras, och först **Godkänn och kör** gör det på riktigt. Godkännandet skrivs in i `notes/log.md`. |
| **Förhandsgranska** | Startar Remotion Studio för projektet. |
| **Stillbilder** | Visar sex bilder per scen i varje format. |
| **Rendera** | Renderar alla format med en knapp och spelar upp resultatet. **Öppna leveransmappen** visar filerna i Finder. |
| **Inställningar** | Visar vad som saknas på datorn, och här anger du mappar och API-nycklar. Nycklarna sparas bara lokalt, i `~/.infofilm/secrets.json`. |

## Installera (en gång, på Macen)
```bash
git clone https://github.com/Criterio-inc/infofilm.git ~/infofilm
~/infofilm/app/macos/setup.sh
```
Skriptet gör följande:
- installerar Xcodes kommandoradsverktyg, Node, Python och ffmpeg
- lägger Python-paketen i `~/.infofilm/venv`
- länkar skillen till `~/.claude/skills/infofilm`
- installerar Claude Code om det saknas
- bygger **Infofilm.app** i `~/Applications` och öppnar den.

Till sist skrivs en sammanfattning ut av vad som fungerar.

Infofilm är en riktig Mac-app med eget fönster och egen ikon. Högerklicka på ikonen i Dock och välj **Alternativ → Behåll i Dock**. Logga in i Claude Code en gång med `claude` i Terminalen, och lägg in API-nycklarna under **Inställningar** i appen.

Uppdatera så här:
```bash
cd ~/infofilm && git pull && app/macos/make-app.sh
```

## Så fungerar det
- **Infofilm.app** (`macos/main.swift`) visar appen i ett eget fönster och kör `start.sh`, som startar servern (`node server.mjs`, port 4747, nås bara från den här datorn).
  - Stänger du fönstret ligger appen kvar i Dock. Klicka på ikonen så kommer fönstret tillbaka.
  - **⌘Q** avslutar appen och servern. Om en rendering pågår frågar appen först.
  - Länkar och Remotion Studio öppnas i din vanliga webbläsare.
  - Saknas Xcodes kommandoradsverktyg byggs i stället ett startskript, som öppnar appen i ett Chrome-fönster.
- Ikonen ritas av `macos/make_icon.py` enligt Apples ikonrutnät.
- Knapparna kör skillens egna verktyg i projektmappen (`tools/build_timeline.py`, `review.mjs`, `render.sh`, `voice/narrate.py`, `art/gen.py`). Loggen strömmas till rutan **Aktivitet**.
- Claude körs som `claude -p` i projektmappen med skillen. Claude får läsa, skriva och köra skillens gratisverktyg, och får söka på webben. De betalda stegen är spärrade för Claude och görs bara med appens knappar efter ditt godkännande.
- Filmerna hamnar i `~/Filmer`, eller i den mapp du väljer under **Inställningar**. Egna kundprofiler kan ligga i en separat mapp, som du också anger där.
- Loggar finns i `~/.infofilm/server.log` och `~/.infofilm/launcher.log`.

Appen har inga beroenden utöver Node. Den behöver ingen `npm install` och har inget byggsteg.
