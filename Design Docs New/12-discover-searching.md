# 12 · Discover — Searching

Route `#discover/searching` · fits one view · the scan animation is the feature, keep it.

## Purpose
Hold attention for 5–20 seconds with one honest progress story: the reference being scanned, a determinate bar, four named stages, elapsed time, and a way out.

## Layout
Content column is **centred vertically**, 28px horizontal padding, 24px gaps.

1. **Scanning thumb**
   - 170 × 212, radius 16, `overflow:hidden`, 2px border `--primary` (dark `--accent`), background `--surface`.
   - The user's reference photo fills it (`object-fit:cover`, `object-position:50% 40%`).
   - **Scan line**: absolutely positioned, `left:0; right:0`, height 2px, colour `#E85A96` in both themes, `box-shadow: 0 0 12px 2px rgba(232,90,150,.7)`.
     Animation `scan`: `@keyframes { 0%{top:6%} 50%{top:88%} 100%{top:6%} }`, 2.4s ease-in-out infinite.
2. **Title block** (centred)
   - H1 `Finding matches` 800/26/30 `--ink`.
   - Sub `{item name} · {destination}` 400/14/20 `--ink-muted`, e.g. `White button-up shirt · India`.
3. **Progress**
   - Track: full width, 6px, radius 4, light `#E8D8C4` / dark `--surface-raised`.
   - Fill: `--primary` (dark `--accent`), width = completed stages ÷ 4, animated 300ms.
   - Row under it, space-between: left = current stage sentence 600/12 `--ink-muted` (`Comparing details`); right = elapsed seconds 700/12 `--primary` (dark `--link`), format `7s`.
4. **Stage grid** — 2 columns × 2 rows, 10px row gap / 14px column gap. Each cell: 8px dot + label.
   - Done: dot filled `--primary`/`--accent`, label 600/12 `--ink`.
   - Active: filled dot with `pulse` animation (opacity 1→.35→1, 1.4s), label **700**/12 `--ink`.
   - Pending: 1.5px outlined dot (`#C0A89A` light / `#7E5F68` dark), label 600/12 `--ink-muted`.
   - Labels, in order: `Candidates`, `Stores`, `Comparing`, `Best picks`.
5. **Dock** — secondary/outlined `Cancel`, 50px, full width.

## Deleted from the old screen
- The eyebrow `YOUR NEXT FIND IS TAKING SHAPE`.
- The serif display headline `Chasing your vibe.` and its italic word.
- The big serif seconds counter (`5s` / `7s` at display size) — one small timer only.
- `2 of 4 search routes completed` and `Elapsed time · Searching Indian storefronts` as separate lines; both collapse into the progress row and the stage grid.
- The circle-bulleted stage list.

## Behaviour
- Stages advance from real backend events; never fake-advance past the last real event, but hold the active dot pulsing.
- If nothing completes in 25s: keep the screen, swap the stage sentence to `Still looking…`. At 45s, route to `#discover/results-empty`.
- `Cancel` aborts requests and returns to `#discover/confirm` with values intact.
- `prefers-reduced-motion`: scan line parks at 50%, pulse disabled.

## Acceptance checklist
- [ ] Scan line sweeps the thumb continuously and is clipped by the thumb's radius.
- [ ] Exactly one seconds readout, 12px, in the progress row.
- [ ] Four stage labels in a 2×2 grid with the correct three dot states.
- [ ] No serif type, no italic, no eyebrow line.
- [ ] `Cancel` is in the dock and always reachable.
