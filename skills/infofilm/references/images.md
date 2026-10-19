# Illustrations (Gemini 3 Pro Image via OpenRouter)

- Model `google/gemini-3-pro-image`, `image_config: {aspect_ratio, image_size: "2K"}`, about $0.14 per image. At 21:9 2K an image is 3168×1344.
- Key: `OPENROUTER_API_KEY`.
- `art/gen.py` builds every prompt from `art/style.json`, so each image gets the same style suffix and never-list.

## Order of work
1. **The mascot reference**, `kind: "ref"`, `ref: "none"`. A full-body portrait on plain paper. Iterate until the user approves the face, glasses, hair, outfit and props. Name it in `style.json` → `reference`.
2. **A model sheet**, `kind: "sheet"`: turnaround, expressions and the signature gesture. It catches drift before 27 scene images do.
3. **Scene images**, `film-Sxx`, `kind: "film"` (21:9). One per scene, written from the scene's `> visual:` line. Describe the action and the setting; leave out any text, numbers or signs.
4. **Props and environments** if scenes need them (`kind: "scene"` with `ref: "style"` borrows the ink style without the mascot).

## Why 21:9
The card's picture window is 1800×749, about 2.4:1. A 16:9 image loses its top and bottom, including the mascot's hat. Generate 21:9, and ask for "breathing room above and below". The `film` kind says so.

## Character consistency
- Every scene image carries the reference image (image-to-image) plus a `character` paragraph that names every feature to keep. Restate the outfit in that paragraph.
- When the outfit or the mascot changes, regenerate the reference first, then everything else.

## Inspect every image (no exceptions)
Start with `python3 tools/art_sheet.py` (all scene images on one sheet), then zoom into suspects at full size. Look for:
- **Text**: signs, labels, made-up words ("WHOOSH", "1957", "BALLOT"). The model writes text despite the prompt. Regenerate with an explicit "no letters on X".
- **Doubled props**: two hats (one on the head, one in the hand), two briefcases, extra limbs.
- **The never-list**: the model drifts toward cliché props for a mood word, such as bunkers for "dystopian".
- **Real people, logos, flags with emblems**, which the film must not carry.
- **Composition**: is the subject inside the middle 2.4:1 band, and is there room for an infographic plate on one side?

Regenerate the bad ones by id (`python3 art/gen.py film-S14 film-S27`) and keep the rejects under another name if the user might want to compare. Then run:
```
python3 tools/sync_art.py          # → video/public/img/film-Sxx.jpg (2400 px JPEG)
python3 tools/build_timeline.py    # scenes pick up s.img
```
After a regenerated image, re-measure anything a scene positions over the picture, such as a hat position or a `focus` point.

## Style proposals (phase 2)
To compare looks, keep the same infographic and change only the style. For example, a parliament hemicycle with a "175 = majority" bracket, rendered as N style variants (`kind: "scene"`, `ref: "none"`). The image model gets diagrams wrong (wrong counts, misplaced brackets), which proves the point: diagrams are drawn in code, and only the mood comes from the model.
