# TT13 Uniform (wardrobe)

A capsule-wardrobe visualizer. Dress a character that looks like you, using real product images, and see how a piece fits the rest of the uniform.

Spec: `Projects/tt13-uniform/SPEC.md` in the TT13 vault.

## Palette

Home: Black. Away: Navy. Secondary: White, Light Blue, Beige. Neutral: Grey. No logos.

## M1 (this version)

- Stylized 2D avatar (5'8", 175 lb default; skin, hair, build, glasses are editable)
- Closet with 8 slots: headwear, top, outer, bottom, shoes, watch, belt, bag
- Add pieces by drop, paste, file picker / camera, or image URL; bulk add supported
- Automatic background removal (flood fill from the border; garment pixels are never recolored) and dominant-color sampling with the nearest TT13 palette color
- Per-piece fit controls (size, left/right, up/down) saved with the piece
- Layering (top under outer), saved outfits by occasion (Work, Weekend, Travel, Going out)
- Local-first: IndexedDB in the browser, JSON export/import for backup. Nothing is uploaded.

## Not yet (see spec milestones)

- M2: bookmarklet import from retailer pages
- M3: Uniform Spec editor, fit score, coverage matrix, "evaluate a candidate"
- M4: polish and deploy

## Run

```bash
npm install
npm run dev
npm run build
```

## Known limits

- Background removal works on plain backgrounds. White garments on a white background may need a lower tolerance, or turn removal off.
- Front view only. Side-view shoe photos are mirrored to make a pair unless marked "image shows a pair".
