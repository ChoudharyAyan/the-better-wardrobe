# 01 · Design system

## 1. Typeface — Montserrat only

```
Family:  Montserrat
Weights: 400 regular, 500 medium, 600 semibold, 700 bold, 800 extrabold
Source:  https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap
         (preferred: self-host woff2 for 400/500/600/700/800 and @font-face it)
Stack:   'Montserrat', 'Montserrat Fallback', sans-serif
```

Rules:
- One family for the entire app. No serif, no italics, no second display face.
- Never ship `system-ui`, `-apple-system`, Inter, Roboto, Arial or Helvetica as the visible font. They are the "bland font" problem — if you see one on screen, the webfont did not load and that is a bug.
- Set `-webkit-font-smoothing: antialiased`.
- Numerals in stats use `font-variant-numeric: tabular-nums`.

### Type scale

| Role | Weight / size / line-height | Extra |
|---|---|---|
| Screen title | 800 · 26–30 / 30–34 | sentence case |
| Card title | 700 · 18–21 / 23–26 | |
| Item name | 700 · 13–16 / 17–21 | clamp to 2 lines |
| Body | 400 · 14 / 20 | |
| Meta / note | 400 · 12 / 16–17 | |
| Micro label | 600–700 · 10–12 | uppercase, letter-spacing 0.05–0.06em |
| Button | 700 · 15–17 | |
| Chip | 600–700 · 10–13 | |
| Tab label | 600–700 · 10.5–11 | active is 700 |

Never render UI text below 12px except the 10px uppercase micro labels and 9–10px chips noted per screen.

## 2. Colour tokens

### Light (default)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#FBF5EC` | screen background |
| `--bg-canvas` | `#F3EAE0` | area behind sheets/modals |
| `--surface` | `#FFFFFF` | cards, inputs, bottom dock, tab bar, sticky headers |
| `--border` | `#E3D2BC` | all 1px hairlines |
| `--ink` | `#2B1620` | primary text, active tab |
| `--ink-muted` | `#5C4750` | secondary text, inactive tabs |
| `--primary` | `#8E1B4D` | primary button fill, active chip, links, progress fill, active tab underline |
| `--primary-tint` | `#F7E3EC` | badge / XP pill background |
| `--warn-bg` | `#FBF1DE` | caution strip background |
| `--warn-border` | `#EAD9B4` | caution strip border |
| `--warn-ink` | `#96591B` | caution strip text |
| `--placeholder` | `repeating-linear-gradient(135deg,#FFFFFF 0 8px,#F0E4D2 8px 16px)` | image placeholders |

Wood tones for the almirah (light):

| Token | Value |
|---|---|
| `--wood-body` | `linear-gradient(180deg,#EADCC8 0%,#DCC7AC 100%)` |
| `--wood-door` | `linear-gradient(120deg,#F1E5D3 0%,#E2CFB4 100%)` (mirror the angle to 200deg on the right door) |
| `--wood-edge` | `#CBB392` |
| `--wood-rail` | `linear-gradient(180deg,#B49A75,#8F7551)` |
| `--wood-shadow-ink` | `#6B4F33` (labels inside the almirah) |
| `--drawer-face` | `#D2BC9E` with 1px `#B49A75` border |

### Dark

| Token | Value |
|---|---|
| `--bg` | `#241219` |
| `--surface` | `#2E1720` |
| `--surface-raised` | `#3A1F29` |
| `--border` | `#46262F` |
| `--ink` | `#F5E8EC` |
| `--ink-muted` | `#C9A6AF` |
| `--primary` | `#A5245F` |
| `--accent` | `#E85A96` (scan line, active dots, tab underline, selection frame) |
| `--link` | `#F08FB4` |
| `--primary-tint` | `#3B1B29` (text on it: `--link`) |
| `--warn-bg / --warn-border / --warn-ink` | `#2E2415` / `#5B451F` / `#E8B36B` |
| `--placeholder` | `repeating-linear-gradient(135deg,#3A2029 0 8px,#2C1620 8px 16px)` |
| `--wood-body` | `linear-gradient(180deg,#32191F 0%,#281319 100%)` |
| `--wood-edge` | `#4A2A34` |
| `--wood-rail` | `linear-gradient(180deg,#7E5F68,#553B44)` |
| `--drawer-face` | `#3A1F29` with 1px `#553B44` border |

Button labels are always `#FFFFFF` on `--primary`, in both themes.
Theme switch: `:root` = light, `[data-theme="dark"]` = dark. Follow `prefers-color-scheme` by default, with a manual override in Settings.

## 3. Geometry

- Reference viewport 390 × 844. Screen padding **20px** horizontal (16px only on the almirah interior, screen 22).
- Radii: 12 inputs/tiles · 14 buttons and chips-with-boxes · 16–20 cards and photo frames · 999 pills · 22 the almirah body.
- Vertical rhythm: 22px between top-level blocks, 14px inside a block, 10px between grid cards, 6px label→field.
- Hairlines are 1px `--border`. Cards do **not** use shadows; only lifted tiles in the exploded view do (`0 6px 14px rgba(43,22,32,.12)` light, `0 6px 16px rgba(0,0,0,.45)` dark).
- Tap targets ≥ 44px. Primary buttons 54px, secondary 50px, inputs 48px.

## 4. Shared components

### 4.1 Status bar (mock only)
44px, time left, signal glyphs right, `--ink`. In the real app this is the OS bar; keep safe-area insets.

### 4.2 Bottom tab bar
78px tall, `--surface`, 1px top border, 4 equal columns, 10px bottom padding for the home indicator.
Tabs in order: **Discover · My Wardrobe · Style Me · Insights**.
Each tab: 20px icon, label, and a 22×3px `--primary` (dark: `--accent`) underline shown only when active. Active label 700 `--ink`; inactive 600 `--ink-muted`.
**Remove the "Developer" tab from production builds** — it currently wraps onto a second row and breaks the shell.

### 4.3 Bottom action dock
Fixed row directly above the tab bar: `--surface`, 1px top border, padding 12px 20px 16px.
Holds the screen's single primary action (full width, 54px, `--primary`, white 700/17 label, radius 14). When a secondary action exists it sits left of the primary as an outlined button (`--surface` fill, 1px `--border`, `--ink` label, auto width, 54px). The dock never scrolls.

### 4.4 Buttons
- Primary: `--primary` fill, white label, radius 14, no border.
- Secondary/outline: `--surface` fill, 1px `--border`, `--ink` label.
- Text action (e.g. `Refine`, `Edit crop`): 700/13 in `--primary` (dark: `--link`), no box.

### 4.5 Chips
Pill, radius 999, padding 8px 14px (filter) / 3px 9px (badge on media).
Selected filter chip: `--primary` fill + white label. Unselected: `--surface` + 1px `--border` + `--ink`.
Badge chips sit 8px from the top-left corner of the media they annotate.

### 4.6 Input / select
48px, radius 12, `--surface`, 1px `--border`, 12px horizontal padding, value 600/14 `--ink`, placeholder 400/14 `--ink-muted`. Select shows a chevron at the right in `--ink-muted`. Label above, 600/12 `--ink-muted`, 6px gap.

### 4.7 Section label
600/12–13, `--ink-muted`; uppercase variant adds letter-spacing 0.06em and weight 700–800.

### 4.8 Disclosure row
Full-width row: label 600/14 `--ink` on the left, `+` (closed) / `−` (open) 700/14 `--ink-muted` on the right, 14px padding-top, 1px top border. Closed by default everywhere.

### 4.9 Media placeholder
`--placeholder` gradient fill, 1px `--border`, radius per context. No caption text inside. Real garment art replaces it: retailer images or background-removed cutouts, 1:1 for grids, 4:5 for hero images.

### 4.10 Note / disclaimer
One line, 400/12/17, `--ink-muted`, placed last in the content column, optionally with a 1px top border and 12px padding-top. **Maximum one per screen.**

### 4.11 Caution strip
Radius 12, padding 10px 14px, `--warn-bg` + 1px `--warn-border`, text 600/12/16 `--warn-ink`. Single line only (e.g. provider quota). Never stack two.

## 5. Motion

| Name | Spec |
|---|---|
| `scan` | 2px line, `#E85A96`, `box-shadow 0 0 12px 2px rgba(232,90,150,.7)`; keyframes `top: 6% → 88% → 6%`; 2.4s ease-in-out infinite. Used on the reference thumb while searching. |
| `pulse` | opacity 1 → .35 → 1, 1.4s ease-in-out infinite. Used on the active stage dot. |
| `door-open` | Almirah doors: left door `transform: perspective(1200px) rotateY(-78deg)`, right `rotateY(78deg)`, `transform-origin` outer edge, 520ms cubic-bezier(.22,.61,.36,1); interior cross-fades in over the last 240ms. |
| `explode` | Each piece animates from a stacked position to its offset: `translate(offsetX, offsetY)` + opacity 0→1, 60ms stagger per piece, 320ms cubic-bezier(.22,.61,.36,1). Reverse on collapse. |
| `xp-pop` | XP pill scales 1 → 1.12 → 1 over 260ms when points are awarded. |

`prefers-reduced-motion: reduce` → freeze `scan` at 50%, drop `pulse` and `xp-pop`, and make `door-open` / `explode` instant cross-fades (160ms opacity only).

## 6. Copy rules

- Sentence case. Short. One idea per line.
- **Banned strings:** "visual lead", "global visual lead", "related visual lead", "Vibe Match", "strict verification", "How we found these", "search routes completed", "Local preview", any sentence explaining the internal pipeline, and any stacked disclaimer paragraph.
- Never echo the raw AI description paragraph into the UI; store it and show a 2-line summary at most.
- Confidence is expressed with exactly three labels: `Close match`, `Similar shape`, `Price unknown` (see `13-discover-results.md`).

## 7. Accessibility

- Text contrast ≥ 4.5:1 (the token pairs above satisfy this; don't tint text with opacity).
- Every icon-only control needs an accessible name (`Add pieces`, `Cancel search`, `Open wardrobe`).
- Focus ring: 2px `--primary` (dark: `--accent`) offset 2px.
- The almirah doors, each garment, each exploded piece and each match card are buttons — keyboard and screen-reader reachable, not divs with tap handlers.
