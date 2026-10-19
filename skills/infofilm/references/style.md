# Look and cast

## The look lives in the profile
A film's look is its client profile (`profiles/<id>/`, copied to the project's `brand/`). The profile holds:
- the palette by role, the fonts, the card shape and the motion (`profile.json`)
- the logo
- the illustration style and its never-list (`style.json`)
- the narrator (`design.json` / `voice.json`).

`theme.ts` and `fonts.ts` read the profile, so scenes never change when the client does. Field by field, it is described in [../profiles/README.md](../profiles/README.md).

### Making a client's profile from their brand guidelines
- **Never guess a client's colours, fonts or logo.** Ask for the brand manual and the logo files.
- Map the brand colours onto the roles:
  - the main colour → `primary`, and usually `band`
  - the secondary colours → `accent`, `accentDark` and `highlight`
  - a light neutral → the `surface*` roles, and a dark neutral → `ink`
  - a warning or emphasis colour → `signal`.
- Check contrast: `bandText` on `band` and `ink` on `surfaceLight` must be at least 4.5:1.
- **Fonts:** if the brand font is on Google Fonts, set `"google": true`. If it is licensed, put the woff2 files in `fonts/`, and check that the licence covers video. If it can't be used, pick the closest free font and write the substitution in `NOTES.md`.
- **Illustrations:** describe the client's visual world in `style.json` `ink`. That covers the kind of illustration (flat vector, line art, photo-like, isometric), the palette in words and the settings. Make 2–3 test images and get them approved.
- Public-sector clients (municipalities, regions, authorities) usually need plain language (*klarspråk*), WCAG AA contrast, subtitles, and a calm, factual tone. Note this in `NOTES.md`.

## The newsreel profile (the original house style)
- **Format:** instructional cards on a dark navy table. A card has a title band (Bowlby One SC caps with a small kicker on the right), a picture window and a caption band (Jost).
- **Movement:** the card deals in on a spring and flies out to the left (`"motion": "deal"`). The camera inside the window drifts slowly.
- **Palette:** cream paper, navy, golden yellow, ochre, ink, and a signal red used sparingly.
- **Line:** thick confident ink, halftone dot shading, aged paper. Film grain, gate weave, dust specks and a vignette sit over everything (`"filmLook": true`).
- **World:** 1950s retro-futurism, the future as imagined in 1957: googie architecture, chrome, boomerangs and starbursts, rockets, monorails, flying cars, friendly robots and kitchen appliances of tomorrow.
- **Tone:** American 1950s commercial enthusiasm about serious things. The irony is that the gleaming democracy machine, or whatever the subject is, jams, overheats, and needs four tries. **Never apocalypse:** no bunkers, gas masks, mushroom clouds, radiation, ruins or sirens. Those are the never-list in `style.json`, and they apply to lyrics and code as well.
- **Fonts:** Bowlby One SC (titles, stamps, big numbers), Jost (labels, captions) and Lobster (commercial breaks only). All three are on Google Fonts, fetched into the profile by `tools/fetch_fonts.py`.

## When the user wants a different look
- Render the **same** small infographic in 3–7 styles: an ink card, a Saul Bass cut-paper look, mid-century Swiss, atomic-age magazine, Isotype pictograms, a CRT test card…
- The user picks one. Then write it into the profile (`profile.json` and `style.json`); save it as a new profile when it should outlive this film.
- **Confirm your reading of mood words.** "Dystopian like Fallout" meant the *retro-futurist optimism* to one user, not the bunkers. Building on the wrong reading cost a round of images and lyrics. Show proposals before you commit.

## A recurring character (optional; the newsreel's mascot)
Most client clips do without one. When a client wants a recurring figure, keep the rules below and store the approved reference in the profile's `img/`.

- **Silent.** He acts out the narration in pantomime and never speaks, so the narrator stays the only voice.
- **An everyman of the era**, for example a commuter in a grey suit, skinny navy tie, grey hat and brown briefcase, with round glasses and a neat parting.
- **One signature gesture** that recurs at key moments and closes the film. The house mascot lifts his hat. Avoid famous mascots' gestures (a wink plus thumbs-up is Vault Boy's) and their silhouettes.
- **A supporting cast** is fine (a robot butler, a crowd of round anonymous blobs for voters), as long as no character resembles a real person.

To offer choices, make a sheet with four outfits or four gestures side by side (`kind: "sheet"`), and let the user pick.

## Accessibility
- Captions are on screen for the key point, and an SRT with the full narration is delivered beside the film.
- Use contrast: ink on cream, and cream on navy. Don't encode meaning in colour alone; use ▲ and ▼ for up and down.
