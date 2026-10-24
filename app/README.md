# Infofilm-appen

Infofilm-appen är ett litet lokalt skal runt infofilm-skillen. Den startas från Dock, öppnas i ett eget fönster och samlar hela arbetsgången på ett ställe:

| Del | Vad den gör |
|---|---|
| **Filmer** | Visar alla projekt med kund, typ, format, status och vad som är nästa steg. |
| **Ny film** | En guide där du väljer avsändare, klipp eller film och format, och skriver en brief. Här väljer du också filmens **stämning** (saklig, varm, inspirerande, lekfull, allvarlig eller med egna ord), slutkortets rad, en kicker och vem som godkänner. Samma avsändare kan alltså göra både en saklig film och en rolig. Claude kan sedan börja direkt med research och manus. |
| **Filmsidan** | Leder dig genom fem steg, en sak i taget: **Manus**, **Röst**, **Bilder**, **Titta igenom** och **Leverera**. Stegraden överst visar vad som är klart. Kortet under visar nästa steg med en enda huvudknapp, vad det kostar och hur lång tid det tar. Du kan gå tillbaka till ett tidigare steg; ändrar du manuset eller filmen efter ett godkännande behöver du godkänna igen. |
| **Vill du ändra något?** | Skriv med egna ord, eller tryck på ett förslag, så ändrar Claude. Samtalet fortsätter där det slutade. |
| **Kostnader** | Röst och bilder kostar pengar. Kortet visar kostnaden och vad som finns kvar hos ElevenLabs och OpenRouter, och inget körs förrän du har godkänt i en ruta. Godkännandet skrivs in i `notes/log.md`. |
| **Titta igenom** | **Gör en snabbversion** renderar hela filmen i halv upplösning på en till två minuter, och den spelas direkt på sidan. |
| **Leverera** | Gör de färdiga filmerna i alla format. **Färdiga filer** visar bara filmerna och undertexterna, och **Visa i Finder** markerar just den filen. |
| **Musik** | Under **Avsändare → Musik** lägger du in avsändarens bakgrundsslingor (WAV eller MP3), ger dem namn och väljer vad nya filmer får: en slinga eller ingen musik. Varje film kan välja en annan slinga eller ingen, i guiden för ny film och i steget **Titta igenom**. |
| **Musik från Suno** | I steget **Titta igenom** skriver Claude en prompt till Suno utifrån manus, brief och avsändarens tonalitet: Styles, Exclude styles, titel och längd, med en kopieringsknapp per fält och ett valfritt önskemål. Du gör låten i Suno, laddar ner den och lägger in den med **Ladda upp eget ljud**. Suno har inget öppet API, så själva låten görs i Suno. |
| **Avsändarens profil i en film** | En film får en kopia av avsändarens profil när den skapas. Ändrar du profilen efteråt visar filmsidan en notis, och **Visa ändringarna** listar vad som skiljer (färger, typsnitt, logga, form, bildstil, tonalitet) innan du uppdaterar. Filmens format, språk, musikval och berättarröst behålls, så inget behöver läsas in igen. Knappen finns också under **Tekniska detaljer**. |
| **Egna typsnitt** | Ladda upp typsnittsfiler (woff2, woff, ttf eller otf) under **Avsändare → Logga och typsnitt**, välj **Källa: Egna typsnittsfiler**, skriv typsnittets namn och spara. Filerna kopplas till rubriker och text med en vikt gissad ur filnamnet (Regular 400, Medium 500, SemiBold 600, Bold 700 och så vidare), och sidan visar vilken fil som hör till vilken roll. |
| **Radera** | **Radera filmen** på filmsidan och **Radera avsändaren** på avsändarsidan flyttar till Infofilms papperskorg (`~/.infofilm/papperskorg`). Under **Inställningar → Papperskorgen** återställer du, raderar en post för gott eller tömmer allt. Inbyggda avsändare kan inte raderas. |
| **Berättarläge** | Claude kan bygga en scen utan kort: bilden fyller hela rutan, en kamera rör sig mellan stopp som landar på orden, ljus faller in och damm svävar i ljuset, och fakta ritas ovanpå som plattor, ringar runt saker i bilden, flygande ikoner och stämplar. Filmens stämning styr hur mycket det rör sig, och kort med diagram finns kvar där siffror och jämförelser bär budskapet. Gäller filmer som skapas från och med nu. |
| **Levande kort** | Ruta i steget **Titta igenom**, påslagen för nya filmer (utom journalfilmsstilen): bilden i korten fyller hela rutan bakom kortets band och glider långsamt, med ljus och damm som i berättarscenerna. Plattorna och fakta ligger kvar där de är. |
| **Textning i bild** | Ruta i steget **Titta igenom**: det berättaren säger syns i filmen, i kortens textband och längst ned i berättarscenerna, för den som tittar utan ljud. Undertextfilen följer med ändå. |
| **Utgå från ett dokument** | I guiden för ny film, eller under **Dokumentet** i steget **Manus**, laddar du upp en presentation, en PDF eller ett Word-dokument. Appen gör en bild och text av varje sida (talaranteckningarna följer med) med LibreOffice, och Claude föreslår budskap och scener med sidhänvisningar. Vill du ändra förslaget skriver du det i rutan. När det stämmer skriver Claude manuset med dokumentet som huvudkälla: fakta som inte står i dokumentet räknas upp, och dokumentets siffror kontrolleras mot källor där det går. Filerna ligger i filmens mapp `dokument/`, men innehållet skickas till Claude. Bilderna i dokumentet visas under **Dokumentet**: kryssa i dem som avsändaren äger rätten till, så kan du i steget **Bilder** välja en av dem för en scen i stället för en ny bild från Gemini (gratis). Varje scen visar de sidor den bygger på, i **Manus** och **Titta igenom**, och fakta som inte står i dokumentet visas innan du godkänner manuset. |
| **Röstväljare** | I steget **Röst** väljer du berättare direkt i appen: **Dina röster** (allt på ditt ElevenLabs-konto) eller **Svenska röster i biblioteket**, med förhandslyssning och filter för kön, ålder och användning, och sökning på engelska ord. Att lyssna och välja kostar inget. En röst ur biblioteket läggs till på ditt konto när du väljer den. Byter du röst när scener redan är inlästa får du veta hur mycket som läses in igen. Egna röstprov utifrån en beskrivning finns kvar. |
| **Fel** | Ett steg som inte gick förklaras med en mening om vad som hände och vad du gör. **Låt Claude titta på felet** skickar loggen till Claude. Loggar, stillbilder, Remotion Studio och projektmappen ligger under **Tekniska detaljer**. |
| **Avsändare** | Ramen som alla filmer från avsändaren delar, i fyra delar: **Underlag** (material, webbplats, designsystem), **Utseende** (logga, typsnitt, färger, form, bildstil), **Tonalitet** (hur avsändaren låter och vad som aldrig får förekomma) och en valfri **Verktygslåda** med berättarröst och musikslingor. **✦ Bygg profilen från materialet** låter Claude fylla i ramen och ställa frågor om identiteten, aldrig om en enskild film. **Rendera testbilder** visar resultatet i 16:9 och 1:1. Profilerna sparas i `~/Kundprofiler`, utanför repot. Inbyggda avsändare, som `critero`, kopieras dit när du ändrar dem. |
| **Röst** | Under steget Röst på filmsidan skriver du röstbeskrivning och provtext, eller klistrar in ett färdigt Voice ID från ElevenLabs. **Spara som standardröst** lägger rösten i kundprofilen, så att kundens kommande filmer får samma berättare. |
| **Inställningar** | Visar vad som saknas på datorn, och här anger du mappar och API-nycklar. Nycklarna sparas krypterade i macOS-nyckelringen (tjänsten "infofilm") och testas mot tjänsten innan de sparas. Utanför macOS hamnar de i `~/.infofilm/secrets.json`. |

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
