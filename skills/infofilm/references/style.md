# Look and cast

## The house style
- **Format:** instructional cards on a dark navy table. A card has a title band (Bowlby One SC caps with a small kicker on the right), a picture window and a caption band (Jost).
- **Movement:** the card deals in on a spring and flies out to the left. The camera inside the window drifts slowly.
- **Palette:** cream paper, navy, golden yellow, ochre, ink, and a signal red used sparingly. Change it in `video/src/theme.ts` and in `art/style.json` together.
- **Line:** thick confident ink, halftone dot shading, aged paper. Film grain, gate weave, dust specks and a vignette sit over everything (`primitives/Film.tsx`).
- **World:** 1950s retro-futurism, the future as imagined in 1957: googie architecture, chrome, boomerangs and starbursts, rockets, monorails, flying cars, friendly robots and kitchen appliances of tomorrow.
- **Tone:** American 1950s commercial enthusiasm about serious things. The irony is that the gleaming democracy machine, or whatever the subject is, jams, overheats, and needs four tries. **Never apocalypse:** no bunkers, gas masks, mushroom clouds, radiation, ruins or sirens. Those are the never-list in `art/style.json`, and they apply to lyrics and code as well.
- **Fonts:** Bowlby One SC (titles, stamps, big numbers), Jost (labels, captions) and Lobster (commercial breaks only). All three are on Google Fonts, loaded through `@remotion/google-fonts`.

## When the user wants a different look
- Render the **same** small infographic in 3–7 styles: an ink card, a Saul Bass cut-paper look, mid-century Swiss, atomic-age magazine, Isotype pictograms, a CRT test card…
- The user picks one; then change `theme.ts` (palette, card geometry), `fonts.ts` and `art/style.json`, and rebuild the golden scenes.
- **Confirm your reading of mood words.** "Dystopian like Fallout" meant the *retro-futurist optimism* to one user, not the bunkers. Building on the wrong reading cost a round of images and lyrics. Show proposals before you commit.

## The mascot
- **Silent.** He acts out the narration in pantomime and never speaks, so the narrator stays the only voice.
- **An everyman of the era**, for example a commuter in a grey suit, skinny navy tie, grey hat and brown briefcase, with round glasses and a neat parting.
- **One signature gesture** that recurs at key moments and closes the film. The house mascot lifts his hat. Avoid famous mascots' gestures (a wink plus thumbs-up is Vault Boy's) and their silhouettes.
- **A supporting cast** is fine (a robot butler, a crowd of round anonymous blobs for voters), as long as no character resembles a real person.

To offer choices, make a sheet with four outfits or four gestures side by side (`kind: "sheet"`), and let the user pick.

## Accessibility
- Captions are on screen for the key point, and an SRT with the full narration is delivered beside the film.
- Use contrast: ink on cream, and cream on navy. Don't encode meaning in colour alone; use ▲ and ▼ for up and down.
