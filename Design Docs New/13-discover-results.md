# 13 · Discover — Results

Route `#discover/results` · grid scrolls below 4 cards; header, note area and tab bar do not.

## Purpose
Show matches as a scannable grid. No explanation, no pipeline talk, one confidence label per card.

## Layout

1. **Sticky compact header** — `--surface`, 1px bottom border, padding 6px 20px 12px, row with 12px gap:
   - 40 × 48 thumbnail of the user's crop, radius 8.
   - Column: item name 700/15/20 `--ink`; meta `{n} matches · {destination}` 400/12/16 `--ink-muted`.
   - Right: `Refine` 700/13 `--primary` (dark `--link`).
   This replaces the old tall reference card + `Refine` block + the display headline + every disclaimer paragraph.
2. **Filter chips** — one row, 8px gap: `India {n}` (selected, `--primary` fill) and `Global {n}` (outlined). Selecting `Global` re-renders the grid; counts come from the backend.
3. **Match grid** — 2 equal columns, **10px gap**. Each card:
   - Media: **1:1**, radius 12, 1px `--border`, real product image (`--placeholder` until loaded).
   - Confidence badge, top-left, 8px inset: radius 999, padding 3px 8px, 700/10.
     `Close match` → `--primary` fill, white text. `Similar shape` and `Price unknown` → `--surface` fill, 1px `--border`, `--ink` text.
   - Name 700/13/17 `--ink`, clamped to 2 lines (long retailer SEO titles must be truncated, never wrapped in full).
   - Price line 400/12/16 `--ink-muted`: `{retailer} · ₹{price}` or `{retailer} · at retailer` when the price is missing.
   - Nothing else. No per-card prose, no second badge, no brand chips.
4. **Note** — one line above the tab bar, 1px top border, 12px padding-top, 400/12/17 `--ink-muted`: `Price, size and delivery are confirmed on the retailer's page.`
5. **No dock** — this is a browsing state.

## Confidence contract (UI shows exactly these three)

| Label | Condition |
|---|---|
| `Close match` | comparison passed on shape **and** colour |
| `Similar shape` | comparison passed on shape only |
| `Price unknown` | retailer supplied no price (overrides the others in the badge slot) |

If zero candidates in the selected destination reach `Close match` or `Similar shape`, render `15-discover-no-close-match.md` instead of degrading the copy on cards.

## Deleted from the old screen
`The same energy.` headline and sub, `▶ How we found these`, `Some pieces could not be compared…`, `Showing related visual leads…`, `Global matches are included when they are closer…`, `Global visual lead` / `Visual lead` / `Related visual lead` badges, and the `Local preview 01` header badge.

## Interactions
- Tap card → `#discover/match/{id}`.
- `Refine` → bottom sheet with category, colour, price ceiling, destination; applying re-runs the search from `#discover/searching`.
- Pull to refresh re-runs the same query.

## Acceptance checklist
- [ ] Header is one 48px-tall row, not a card.
- [ ] Cards are square-image, 2-up, 10px gaps; names clamp to 2 lines.
- [ ] Exactly one badge per card, drawn from the three allowed labels.
- [ ] Exactly one note line; no other explanatory text on screen.
- [ ] First 4 cards and the note are visible without scrolling at 390×844.
