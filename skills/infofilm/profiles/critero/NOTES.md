# Critero Consulting AB – profilanteckningar

> Standardprofilen. Pärs eget bolag, Critero Consulting AB (org.nr 559533-0688). Färger, typsnitt och logga är hämtade från www.criteroconsulting.se den 19 oktober 2026. Bildstilen och rösten är förslag som väntar på Pärs godkännande.

Läs den här filen innan du skriver manus eller bildprompter åt kunden.

## Kontakt och uppdrag
- Beställare: Pär Levander
- Godkänner manus: Pär Levander
- Godkänner färdig film: Pär Levander

## Designsystem
- Länkar: `designSystems` i profile.json. Läs varje länk innan du skriver manus, bildprompter eller scener (se skillens profiles/README.md, "Design systems"). Ögonblicksbilderna ligger i `design-systems/`.
- Synkat: inget designsystem är länkat ännu.

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
| `accentDark`, `positive` | #3D6E50 | `--skala-4` |
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

## Tonalitet (som på sajten)
- Tilltal: du. Pär skriver i jagform ("Jag har arbetat med kommunal utveckling i 30 år").
- Kort, konkret och utan konsultspråk. Rubriker som påståenden: "Strategin finns. Nu ska den bli vardag."
- Återkommande teman: offentlig sektor, strategi som blir vardag, förändringsledning, AI i praktiken, digital suveränitet ("Data stannar hos er", "noll kakor").
- Klarspråk.

## Regler
- Tjänster som får användas för röst, musik och bild: ElevenLabs, Suno och Gemini (via OpenRouter) är skillens standard. Bekräftat av Pär? (se frågor)
- Tillgänglighet: undertexter (SRT) levereras alltid.
- Inga bilder av AI som robotar eller glödande kretskort.

## Jämförelse: critero-publisher
critero-publisher (dokument.critero.se) använder brand #1e3a5f (marinblå), accent #d97706 (bärnsten) och bakgrund #fafaf7. Det är en annan palett än sajten. Profilen följer sajten.

## Frågor till Pär
1. Sajten och critero-publisher har olika färger (blågrönt #174F49 och orange #F49140 mot marinblått #1e3a5f och bärnsten #d97706). Ska filmerna följa sajten, som nu, eller publisher?
2. Länken till ditt designsystem i Claude Design, så att det kan synkas in här.
3. Bildstilen i style.json är ett förslag. Sajten använder foton (trädet i fältet, porträttet) och tunna orange linjediagram, inte illustrationer. Vill du ha illustrationer i den här stilen, eller något närmare fotona?
4. Berättarrösten: din egen röst (klonad i ElevenLabs) eller en designad svensk berättare? Filmerna talar i så fall i jagform som sajten, eller i tredje person?
5. Slutkortet säger "Boka ett första samtal" och criteroconsulting.se, som sajtens knapp. Stämmer det, eller vill du ha en annan rad?
6. Ska etiketten i titelbandet (`kicker`) visa något, till exempel "Critero" eller ett ämne? Nu är den tom eftersom loggan redan står där.
7. Godkänner du ElevenLabs, Suno och Gemini för Criteros egna filmer?
