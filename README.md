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

## M2: store import

- **Bookmarklet (works on the hosted site, no account or server):** drag "＋ TT13 Add" from the Add dialog to the bookmarks bar. On a product page it collects the name, brand, price and product images, copies the images inside the store page, and sends them to the app in a pop-up tab.
- Some stores' image hosts refuse the copy (Uniqlo does, Allbirds doesn't). The app then says so: right-click the product image, Save Image, drop it in.
- **Local only (`npm run dev`):** also paste a product link or image link into the Add dialog, or paste one anywhere in the app. A small helper in the dev server (`server/`) fetches the page for the app. It refuses private addresses and answers only requests to localhost.
- Manual palette override when auto color detection is fooled.

## Not yet (see spec milestones)

- M3: Uniform Spec editor, fit score, coverage matrix, "evaluate a candidate"
- M4: polish and deploy

## Run

```bash
npm install
npm run dev
npm run build
```

## Known limits

- Store photos worn by a model are not usable as-is: the person stays in the cutout and skews color detection. Pick a flat-lay or ghost-mannequin image from the candidate strip, or use the color override. Shoes, bags, watches and caps usually import cleanly.
- Pasting a link into the app needs the dev helper; the hosted site has no server, so use the bookmarklet there.

- Background removal works on plain backgrounds. White garments on a white background may need a lower tolerance, or turn removal off.
- Front view only. Side-view shoe photos are mirrored to make a pair unless marked "image shows a pair".
