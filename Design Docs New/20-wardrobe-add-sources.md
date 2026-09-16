# 20 · My Wardrobe — Fill your wardrobe

Route `#wardrobe/add` · shown as the Wardrobe tab's default while fewer than 5 pieces are confirmed · fits one view.

## Purpose
Get the first five pieces in with the least effort, and make the payoff explicit: the almirah unlocks.

## Layout

1. **Header row** — H1 `My Wardrobe` 800/26/30 `--ink`; right `Skip` 700/13 `--ink-muted`.
2. **Unlock card** — `--primary` fill, radius 18, padding 16, 12px gaps:
   - Row: `Level 1 · Collector` 800/15 white; right pill `{n} / 5 pieces` — white fill, `--primary` text, 700/11, radius 999, padding 3px 10px.
   - Progress track 10px, radius 6, `rgba(255,255,255,.28)`; fill white, width = n/5.
   - Line 500/13/18 white: `Add 3 more pieces and your wardrobe doors unlock.` (count is dynamic; at 5/5 it becomes `Your wardrobe is unlocked.` and the dock CTA switches to `Open wardrobe`).
3. **Section label** — `PICK A WAY IN` 700/12 uppercase, letter-spacing 0.06em, `--ink-muted`.
4. **Source rows** — 3 cards, 12px gap. Each: `--surface`, 1px `--border`, radius 18, padding 16, row with 14px gap:
   - 46 × 46 icon tile, radius 14, `--primary-tint` fill, simple geometric glyph in `--primary` (camera = 20×16 rounded rect + 8px circle; gallery = 20px rounded square with a 45° stripe fill; social = 20px rounded square outline).
   - Column: title 700/16/21 `--ink`; sub 400/13/18 `--ink-muted`.
   - Right: `→` 700/18 `--primary`.

   | # | Title | Sub |
   |---|---|---|
   | 1 | `Snap your clothes` | `Cleanest cutouts · +10 XP each` |
   | 2 | `Import from gallery` | `Up to 20 photos at once` |
   | 3 | `Connect Instagram or Facebook` | `We read your outfit photos and pre-fill ~20 pieces` |

   Row 3 is the recommended path: 2px `--primary` border instead of 1px, its icon tile is `--primary` fill with a white glyph, and it carries a small pill above the title — `FASTEST START`, `--primary-tint` fill, `--primary` 700/10 uppercase.
5. **Note** — one line 400/12/17 `--ink-muted`: `We only read the photos you pick. Nothing is ever posted from your account.`
6. **Dock** — primary `Open camera →` (or `Open wardrobe` once unlocked).

## Interactions
- Row 1 → native camera with a garment guide overlay; each capture returns to this screen with the counter incremented and an `xp-pop` on the pill.
- Row 2 → system photo picker, multi-select up to 20 → import review tray (`#wardrobe/review`).
- Row 3 → OAuth for Instagram/Facebook, read-only photo scope → import review tray with detected pieces pre-filled and a `+{n} pieces found` banner. Never post, never follow, never import without review.
- `Skip` → closed almirah with an empty state (doors shut, `Add your first piece` in the dock).

## Acceptance checklist
- [ ] Unlock card is the only `--primary`-filled block on screen.
- [ ] Three source rows, third visually promoted with the `FASTEST START` pill.
- [ ] Counter, progress bar and copy all agree with the real confirmed-piece count.
- [ ] One privacy note line; nothing else explanatory.
- [ ] Montserrat at 800 for the title, 700 for row titles.
