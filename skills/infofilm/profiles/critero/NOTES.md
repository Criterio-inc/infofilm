# Critero Consulting AB – profilanteckningar

> Standardprofilen. Pärs eget bolag, Critero Consulting AB (org.nr 559533-0688). Färger, typsnitt och logga är hämtade från www.criteroconsulting.se den 19 oktober 2026, och husets designsystem är synkat samma dag. Pär har svarat på frågorna (se Beslut).

Läs den här filen innan du skriver manus eller bildprompter åt kunden.

## Kontakt och uppdrag
- Beställare: Pär Levander
- Godkänner manus: Pär Levander
- Godkänner färdig film: Pär Levander

## Designsystem
- Länkar: `designSystems` i profile.json. Läs varje länk innan du skriver manus, bildprompter eller scener (se skillens profiles/README.md, "Design systems"). Ögonblicksbilderna ligger i `design-systems/`.
- **Critero Design System** (husets system), `~/Projects/critero-design-system`, gren `main`, synkat 2026-10-19. Ögonblicksbild: `design-systems/critero-design-system.md`. Samma repo finns publikt på github.com/Criterio-inc/critero-design-system.
- **Sajten går före designsystemet** för Critero (Pärs beslut 2026-10-19: han gillar sajtens stil). Designsystemet fyller det sajten inte avgör.

| Designsystemet | Värde | I profilen |
|---|---|---|
| `--cr-font`, `--cr-font-mono` | Space Grotesk, JetBrains Mono | samma som sajten: `display`, `ui`, `mono` |
| `--cr-text` | #1a1a12 | samma som sajten: `ink` |
| `--cr-bg` | #f0ead8 | samma som sajtens `--surface`: `backdrop` |
| `--cr-primary` | #3d6e50 | `accentDark` (sajtens `--skala-4`). Sajtens blågröna #174F49 är `primary`. |
| `--cr-success` | #4a7a35 | `positive` (ny, 4,5:1 mot benvitt). Sajten har ingen ja-färg. |
| `--cr-warning`, `--cr-danger`, `--cr-info` | #a07828, #8a3828, #3a6878 | ingen roll. Får användas i diagram (data.ts) när en serie behöver en egen färg. #a07828 klarar inte text på ljus botten (3,6:1). |
| `--cr-surface` | #faf6ed | inte använd. Sajtens benvita #F5F1E6 är ytan. |
| radie 4–12, skuggor | | inte använda. Sajtens raka hörn och hårfina linjer gäller. |
| Principer | 4 px-rutnät, accentfärg på högst 10 % av ytan, inga hårdkodade färger | gäller även filmerna: orange och grönt är accenter, inte ytor |


## Grafisk profil
- Källa: www.criteroconsulting.se, `assets/css/site.css` (CSS-variablerna i `:root`, ljust tema), `assets/fonts/` och `assets/img/logga/`.
- Sajten har också ett mörkt tema (`[data-theme="dark"]`). Profilen följer det ljusa.

### Färger per roll
| Roll | Hex | Från sajten |
|---|---|---|
| `band`, `primary` | #174F49 | `--blagron`, bakgrunden i sajtens `.band`-sektioner och på knappar |
| `bandText`, `surfaceLight`, `surface`, `backdropLight`, `dim` | #F5F1E6 | `--benvit` / `--bg` |
| `kicker` | #E4E8DF | `--band-text`, etiketter och brödtext på blågrönt |
| `backdrop` | #F0EAD8 | `--surface`, de sandfärgade sektionerna |
| `surfaceDark` | #E4DDC7 | `--skala-1` |
| `ink` | #1A1A12 | `--ink` |
| `faint` | #4D4B3E | `--muted` |
| `accent`, `signal` | #F49140 | `--orange`, loggans sicksack, punkter och linjer |
| `accentDark` | #3D6E50 | `--skala-4` (= designsystemets `--cr-primary`) |
| `positive` | #4A7A35 | designsystemets `--cr-success` |
| `highlight` | #86A893 | `--skala-3` |

Sajtens hela skala, ljus till mörk: #E4DDC7, #BCCBB6, #86A893, #3D6E50, #174F49. Använd den för stegade diagram.

Kontrast (WCAG): bandText på band 8,3:1, kicker på band 7,5:1, ink på surfaceLight 15,5:1, faint på surfaceLight 7,8:1. Orange på benvitt är bara 2,1:1: använd orange till former, linjer och punkter, aldrig till text på ljus botten.

### Typsnitt
- Rubriker och siffror (`display`): Space Grotesk 500, som sajtens h1 och h2.
- Text (`ui`): Space Grotesk 400, 500 och 700.
- Etiketter (`mono`): JetBrains Mono 400. Sajten sätter dem i versaler med spärrning 0,1–0,12 em.
- Sajten laddar egna variabla woff2-filer av samma familjer. Profilen hämtar dem från Google Fonts (`fetch_fonts.py`), som har samma typsnitt.

### Logotyp
- `logo.png` är den liggande ljusa varianten: orange sicksack med fyra punkter (#F49140) och ordmärket CRITERO i benvitt, för mörk botten. Den står på bandfärgen.
- Sajten visar den som `critero-liggande-ljus.webp` (691×112). Profilen använder samma bild som PNG i 1240×201 från sajtens källa (`criteroconsulting-webb/src/assets/img/logga/`). Ingen SVG finns.
- Rita aldrig om loggan. Varianterna klipps ur originalet (`verktyg/logga.mjs` i sajtens repo).

### Form
- Sajten har raka hörn (knappar 2 px) och inga skuggor, bara hårfina linjer i `--rule` (rgba(26,26,18,.16)). Kort och plattor har därför radie 2 och en hårfin kant i stället för skugga.

## Bildspråk
- Pär gillar sajtens stil och är öppen för kreativa lösningar som gör filmerna pedagogiska och intressanta.
- Illustrationer (style.json): lugna, varma, sajtens palett, mycket luft. Sajten har foton (trädet i fältet vid solnedgång, porträttet), så ljuset och värmen därifrån är förebilden.
- Infografik ritad i kod får låna sajtens motiv: tunna orange linjer med punkter (loggans sicksack, sajtens streckade väg), etiketter i JetBrains Mono med versaler och spärrning, sajtens grönskala för stegade värden, och en orange punkt som markerar det viktigaste.

## Röst
- En designad svensk berättare (design.json), i tredje person.
- Pär funderar på versioner med sin klonade röst och text i jagform. Skapa dem bara när han ber om det.

## Tonalitet (som på sajten)
- Tilltal: du. Pär skriver i jagform ("Jag har arbetat med kommunal utveckling i 30 år").
- Kort, konkret och utan konsultspråk. Rubriker som påståenden: "Strategin finns. Nu ska den bli vardag."
- Återkommande teman: offentlig sektor, strategi som blir vardag, förändringsledning, AI i praktiken, digital suveränitet ("Data stannar hos er", "noll kakor").
- Klarspråk.

## Regler
- Tjänster som får användas för röst, musik och bild: ElevenLabs, Suno och Gemini (via OpenRouter). Godkänt av Pär 2026-10-19. Varje betald körning kräver fortfarande ett ja enligt skillen.
- Tillgänglighet: undertexter (SRT) levereras alltid.
- Inga bilder av AI som robotar eller glödande kretskort.

## Beslut (Pär, 2026-10-19)
1. critero-publisher är ett eget verktyg och påverkar inte profilen.
2. Designsystemet är husets system i `~/Projects/critero-design-system`. Sajten går före där de skiljer sig.
3. Bildstil: sajtens stil, gärna kreativa och pedagogiska lösningar.
4. Röst: svensk berättare. Versioner med Pärs klonade röst i jagform kan komma senare.
5. Slutkort: "Välkommen att höra av dig!" och criteroconsulting.se. "Boka ett första samtal" är för säljigt.
6. Kicker: tom tills vidare.
7. ElevenLabs, Suno och Gemini är godkända.

## Frågor till Pär
- Inga öppna just nu.
