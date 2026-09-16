# 22 · My Wardrobe — Inside the almirah

Route `#wardrobe/open` · interior scrolls vertically when there are more than three sections; header, dock and tab bar stay put.

> The interior must read as the **inside of a cupboard**: a wooden carcass with a hanging rail at the top, a folded shelf below it with a visible shelf edge, and a drawer at the bottom. Garments hang from hooks; they do not float in a grid.

## Layout

1. **Header row** (padding 16px, 4px inner) — left `← Close` 600/15 `--ink`; right `+ Add pieces` 700/13 `--primary` (dark `--link`).
2. **Category chips** — one horizontal scroll row, 7px gap, 8px × 13px padding: `All 34` (selected, `--primary` fill, white 700/12), then `Shirts 9`, `Trousers 7`, `Belts 3`, `Jewellery 4`, `Shoes 5` (outlined, 600/12). Counts are live; hide a chip whose count is 0.
3. **The carcass** — fills remaining height, radius 20, background `--wood-body`, 1px `--wood-edge`, padding `14px 14px 16px`, 14px gaps between sections, `overflow:hidden` (inner scroll).

   ### 3.1 Hanging rail section
   - Section header row: `ON THE RAIL` 800/12 uppercase, letter-spacing 0.06em, `--wood-shadow-ink` (dark `--ink-muted`); right `{n} hanging` 600/11 same colour.
   - **Rail**: full-width bar, height 6px, radius 4, background `--wood-rail`. It sits above the garments and must be visible edge to edge.
   - **Hangers**: horizontal scroll row, 10px gap. Each garment is a column, width 96, centred:
     - **Hook**: 14 × 14, 2px `--wood-rail` border, `border-bottom: none`, radius `8px 8px 0 0`, `margin-top: -4px` so it visually hangs over the rail.
     - **Garment tile**: 96 × 118, radius 12, `overflow:hidden`, `--surface` fill, 1px `--wood-edge`; cutout image `object-fit:cover`.
     - Optional wear badge, top-left 6px inset: `Worn 12×` — `--primary` fill, white 700/9, radius 999, padding 2px 7px.
     - Name under the tile: 700/11/14 `--ink`, centred, 2-line clamp.
   - Hanging tiles tilt slightly on drag (`rotate(±2deg)`) and swing back — optional polish, skip under reduced motion.

   ### 3.2 Folded shelf section
   - Section header `FOLDED SHELF` (same treatment).
   - Row of folded items, 10px gap, horizontal scroll: tiles 78 × 62, radius 10, `--surface`, 1px `--wood-edge`, cutout image cover.
   - Last tile is the overflow affordance: `--placeholder` fill, 1px dashed `#A98A66` (dark `#6B4A55`), centred label `+ 5 more` 600/10/13 `--wood-shadow-ink`.
   - **Shelf edge**: the row has `padding-bottom: 10px` and a `border-bottom: 6px solid #B49A75` (dark `#553B44`) with radius `0 0 4px 4px` — this plank is what makes it read as a shelf. Do not omit it.

   ### 3.3 Drawer section
   - Section header `DRAWER · BELTS & JEWELLERY`.
   - Drawer face: `--drawer-face` fill, 1px border per token, radius 12, padding 10, row with 8px gap.
   - Inside: small tiles 52 × 44, radius 8, `--surface`, cutout images; plus an overflow tile `+5` (600/10, `--placeholder` fill).
   - Right-aligned hint inside the drawer, 600/11/15 `--ink` (light: `#3F2D1C`): `Tap any piece to explode it`.
   - Tapping the drawer face slides it out 8px and reveals a second row (optional; pure CSS translate, 200ms).

4. **Streak dock** — `--surface`, 1px top border, padding 12px 20px 16px, row:
   - Column: `Keep your 5-day streak` 700/14/18 `--ink`; `Log what you wore today · +15 XP` 400/12/16 `--ink-muted`.
   - Right: primary button `Log wear`, 46px tall, radius 13, padding 0 18px.

## Interactions
- Tap a garment → `#wardrobe/look/{id}` (exploded view, screen 23).
- Long-press a garment → quick actions sheet: `Log wear`, `Edit details`, `Move to…`, `Remove`.
- Category chip filters all three sections at once; empty sections collapse with their header.
- `Log wear` opens a compact sheet (which pieces, which occasion) and awards +15 XP with `xp-pop` on the streak chip.
- `← Close` plays the reverse door animation back to screen 21.

## Acceptance checklist
- [ ] A visible wooden rail with hanger hooks above the hanging garments.
- [ ] A visible 6px shelf plank under the folded row.
- [ ] A distinct drawer face holding the small accessories.
- [ ] Sections are horizontally scrollable; the carcass is one continuous wooden container.
- [ ] Every garment tile is a real button (keyboard + screen reader reachable).
- [ ] Streak dock present with `Log wear`; tab bar below it.
