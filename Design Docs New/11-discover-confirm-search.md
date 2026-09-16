# 11 · Discover step 2 — Confirm and search

Route `#discover/confirm` · fits one view, no scrolling.

## Purpose
Show what the AI understood, let the user correct it in one tap if needed, choose where to shop, and search. This screen replaces the old mega-form (Specific piece, Colour, Pattern, Details that matter, the echoed AI paragraph, destination, budget, two disclaimers).

## Layout, top to bottom

1. **Header row** — left `← Back` 600/15 `--ink`; right `Edit crop` 700/13 `--primary` (dark `--link`).
2. **Title block** — H1 `Here's what we found.` 800/26/30; sub `Review it, then search for matches.` 400/14/20 `--ink-muted`.
3. **AI result card** — `--surface`, 1px `--border`, radius 18, padding 14, row with 14px gap:
   - 64 × 80 thumbnail of the crop, radius 10.
   - Column: badge `Described by AI` (`--primary-tint` fill, `--primary` 700/11, radius 999, padding 3px 9px) → name 700/18/23 `--ink` (e.g. `Pinstripe wool suit`) → one attribute line 400/13/18 `--ink-muted` built from at most two facts (`Charcoal · tailored fit`) → text action `Edit details` 700/13 `--primary`.
4. **Destination + budget** — one grid, two equal columns, 12px gap, each: label 600/12 `--ink-muted` + 48px field (design system 4.6).
   - Left: select `Shopping destination`, value `India · INR`.
   - Right: input `Max budget`, placeholder `Optional`, numeric keypad, destination currency prefix.
5. **Note** — single line, 400/12/17 `--ink-muted`: `Your crop is sent to configured shopping providers. A temporary link expires in five minutes.`
6. **Caution strip (conditional)** — only when a provider quota is exhausted: `Free provider quota resets in 2h — no paid fallback used.` Warn tokens, one line.
7. **Dock** — primary `Find shopping matches →`.

## Edit details sheet (opened by `Edit details`)
Bottom sheet, `--bg` background, radius 20 top corners, drag handle, padding 20.
Fields in order, all optional, 48px each with 6px labels: `Specific piece`, `Colour`, `Pattern`, `Fit`, `Details` (2-line textarea, 120px).
Sheet actions: `Cancel` (text) and `Save` (primary, full width in a sheet dock).
Closed state shows nothing about these fields on the main screen.

## Deleted from the old screen
- The five always-visible form fields.
- The verbatim AI paragraph ("The shirt is partially rolled up…").
- `Analysis sends your crop to Google Gemini…` and the second `Search sends your crop…` paragraph → replaced by the one note above.
- The `02 / MAKE IT YOURS` step eyebrow.

## Interactions
- Name and attribute line are editable via the sheet only (keeps the screen at one view).
- Changing the crop (`Edit crop`) returns to step 1 and, on return, re-runs description; the card shows a 2-line skeleton meanwhile.
- `Find shopping matches →` → `#discover/searching`.

## Data
`{ photoId, crop, category, description: {name, colour, pattern, fit, details}, destination, maxBudget? }`

## Acceptance checklist
- [ ] Exactly two input controls visible; everything else behind `Edit details`.
- [ ] Destination and budget are side by side, not stacked.
- [ ] One note line only; caution strip appears only when quota is exhausted.
- [ ] No AI paragraph text rendered on the screen.
- [ ] Screen fits 844px with the dock visible.
