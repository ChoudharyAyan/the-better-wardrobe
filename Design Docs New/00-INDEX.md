# The Better Wardrobe — implementation handoff (index)

These markdown files are the **authoritative spec**. Build from them, not from the HTML mockups.
Mockup for visual reference only: `Better Wardrobe - Discover Flow Redesign.dc.html`.

## Files

| File | Contents |
|---|---|
| `01-design-system.md` | Fonts, colour tokens (light + dark), spacing, radii, every shared component, animations, accessibility. **Read first.** |
| `02-app-shell-and-flows.md` | Tab bar, routes, the Discover state machine, the Wardrobe state machine, what each CTA does. |
| `10-discover-frame-piece.md` | Discover step 1 — crop the uploaded photo. |
| `11-discover-confirm-search.md` | Discover step 2 — AI description + destination + budget. |
| `12-discover-searching.md` | Search-in-progress screen (scan animation). |
| `13-discover-results.md` | Match grid. |
| `14-discover-match-detail.md` | Single match. |
| `15-discover-no-close-match.md` | Honest empty state. |
| `20-wardrobe-add-sources.md` | Fill your wardrobe — camera / gallery / Instagram-Facebook. |
| `21-wardrobe-almirah-closed.md` | The closed almirah (two-door cupboard) you tap to open. |
| `22-wardrobe-almirah-open.md` | Almirah interior — hanging rail, folded shelf, drawer. |
| `23-wardrobe-exploded-look.md` | Exploded view of a tapped look (SolidWorks-style). |

## Three non-negotiables (these were missed in the last build)

1. **Typeface is Montserrat.** Every weight comes from Montserrat (400/500/600/700/800). Do not fall back to `system-ui`, Inter, Roboto, Helvetica or any serif. Load the webfont before first paint and set `font-display: swap`. If the font fails to load, the screen still must not render in a default UI sans — bundle the woff2 locally rather than relying on a CDN.
2. **No serif display type and no italic accent words anywhere.** Titles are Montserrat 800.
3. **The wardrobe is a physical almirah**, not a photo grid. Screens 21 and 22 describe real doors, a wooden rail with hanger hooks, a folded shelf with a visible shelf edge, and a pull-out drawer. A responsive card grid is a failed implementation of these screens.

## Build order

1. `01-design-system.md` → tokens + shared components.
2. `02-app-shell-and-flows.md` → shell, routes, tab bar.
3. Discover screens 10 → 15.
4. Wardrobe screens 20 → 23.

## Definition of done per screen

Each screen file ends with an **Acceptance checklist**. A screen is done when every line passes on a 390×844 viewport in both themes, with no vertical scrolling in the screen's default state unless the file explicitly allows it.
