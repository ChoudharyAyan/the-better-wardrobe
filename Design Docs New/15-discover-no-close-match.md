# 15 · Discover — No close match

Route `#discover/results-empty` · fits one view.

## Purpose
Say plainly that the destination has nothing close, offer the two fixes that actually help, and show the global alternatives that are closer.

## Layout

1. **Sticky compact header** — identical to Results (40 × 48 crop thumb, item name 700/15/20), meta reads `{destination} · no close match`, right action `Refine`.
2. **Title block** — H1 `Nothing close in India yet.` 800/26/30 `--ink` (destination is dynamic); sub one line 400/14/20 `--ink-muted`: `Two global options sit closer to your reference.` (pluralise from the count; if there are none, use `Nothing closer abroad either.` and hide section 3).
3. **Global option rows** — max 2, 10px gap. Each: `--surface`, 1px `--border`, radius 14, padding 12, row with 12px gap:
   - 56 × 68 product image, radius 10, 1px `--border`.
   - Column: name 700/14/19 `--ink` (2-line clamp); `{retailer} ({country}) · {price}` 400/12/16 `--ink-muted`.
   - Right: `Global` chip, outlined, 700/10, radius 999.
4. **Fix rows** — 2 rows, 10px gap, same card treatment, padding 14: label 700/14/19 `--ink` on the left, `→` 700/18 `--primary` on the right.
   - `Drop the colour filter`
   - `Try a tighter crop`
5. **Note** — one line 400/12/17 `--ink-muted`: `Import cost, delivery time and returns are shown by the retailer.`
6. **Dock** — primary `Show global options →`.

## Deleted from the old screen
The stacked paragraph disclaimers (`Some pieces could not be compared…`, `Showing related visual leads because no candidate completed strict Vibe Match verification.`, `Global matches are included when they are closer to your reference. Check import cost, delivery time and returns before buying.`) and the `Provider quota reached…` prose block. Quota problems, if any, use the one-line caution strip from the design system.

## Interactions
- `Drop the colour filter` → re-runs search without the colour constraint (back to `#discover/searching`).
- `Try a tighter crop` → `#discover/crop` with the existing frame preserved.
- `Show global options →` → Results with the `Global` filter chip selected.
- Row tap on a global option → `#discover/match/{id}`.

## Acceptance checklist
- [ ] Title names the destination; sub is one line.
- [ ] At most two global rows and exactly two fix rows.
- [ ] One note line; no disclaimer stack.
- [ ] Dock holds the single primary action.
