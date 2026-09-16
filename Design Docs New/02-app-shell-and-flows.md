# 02 · App shell and flows

## 1. Shell

Persistent: status/safe area, screen content, optional **action dock**, **tab bar** (4 tabs, see design system 4.2).
Only one primary action per screen and it always lives in the dock — never inline in the scroll area, never below the fold.

Scroll contract: each screen's default state must fit 390×844 without scrolling. Overflow is allowed only where a file says "scrolls" (Results grid beyond 4 cards, wardrobe interior beyond 3 sections).

## 2. Routes

```
#discover                      entry (upload / pick a reference)
#discover/crop                 10-discover-frame-piece
#discover/confirm              11-discover-confirm-search
#discover/searching            12-discover-searching
#discover/results              13-discover-results
#discover/results-empty        15-discover-no-close-match
#discover/match/{id}           14-discover-match-detail
#wardrobe                      21-wardrobe-almirah-closed  (or 20 if piece count < 5)
#wardrobe/add                  20-wardrobe-add-sources
#wardrobe/open                 22-wardrobe-almirah-open
#wardrobe/look/{id}            23-wardrobe-exploded-look
#wardrobe/review               import review tray (not specced yet)
```

## 3. Discover flow

```
upload photo
   ↓
#discover/crop        drag the crop frame, pick a target chip
   ↓  [Describe this piece with AI →]
#discover/confirm     AI fills name + attributes; user may edit, set destination + budget
   ↓  [Find shopping matches →]
#discover/searching   scan animation, 4 stages, cancellable
   ↓
   ├─ ≥1 candidate in destination → #discover/results
   └─ none in destination         → #discover/results-empty
   ↓  tap a card
#discover/match/{id}  one match; [Open at retailer →] leaves the app, [Save] adds to wardrobe as "not owned"
```

Rules:
- Two steps before search. Never three. Never one long form.
- `Describe this piece with AI` is only enabled once a crop exists.
- `Find shopping matches` is always enabled; destination defaults to the user's region, budget is optional.
- Cancelling a search returns to `#discover/confirm` with all values intact.
- Back from results returns to `#discover/confirm`, not to crop.

## 4. Wardrobe flow

```
first run (or < 5 pieces)
#wardrobe/add         camera · gallery · connect Instagram/Facebook, XP progress to 5
   ↓ pieces saved
#wardrobe             closed almirah, doors shut, piece count on the door
   ↓ tap doors / [Open wardrobe]   (door-open animation)
#wardrobe/open        interior: hanging rail → folded shelf → drawer
   ↓ tap any garment or look
#wardrobe/look/{id}   exploded view; [Style this look →] hands off to Style Me
```

Rules:
- Doors are the hero interaction: tapping either door, or the dock button, plays `door-open` and routes to `#wardrobe/open`.
- Closing (`← Close`) plays the reverse animation.
- Imported-but-unconfirmed pieces never appear inside the almirah; they wait in the review tray and are announced by the banner on the closed screen.

## 5. Gamification model (shared by wardrobe screens)

| Element | Rule |
|---|---|
| Level | `Level {n} · {title}`; titles: 1 Collector, 2 Stylist, 3 Curator, 4 Archivist, 5 Tastemaker. Thresholds 5 / 15 / 30 / 60 / 100 confirmed pieces. |
| XP | +10 per confirmed piece, +15 per logged wear, +5 per completed detail (brand, price). |
| Streak | consecutive days with a logged wear; shown as `{n}-day streak` chip. |
| Unlock | the almirah stays closed until 5 pieces are confirmed; screen 20 shows the progress bar to that unlock. |

XP and level appear only as short pills — never as tables, never with explanatory copy.
