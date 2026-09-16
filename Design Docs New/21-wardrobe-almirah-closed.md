# 21 · My Wardrobe — The closed almirah

Route `#wardrobe` (default once ≥ 5 pieces are confirmed) · fits one view.

> **This screen is a piece of furniture, not a list.** The previous build shipped a card grid; that is a failed implementation. The user must see a two-door wooden almirah standing in the screen, shut, with the pieces hidden inside, and must be able to open it.

## Layout, top to bottom

1. **Status pills row** — 8px gap:
   - `Level 3 · Curator` — `--primary` fill, white 700/12, radius 999, padding 5px 12px.
   - `5-day streak` — `--surface` fill, 1px `--border`, `--ink` 700/12, same shape.
2. **Title block** — H1 `Your wardrobe` 800/30/34 `--ink`; sub `34 pieces · 6 not worn in 60 days` 400/14/20 `--ink-muted` (both numbers dynamic; drop the second clause when it is 0).
3. **The almirah** — takes all remaining vertical space (`flex:1`), minimum 380px.
   - **Body**: radius 22, background `--wood-body`, 1px `--wood-edge` border, padding 14, `overflow:hidden`.
   - **Doors**: two equal panels filling the body's upper area, 6px apart.
     - Left door: background `--wood-door` at 120°, radius `14px 6px 6px 14px`, 1px `--wood-edge`.
     - Right door: same gradient mirrored to 200°, radius `6px 14px 14px 6px`.
     - Each door carries a **handle**: 7 × 56px vertical bar, radius 4, `--primary` fill, vertically centred, 10px from the door's inner edge (left door's handle on its right side, right door's on its left).
   - **Centre seam**: 4px column between the doors filled with a vertical glow `linear-gradient(180deg, rgba(142,27,77,.05), rgba(142,27,77,.35), rgba(142,27,77,.05))` — the light leaking out of the cupboard. In dark mode use `rgba(232,90,150,.05/.35/.05)`.
   - **Count plate**: pill centred horizontally, 28px from the top of the door area, `--ink` fill (dark: `--surface`), text `34 pieces inside` 700/12 in `--bg`/`--ink`, radius 999, padding 5px 12px.
   - **Open hint**: row centred at the bottom of the body, 8px gap: `Tap the doors to open` 700/14 `--ink` + a small chevron/`↕` glyph 700/14 `--primary`.
4. **Review banner (conditional)** — only when the import tray is non-empty: `--surface`, 1px `--border`, radius 16, padding 12px 14px, row: 38px circle `--primary-tint` with `+3` 800/14 `--primary`; text 500/13/18 `--ink` `3 new pieces from Instagram are waiting in the review tray.`; right `Review` 700/13 `--primary`.
5. **Dock** — 10px gap: 54 × 54 outlined square button `+` (accessible name `Add pieces`) + primary `Open wardrobe` filling the rest.

## The open interaction (required)
- Tapping either door, the count plate, or `Open wardrobe` plays `door-open` (design system §5):
  left door `rotateY(-78deg)`, right door `rotateY(78deg)`, `transform-origin` at each door's **outer** edge, `perspective(1200px)` on the body, 520ms `cubic-bezier(.22,.61,.36,1)`.
- The interior (screen 22) cross-fades in behind the doors over the final 240ms; the seam glow widens as the doors swing.
- Haptic: light impact on tap, medium when the doors reach open.
- Route changes to `#wardrobe/open` when the animation completes; back/`← Close` plays it in reverse.
- `prefers-reduced-motion`: doors do not rotate; interior cross-fades in 160ms.

## Empty state (0 pieces, user skipped adding)
Same furniture, doors shut, count plate reads `Empty for now`, hint row is hidden, dock is a single primary `Add your first piece →`.

## Acceptance checklist
- [ ] Two door panels with a visible central seam and two handles are rendered — not a grid, not a single flat card.
- [ ] Wood tones come from `--wood-*`; the body has no photo content on it.
- [ ] Count plate shows the live piece count.
- [ ] Tapping a door animates it open and routes to the interior.
- [ ] Level pill, streak pill, title, almirah, dock and tab bar all fit 844px with no scrolling.
