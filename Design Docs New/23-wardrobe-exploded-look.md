# 23 · My Wardrobe — Exploded look

Route `#wardrobe/look/{id}` · fits one view.

## Purpose
Tapping a garment or a logged look breaks the outfit apart — the SolidWorks exploded-assembly idea — so the user sees every piece, whether they own it, and how hard it works for them.

## Layout

1. **Header row** — left `← Close` 600/15 `--ink`; right a 2-chip segmented control, 6px gap: `Exploded` (selected, `--primary` fill, white 700/11) and `Stacked` (outlined). Toggling switches the assembly between exploded and collapsed.
2. **Title block** — H1 `{look name}` 800/24/28 `--ink` (e.g. `Brown blazer look`); sub 400/13/18 `--ink-muted`: `4 pieces · all owned · logged 12 Mar` (composed from real facts; drop clauses that don't apply).
3. **Assembly panel** — fills remaining height, `--surface`, 1px `--border`, radius 20, padding 14, `position:relative`, `overflow:hidden`; the four piece rows are distributed with `justify-content: space-between`.
   - **Assembly axis**: a vertical dashed line at `left: 78px`, from `top: 24px` to `bottom: 24px`, 2px wide, `repeating-linear-gradient(180deg, --border 0 6px, transparent 6px 12px)`. Every piece hangs off this axis — it is what makes the view read as an exploded diagram.
   - **Piece rows**, top to bottom, each stepped further right to create the diagonal explosion: padding-left `0`, `22px`, `44px`, `66px`.
   - Each row: media tile on the left (width 84, height varies by garment type — jacket 66, shirt 66, belt 52, trousers 78), radius 10, `overflow:hidden`, cutout image cover, lifted with `0 6px 14px rgba(43,22,32,.12)` (dark `0 6px 16px rgba(0,0,0,.4)`).
     - The **focused** piece (the one the user tapped) gets a 2px `--primary` (dark `--accent`) border; the others 1px `--border`.
   - Text column, 12px gap from the tile: name 700/15/19 `--ink`; one fact line 400/12/16 `--ink-muted` — pick the most useful single fact:
     `Owned · worn 8× · ₹310 / wear`, `Owned · worn 21× · your most-used`, `Owned · pairs with 9 looks`, `Owned · worn 12× · hemmed`.
     A piece the user does not own reads `Not owned · from Discover` and its tile carries a small outlined `Wishlist` chip.
4. **Quick actions** — one horizontal row, 8px gap: `Swap the blazer` and `Find similar` (outlined chips, 600/12, 8px × 13px padding) and an XP pill `+15 XP` (`--primary-tint` fill, `--primary` 700/12).
5. **Dock** — outlined `Log wear` (auto width) + primary `Style this look →`.

## Motion
- On entry, pieces animate from a stacked column (all at padding-left 0, 60% opacity) to their stepped offsets: `explode` — 320ms `cubic-bezier(.22,.61,.36,1)`, 60ms stagger top to bottom, opacity 0→1.
- `Stacked` reverses it: pieces slide back onto the axis and overlap by 40% with a 1px `--border` visible between layers.
- Optional depth polish: on drag along the panel, pieces parallax horizontally ±6px by index.
- Reduced motion: no stagger, 160ms cross-fade only.

## Interactions
- Tap a piece → that piece's detail (wear history, cost per wear, care notes, retailer if wishlisted).
- `Swap the blazer` (label names the focused piece) → Style Me with that slot open.
- `Find similar` → Discover search seeded with this piece's attributes.
- `Log wear` → logs the whole look, +15 XP, `xp-pop`, toast `Logged · 6-day streak`.
- `Style this look →` → Style Me with this look loaded.

## Acceptance checklist
- [ ] Four pieces stepped diagonally off a visible dashed axis — not a flat list, not a grid.
- [ ] Focused piece is outlined in the accent colour; tiles carry lift shadows.
- [ ] Each piece has exactly one fact line.
- [ ] `Exploded` / `Stacked` toggle works and animates both ways.
- [ ] Dock holds `Log wear` + `Style this look →`; everything fits 844px.
