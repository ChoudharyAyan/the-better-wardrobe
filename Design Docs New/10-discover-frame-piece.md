# 10 · Discover step 1 — Frame the piece

Route `#discover/crop` · fits one view, no scrolling.

## Purpose
The user has just supplied a photo. They frame the single garment they want searched, and name its category. One action leaves this screen.

## Layout, top to bottom

1. **Header row** (padding 20px, 6px from status bar)
   - Left: `← Back`, 600/15 `--ink`.
   - Right: `STEP 1 OF 2`, 700/11, uppercase, letter-spacing 0.06em, `--ink-muted`.
2. **Title block** (22px below header)
   - H1 `What caught your eye?` — 800/30/34 `--ink`.
   - Sub `One piece at a time. Drag the frame around it.` — 400/14/20 `--ink-muted`, 6px gap.
3. **Crop card** (22px below title)
   - Card: `--surface`, 1px `--border`, radius 20, padding 10.
   - Photo area: full width of the card, **height 280**, radius 14, `overflow:hidden`, object-fit cover.
   - Crop frame: 3px solid `--primary` (dark `--accent`), radius 12, default geometry `left 8% · top 10% · width 78% · height 64%`.
   - Four round handles at the frame's corners: 10px circle, `--surface` fill, 2px `--primary` border, centred on the corner.
   - Badge `Selected area` above the frame's top-left corner: `--primary` fill, white 700/11, radius 6, padding 3px 9px.
   - Helper row under the photo, 10px gap, space-between: left `Drag corners to adjust` 400/12 `--ink-muted`; right `Use full image` 700/12 `--primary`.
4. **Target chips** (22px below the card)
   - Label `I'm looking for`, 600/13 `--ink-muted`.
   - One horizontal scroll row, 8px gaps, chips 9px × 16px padding, 600/13: `Suit` (selected by default from the AI's guess), `Shirt`, `Jacket`, `Trousers`, `Accessory`, `Shoes`. Selected = `--primary` fill + white.
5. **Dock**: primary `Describe this piece with AI →`.

## Replaces
The four sliders (`Left edge`, `Top edge`, `Width`, `Height` with % readouts) and the `▼ Adjust your crop` accordion are **deleted**. Cropping is direct manipulation only. Also deleted: the free-text `I'm looking for` field and its helper paragraph — the chips carry it; free text lives in the Refine sheet on later screens.

## Interactions
- Drag inside the frame → move. Drag a handle → resize (min 15% of either axis). Pinch → zoom the photo under the frame.
- `Use full image` → frame animates to 0/0/100/100 in 200ms.
- Tapping a chip selects exactly one (single-select).
- `Describe this piece with AI →` → POST crop + chosen category, route to `#discover/confirm` with a skeleton AI card.
- Disabled state for the CTA only while the crop is being encoded.

## Data
`{ photoId, crop: {x,y,w,h in 0..1}, category }`

## Acceptance checklist
- [ ] Montserrat renders (800 title); no serif, no system sans.
- [ ] No sliders and no percentage readouts anywhere.
- [ ] Crop frame and its four handles are visible over the photo at defaults.
- [ ] Content ends above the dock — nothing clipped, no scrollbar.
- [ ] CTA sits in the fixed dock above the 4-tab bar.
