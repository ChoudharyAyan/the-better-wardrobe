# 14 · Discover — Match detail

Route `#discover/match/{id}` · fits one view.

## Purpose
One match, one decision: open it at the retailer or save it. Everything else is optional depth behind a disclosure.

## Layout

1. **Header row** — left `← Back` 600/15 `--ink`; right position counter `{i} of {n}` 700/13 `--primary` (dark `--link`).
2. **Hero image** — full width, **height 310**, radius 16, 1px `--border`, product image (cover). One confidence badge at 12px inset top-left: radius 999, padding 5px 11px, 700/11, `--primary` fill + white for `Close match`, outlined `--surface` for the other two labels.
3. **Title block**
   - Name 800/21/26 `--ink`, clamped to **2 lines** — the raw retailer title (`Perry Ellis Men's Slim Fit Total Stretch Pocket Shirt in Bright White, Size 2XL, 100% Polyester, Solid`) must be shortened to a human title (`Slim-fit stretch pocket shirt`); keep the full string only in the link target.
   - Meta 500/14/19 `--ink-muted`: `{brand} · ₹{price}` or `{brand} · price at retailer`.
4. **Fact tiles** — 3 equal columns, 10px gap. Each: `--surface`, 1px `--border`, radius 12, padding 10; micro label 600/10 uppercase `--ink-muted`; value 700/13 `--ink`.
   Default trio: `Colour`, `Fit`, `Sleeve`. Substitute from available attributes (`Fabric`, `Pattern`, `Length`) — never render more than three, never render a tile with an unknown value.
5. **Disclosure** — `Why this match`, closed by default (design system 4.8). Open state reveals up to three bullet lines, 400/13/18 `--ink-muted`, each a plain comparison sentence: `Same collar type`, `Colour within one shade`, `Fabric not verified`. No scores, no percentages, no pipeline vocabulary.
6. **Dock** — outlined `Save` (auto width) + primary `Open at retailer →` (fills the rest).

## Interactions
- `Open at retailer →` opens the retailer URL in an in-app browser; log the tap.
- `Save` adds the item to My Wardrobe as **not owned · from Discover**, shows a 2s toast `Saved to your wardrobe`, and the button becomes `Saved` (outlined, disabled).
- Horizontal swipe moves to the previous/next match and updates `{i} of {n}`.

## Deleted from the old screen
The three-way `Visual lead` / `Global visual lead` / `Related visual lead` labelling, the giant pink `Visual lead` headline, the duplicated `Related visual lead` text block, the letterboxed white image frame (image now fills the 310px hero), and `Price not supplied` as body copy (it becomes `price at retailer` in the meta line, or the `Price unknown` badge).

## Acceptance checklist
- [ ] Human-readable 2-line title; no SEO string on screen.
- [ ] One badge, one meta line, max three fact tiles.
- [ ] `Why this match` closed on arrival.
- [ ] Two dock buttons, primary on the right, both 54px.
- [ ] Hero image fills its frame edge to edge with no white side bars.
