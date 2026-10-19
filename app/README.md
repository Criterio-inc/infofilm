# Infofilm-appen

Infofilm-appen är ett litet lokalt skal runt infofilm-skillen. Den startas från Dock, öppnas i ett eget fönster och samlar hela arbetsgången på ett ställe:

| Del | Vad den gör |
|---|---|
| **Filmer** | Visar alla projekt med kund, typ, format, status och vad som är nästa steg. |
| **Ny film** | En guide där du väljer kund (profil), klipp eller film och format, och skriver en brief. Claude kan sedan börja direkt med research och manus. |
| **Filmsidan** | Leder dig genom fem steg, en sak i taget: **Manus**, **Röst**, **Bilder**, **Titta igenom** och **Leverera**. Stegraden överst visar vad som är klart. Kortet under visar nästa steg med en enda huvudknapp, vad det kostar och hur lång tid det tar. Du kan gå tillbaka till ett tidigare steg; ändrar du manuset eller filmen efter ett godkännande behöver du godkänna igen. |
| **Vill du ändra något?** | Skriv med egna ord, eller tryck på ett förslag, så ändrar Claude. Samtalet fortsätter där det slutade. |
| **Kostnader** | Röst och bilder kostar pengar. Kortet visar kostnaden och vad som finns kvar hos ElevenLabs och OpenRouter, och inget körs förrän du har godkänt i en ruta. Godkännandet skrivs in i `notes/log.md`. |
| **Titta igenom** | **Gör en snabbversion** renderar hela filmen i halv upplösning på en till två minuter, och den spelas direkt på sidan. |
| **Leverera** | Gör de färdiga filmerna i alla format. **Färdiga filer** visar bara filmerna och undertexterna, och **Visa i Finder** markerar just den filen. |
| **Musik** | Under **Avsändare → Musik** lägger du in avsändarens bakgrundsslingor (WAV eller MP3), ger dem namn och väljer vad nya filmer får: en slinga eller ingen musik. Varje film kan välja en annan slinga eller ingen, i guiden för ny film och i steget **Titta igenom**. |
| **Fel** | Ett steg som inte gick förklaras med en mening om vad som hände och vad du gör. **Låt Claude titta på felet** skickar loggen till Claude. Loggar, stillbilder, Remotion Studio och projektmappen ligger under **Tekniska detaljer**. |
| **Avsändare** | En sida per avsändare: ett företag, en kund eller ett eget tema, till exempel en rolig film utanför jobbet. Där laddar du upp kundens material: grafisk manual, loggor, typsnitt, exempelbilder och länkar. **✦ Bygg profilen från materialet** låter Claude fylla i färger, typsnitt, logga, bildstil, röst och tonalitet, och det som saknas skrivs som frågor. Du kan också justera allt själv, bland annat med färgväljare per färgroll, och se resultatet med **Rendera testbilder** i 16:9 och 1:1. Under **Designsystem** länkar du kundens designsystem (Claude Design eller webben): Claude läser det när profilen byggs, synkar in dess färger och typsnitt med **✦ Synka designsystemet**, och läser det igen före varje manus, bildprompt och scen. En enskild film kan få egna länkar i guiden för ny film. Profilerna sparas i `~/Kundprofiler`, utanför repot. Inbyggda profiler, som `critero`, kopieras dit när du ändrar dem. |
| **Röst** | Under steget Röst på filmsidan skriver du röstbeskrivning och provtext, eller klistrar in ett färdigt Voice ID från ElevenLabs. **Spara som standardröst** lägger rösten i kundprofilen, så att kundens kommande filmer får samma berättare. |
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
