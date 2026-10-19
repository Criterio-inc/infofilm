# Critero Design System (husets system), ögonblicksbild

- Källa: `~/Projects/critero-design-system`, gren `main`, commit e54be96 (paketet 1.3.0, tokens märkta v1.2). Samma som https://github.com/Criterio-inc/critero-design-system (publikt).
- Läst: 2026-10-19, ur `critero-tokens.css`, `critero-components.css`, `CLAUDE.md` och `README.md`.
- Grenen `soft-sprout` (Soft Sprout) gäller bara Förändringskompassen och är inte med här.

## Färger, ljust tema
| Token | Värde | Syfte |
|---|---|---|
| `--cr-bg` | #f0ead8 | sidbakgrund (sand) |
| `--cr-bg-subtle` | #e8dfc8 | |
| `--cr-surface` | #faf6ed | kort |
| `--cr-surface-raised` | #f2ebe0 | |
| `--cr-text` | #1a1a12 | text (14,55:1 mot bg) |
| `--cr-text-muted` | #5a5848 | sekundär text (5,97:1) |
| `--cr-text-subtle` | #6e6a55 | hjälptext (4,53:1) |
| `--cr-primary` | #3d6e50 | skogsgrön, primärfärg |
| `--cr-primary-hover` | #2e5540 | |
| `--cr-success` | #4a7a35 | |
| `--cr-warning` | #a07828 | |
| `--cr-danger` | #8a3828 | |
| `--cr-info` | #3a6878 | |
| `--cr-border` | rgba(20,18,10,0.10) | kantlinje |
| `--cr-shadow-sm/md/lg` | 0 1px 3px / 0 4px 14px / 0 8px 28px, rgba(20,18,10,.08–.14) | |

Mörkt tema: bg #0a0a09, surface #161614, text #e4dfc8, primary #4a8a62.

## Typografi
- `--cr-font`: Space Grotesk (300–700). `--cr-font-mono`: JetBrains Mono (400, 500), för kod och nummer.
- Vikter: 400, 500, 600, 700. Radavstånd 1–1,65.

## Form
- 4 px-rutnät. Radier 4, 6, 8, 12 (kort), 16, 24 px. Kort: surface, 1 px border, radie 12.
- Täthet balanserad: kortpadding 20 px, sektionsavstånd 32–48 px.

## Regler
- Aldrig hårdkodade färger, alltid tokens. Alla texttoner klarar WCAG AA mot sina bakgrunder.
- Ikoner: lucide, tunna linjer.
- Dokument: ljus bakgrund, accentfärgen #3d6e50 på högst 10 % av ytan, tabellhuvud #1a1a12 med sandtext.
