# The Better Wardrobe — Design Philosophy

**Direction: an after-hours fashion atelier.**

Deep maroon surfaces, magenta accents, expressive serif headlines, and precise garment cutouts. The product should feel intimate, expressive, and fashion-led: find a reference, pull it apart, make it yours, and understand what it adds to your life.

Status: revised 14 September 2026 following user feedback on the first preview. The maroon/magenta direction, changed typography, and replacement of the W logo supersede the initial visual direction. Exact tokens and the new emblem below are proposed execution choices. Localhost implementation is paused; this revision changes the design brief only. This document translates the approved intent in [PRODUCT.md](PRODUCT.md) into design guidance. New interaction concepts below are proposals, not additions to the committed feature scope. Product behaviour takes precedence where scope remains unresolved.

## 1. What the experience should feel like

**Personal, expressive, tactile, and clear.** Garments, accessories, and their composition should carry the visual identity.

Our creative reference is an intimate fashion atelier after dark: wine-coloured depth, sculptural garment arrangements, elegant type, small annotations, and room to experiment. Contact sheets inspire look comparisons; garment labels inspire metadata; the exploded-view idea from My Wardrobe inspires how outfits separate into pieces. Use asymmetric editorial compositions around a stable, legible working surface.

**Imagery interpretation to confirm:** the user's phrase “I don't want people” is treated as excluding decorative stock models, faces, and people-led hero images. Use product cutouts, fabric details, accessories, and outfit arrangements instead. User-supplied reference images and optional personal try-on remain functional inputs under PRODUCT.md; this does not remove those capabilities.

Novelty should come from how the same garment moves through the journey. A blue shirt selected in a screenshot becomes a match, a saved reference, a confirmed wardrobe item, a styling component, and eventually an item with a history. Its image and identity remain recognisable throughout.

We cannot establish that no one has ever used a similar design. The goal is a distinctive, coherent combination that users can recognise as ours and operate without a tutorial.

### Audience hypotheses

- Design for self-expression, remixing, and personal control. Test whether these appeal to our intended Gen Z and younger audience; do not assume an entire generation shares one aesthetic.
- Pop-culture fluency should create moments of recognition. Slang, loud colour, and game mechanics alone do not establish relevance.
- Make room for tailoring, streetwear, Indian occasionwear, minimalist looks, and experimental accessories within one visual system.
- Avoid gender-coded interface skins. Users' clothes and chosen aesthetics provide the variation.
- Younger users should get creative play without spending-based status, appearance rankings, or pressure to post publicly.

## 2. Research: familiar patterns and our interpretation

Research is based on public first-party product pages and documentation consulted on 14 September 2026. This is not an authenticated mobile-app usability audit. Live browser visual inspection was blocked by a browser security check; exact current competitor fonts, colours, and animations were not verified. Our palette and typography below are original recommendations, not purported competitor specifications.

The user rejected the first preview as too similar to Whering. Competitor references below are retained for interaction research only. Their visual branding should not guide this revision. The new direction must change composition, typography, imagery, and the brand mark together, not just recolour the first draft.

| Reference | Observed or documented pattern | Familiarity to retain | Our proposed interpretation |
| --- | --- | --- | --- |
| Whering | Photo/store-based wardrobe input and the Dress Me outfit shuffle | Recognisable owned-item library and easy outfit experimentation | Preserve item identity across discovery, ownership, styling, and reflection; let people hold selected pieces while changing others. [How it works](https://whering.co.uk/how-it-works), [Styling and outfits](https://whering.co.uk/faq/styling-and-outfits) |
| Indyx | Digital wardrobe cataloguing, personal styling, and an outfit-selfie calendar | Personal collection and outfit history as useful context | Put a visual item history beside styling and shopping decisions. [Indyx](https://www.myindyx.com/) |
| Pinterest Collages | Editable cutouts, swapping, remixing, and optional sharing | Direct manipulation of individual pieces and easy creative starting points | Connect a cutout to ownership state and a real buying option, instead of ending with inspiration alone. [Collage remixing and sharing](https://newsroom.pinterest.com/en-ca/news/introducing-new-ways-to-create-and-share-collages/) |
| Combyne | Public outfit creations, expressive captions, and challenge-tagged posts | Playful outfit composition and optional creative prompts | Begin with private remix challenges; a community feed remains outside the current product scope. [Public outfit feed](https://app.combyne.com/) |
| Spotern | Public search listing describes finding products from films, television, and music videos; direct page retrieval reached a CAPTCHA | A cultural reference as an entry into shopping | Make similarity and India shopping context explicit. This is a limited positioning reference, not a verified UI finding. [Spotern](https://www.spotern.com/en) |

Pinterest reports adoption of collages among Gen Z, but that is a platform-reported signal, not validation of our own audience or proof about Gen Alpha. Our design hypotheses need direct user testing.

### Points of parity

Keep labelled bottom navigation, recognisable search and upload actions, category filters, conventional product details, editable item names, back navigation, and clear saving states. Users should not have to learn a new symbol for buying, ownership, or search.

### Points of distinction

1. **Continuous garment identity:** the same item stays visually and functionally connected across tabs.
2. **Visible path to a look:** the outfit shows what is owned and what is missing before suggesting a purchase.
3. **A wardrobe that separates and assembles:** use the exploded view for a purposeful reveal, then settle into practical browsing.
4. **Personal value stories:** Insights explains a piece through use, variety, enjoyment, or quality according to the user's chosen lens.

These are design bets, not claims of features absent from every competitor.

## 3. Visual system

### Colour: deep maroon, magenta, and blush

Use a deep wine canvas as the primary theme, layered plum panels for working areas, and rose-magenta for actions and selection. Pale blush type gives the interface warmth. Keep garment image wells neutral so the surrounding brand palette does not distort the perceived colour of clothing.

| Token | Proposed value | Use |
| --- | --- | --- |
| Wine | `#28101F` | Main background |
| Plum surface | `#38182B` | Panels and navigation |
| Raised plum | `#482339` | Sheets, active workspaces, and elevated controls |
| Blush white | `#FFF4F8` | Main text and icons on dark surfaces |
| Muted rose | `#D3B5C5` | Supporting text on dark surfaces |
| Plum line | `#694258` | Decorative separators |
| Control edge | `#AB8198` | Essential input boundaries on dark surfaces |
| Rose action | `#EF85B7` | Primary buttons and selected markers, with Wine text |
| Deep magenta | `#A52D68` | Editorial accents and non-text decorative depth |
| Image neutral | `#F4F3F1` | Garment image wells, with Wine text if labels sit inside |
| Success | `#A5DCBC` | Confirmed-success text or icon on dark surfaces |
| Warning | `#F0D098` | Attention or uncertainty text on dark surfaces |
| Error | `#FFACB8` | Error text or icon on dark surfaces |

Wine and plum carry most of the interface; magenta provides selective emphasis. Avoid a full-screen pink wash or a gradient on every panel. Do not tint product photography or put translucent colour over clothes being compared.

**Themes:** build the complete wine theme first. A future light companion can use blush surfaces and maroon type, but is not part of this revision's initial implementation. Spending modes change emphasis and a small label, not the navigation or full palette.

Validate actual text, icon, control, focus, disabled, and selected combinations during implementation. The token list alone is not a contrast audit.

### Typography

**Display: Cormorant Garamond, weights 500–600.** Proposed for page titles, outfit names, and the wordmark. Use a confident editorial serif with generous space around it; occasional italic emphasis can accent one phrase. Avoid thin weights and dense ornamental headlines.

**Interface: DM Sans, weights 400–700.** Proposed for body copy, product information, navigation, forms, and captions. Use it for metric numerals too, keeping data clean and immediately readable beside the expressive headlines.

This pairing replaces Space Grotesk and Manrope. It is a design proposal to verify on the next approved screen iteration, not a claim about fonts used by another app.

| Role | Mobile size / line height | Treatment |
| --- | --- | --- |
| Editorial headline | 40–48 / 44–52 px | Serif display, weight 600; one short headline |
| Page title | 32–36 / 38–42 px | Serif display, weight 600 |
| Section heading | 24–28 / 30–34 px | Serif display; interface semibold for compact utility sections |
| Body and form input | 16 / 24 px | Interface regular |
| Product name and controls | 14–16 / 20–24 px | Interface medium or semibold |
| Supporting metadata | 13 / 18 px | Interface; never use tiny text for price or availability |
| Metric | 32–40 / 38–44 px | Interface semibold, tabular numerals if available |

Use sentence case. Very short uppercase labels are optional, not the default reading style. Avoid more than two font families. Test ₹, numerals, long brand names, and required language coverage; choose a suitable script fallback if local-language support is added. Use Georgia as the display fallback and a system sans-serif for the interface. Avoid tight negative tracking that makes serif letters collide. Verify font assets and licences before bundling.

### Logo and wordmark

Replace the W/w. tile entirely, including the header, favicon, loading mark, and any future app icon.

**Proposed symbol: an abstract folded ribbon.** Two interlocking folds form a compact, asymmetric emblem inspired by fabric and the connection between discovery and ownership. It must not resolve into a W, initials, a face, or a person. Keep the geometry simple enough to recognise at favicon size, with a one-colour version.

Pair the symbol with **The Better Wardrobe** in the display serif, using an intentional two-line lockup where space is limited. The emblem can use rose on wine or wine on blush. Avoid enclosing a lowercase letter in a bright rounded square. Final vector construction is for the next approved design iteration; this file specifies the direction only.

### Shape, imagery, and density

- Use a 4 px spacing base; typical spacing steps are 4, 8, 12, 16, 24, 32, and 48 px.
- Start with 16 px mobile page gutters and 12 px grid gaps.
- Garment tiles: 8 px radius. Panels: 14 px. Sheets: 20 px at the top. Use compact rounded rectangles for actions; reserve pills for filters and short state labels.
- Use layered plum surfaces, fine rose-toned borders, and restrained shadows. Give a selected garment one clear outline rather than a stack of glows and badges.
- Product tiles use consistent image wells and contain the complete garment. Editorial compositions use clothing, accessories, and fabric details rather than decorative stock-model photos. User-requested personal previews preserve the body and outfit without distorting proportions.
- A faint seam line or fine grid may appear on the creative canvas. Keep texture out of text, charts, and comparison photography. Replace the earlier paper-and-scrapbook treatment with spacious garment compositions on wine surfaces.
- Use one consistent family of simple outline icons with labels for major actions. Avoid a different icon style in each tab.

## 4. One mobile shell, four distinct workspaces

Persistent bottom navigation: **Discover · My Wardrobe · Style Me · Insights**. Keep both icons and labels, an unmistakable selected state, and safe-area padding. The longer My Wardrobe label must fit without truncation at the smallest supported width.

Target comfortable operation at 360–430 px widths; verify 320 px and text enlargement without horizontal page scrolling. Use at least 44 × 44 px interactive targets as our design target, preferably 48 px for primary actions. Major tasks must work with taps; swipes and drag are enhancements with visible alternatives.

On larger screens, use the extra space: reference and results side by side in Discover; wardrobe and item details together; preview and controls together in Style Me. Do not stretch a phone layout across the entire desktop.

Preserve scroll position and draft state when switching tabs. Use a focused full-screen workspace for complex editing and a sheet for quick actions. Avoid nested sheets. The keyboard must not cover the styling input or submission action.

### Discover: reference becomes possibility

Opening composition: a short serif headline such as **“Find your next look.”**, a prominent screenshot input on a plum surface, and a small selection of garment-led cultural references underneath. Collection artwork should use the relevant pieces and typography, not celebrity portraits or stock models. Text and link entry should appear as working controls only when supported; early image-first builds should not advertise dead input paths.

After upload, keep a compact reference visible. Selecting a garment outlines it and reveals an isolated piece; a change-selection control remains accessible. Results preserve that reference through a thumbnail or expandable panel.

Result cards show the item image first, followed by name, retailer, price, match explanation, and India shopping context. Keep similarity and availability visually separate. Use text-backed labels such as “Similar style” and “India delivery verified”; percentages depend on the scoring decision in PRODUCT.md. Never use a fictional percentage to decorate a card.

Use one small aesthetic annotation, such as “Draper-coded,” where it fits. Product information stays upright and readable; expressive collage treatments belong to collection covers.

**Signature moment:** a selected piece lifts out of the reference and becomes the comparison thumbnail. This explains the search target rather than merely celebrating a click.

### My Wardrobe: a collection you recognise

Lead with owned pieces and clear categories. Use a compact Add photos action, a practical two-column garment grid on mobile, and a category row. The wardrobe should work even when motion is disabled.

During import, show candidate pieces separating from their source image and moving into a review tray. Let users rename, correct, deselect, and resolve duplicates before saving. After confirmation, pieces settle into their categories.

Use the SolidWorks-inspired exploded view as a short import reveal or optional outfit inspection mode. Everyday browsing should not require navigating a 3D room or dragging through shelves.

Each item opens a detail view with editable name, category, source, and actions. Ownership, saved inspiration, and purchase suggestions need distinct text labels wherever they coexist.

**Signature moment:** one photo becomes several individually recognisable pieces. Animation must reflect real extraction results; it cannot disguise invented garments.

### Style Me: the fitting studio

The preview occupies the largest area. Under it, show the selected outfit's pieces, conversational input, and a few contextual suggestions such as “Keep this shirt,” “Swap trousers,” and “Add accessories.”

Tapping a piece opens alternatives. Users can keep a piece fixed while changing others. Offer undo for the last revision and a way to compare alternatives; history depth remains an implementation decision.

Place a compact summary near the shopping action: **“2 pieces owned · 1 addition.”** Expand it into named items and buying options. Distinguish generated previews, original photos, and outfit boards in readable labels. Do not present an avatar as a personal try-on.

An updated preview should preserve the original until the replacement is ready. Show a progress state without blocking inspection of the previous look. A failed generation should preserve the outfit choices and provide retry.

**Signature moment:** swap one garment while the other chosen pieces stay visibly in place. Preview imagery changes only once new output exists; an animation must not imply live physical simulation.

### Insights: what your clothes do for you

Lead with a user-selected lens and a short evidence-based observation. Follow it with a few metrics and a related item story. Keep the number of headline metrics configurable until the 4–5 versus 45 ambiguity is resolved.

Use simple bars for comparisons, dots or a timeline for recorded wears, and a chronological item journal for quality reviews. Each chart needs a readable text summary and access to its underlying records. Avoid radar charts or unexplained composite scores.

Example hierarchy: **“Your black shirt appears in 6 logged outfits.”** Then the time period, item image, supporting history, and “Style it again.” All examples are illustrative until backed by user data.

Frugal maxing, Splurge maxing, YOLO, and Custom appear as explicit preference controls. Keep the underlying evidence available in every mode. Social metrics are optional and described at the post/outfit level.

**Signature moment:** an item unfolds into its story—purchase, recorded looks, and condition updates—with direct routes back to styling or discovery.

## 5. Motion language

Motion communicates selection, continuity, assembly, and completion. Use one expressive transition at a time; everything else stays calm enough to read.

| Interaction | Proposed timing | Behaviour |
| --- | --- | --- |
| Button press and selection | 100–150 ms | Small colour or scale change; no layout jump |
| Sheet or detail reveal | 200–280 ms | Short travel with ease-out; restore focus on close |
| Garment moving into a tray | 320–450 ms | Shared visual transition if supported; preserve item identity |
| Confirmed import reveal | 450–650 ms total | Small stagger, capped so larger batches do not become long sequences |
| Outfit update | 200–300 ms after output is ready | Crossfade or restrained piece transition |
| Milestone acknowledgement | Up to 600 ms | One brief stamp or accent pulse, dismissible and non-blocking |

Use restrained ease-out motion, initially `cubic-bezier(0.22, 1, 0.36, 1)`. A light spring is acceptable for deliberate dragging, with little overshoot. Do not make forms, prices, or navigation bounce.

Loading duration is determined by actual work. Never delay a result to complete an animation, fake scan progress, or show a retailer as checked before it is checked. Use real stage labels and indeterminate progress when completion is unknown. Respect cancellation and preserve completed work.

Reduced motion removes travel, stagger, parallax, and celebratory scaling, replacing them with immediate changes or short fades. Keep every state understandable without animation. This follows the W3C guidance on allowing interaction-triggered motion to be disabled. [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

Sound is off by default and not required. Haptics, where supported, are optional enhancements. No ambient autoplay or endless floating garments.

## 6. Gamification: reward creative progress

Make the reward a useful outcome: a recognised collection, a saved look, a discovered combination, or a richer item history. Start with a small number of optional mechanics.

| Proposed mechanic | Trigger | Reward | Scope |
| --- | --- | --- | --- |
| First five pieces | Five user-confirmed wardrobe items | A brief visual reveal of the starter collection | Initial candidate |
| Remix one piece | User accepts an alternative combination around a selected item | A look card they can revisit | Initial candidate, dependent on saved-look scope |
| One piece, three looks | Three distinct user-saved combinations | Optional personal milestone; not counted as actual wears | Later experiment |
| Six-month check-in | Item reaches an appropriate review date | Invitation to add a condition update, easily dismissed | Later, depends on dates and notification choices |

Do not use daily-streak loss, spend-to-level-up mechanics, purchase leaderboards, random purchase rewards, or body ratings. These are unnecessary to the creative goal. Recognition should work privately, without inviting friends or posting a selfie.

Avoid awarding an entire “style personality” after one action. If a user likes persona labels, let them choose and change them. A “Draper-coded” look is a styling descriptor, not a permanent profile identity.

Shareable look cards are a later design opportunity, not a public community requirement. If added, give users control over inclusion of their photo, prices, and retailer details; sharing must be deliberate.

## 7. Copy and emotional tone

Use the project's conversational guide for warmth and cultural fluency, while keeping product controls precise. The app should sound like a stylist who explains their choices.

| Situation | Example copy |
| --- | --- |
| Upload | “Drop a screenshot. Find the vibe.” |
| Match explanation | “Similar shape and colour. Different collar.” |
| No strong match | “No close match yet. Try a clearer crop or broaden the search.” |
| Import review | “Found 4 pieces. Check what belongs in your wardrobe.” |
| Outfit remix | “Keep the shirt. Switch the energy.” |
| Shopping gap | “You own 2 pieces. Here’s the missing one.” |
| Sparse insights | “A few more wear logs will make this useful.” |
| Quality review | “How is this holding up?” |

Use slang as seasoning. Avoid automatically addressing every user as “bro,” narrating every click, or using jokes for failed uploads, payment information, and privacy controls. Keep essential labels literal: Save look, Edit item, Open retailer, Try again.

## 8. Trust, access, and practical polish

- Target 4.5:1 contrast for ordinary text and 3:1 for large text and essential non-text controls; verify actual screens rather than assuming palette compliance.
- Keep keyboard operation, visible focus, screen-reader names, and readable status announcements. Selection and ownership cannot rely on colour alone.
- Provide tap alternatives for dragging and explicit controls for closing previews. Return focus appropriately after a sheet or dialog.
- Preserve user photos and garment colours faithfully. Do not silently reshape the body in personal previews.
- Label generated images, uncertain matches, unknown delivery, and sponsored results clearly when applicable.
- Use permission requests at the moment a capability is needed. Let users select individual photos and keep previews private by default.
- Show useful empty, loading, partial-success, failure, and offline states. A partial photo import should retain successfully processed items for review.
- Use Indian price formatting, space for ₹ values and long retailer names, and clear size and delivery context where verified. Avoid treating Western celebrity outfits as the full range of Indian style.
- Do not assume expensive devices or fast connections. Load product thumbnails before high-resolution images, reserve media space, and request heavy personal previews only when needed.

## 9. Delivery priorities and validation

### First visual build

Implementation remains paused until the user asks to resume. Then rebuild the visual direction around the wine theme, new serif/sans typography, folded-ribbon logo, and garment-led imagery. Apply it to the four-tab shell, shared item card, photo input and review, clear ownership states, outfit canvas, and basic insight cards. Add selection feedback and one well-executed garment transition. Use labelled sample data until integrations work.

### Next polish

Refine extraction assembly, outfit comparisons, contextual motion, and optional starter milestones. Validate actual photo inputs, match explanations, retailer handoffs, and mobile keyboard behaviour.

### Later experiments

Optional blush light theme, richer user-requested scene previews, look-card exports, additional customisation, and deeper gamification. A 3D wardrobe is an optional research direction, not a prerequisite for the launch.

### Review gates

- Can a first-time user identify where to upload without explanation?
- Can they distinguish the reference, an owned item, and a suggested purchase?
- Can they understand similarity separately from India availability?
- Can they change one outfit piece without losing the rest?
- Does the UI still work with reduced motion, enlarged text, and keyboard navigation?
- Does each insight show enough context to understand its meaning?
- Can they finish the main flows on a small phone and a slower connection?
- Does the design feel recognisable when decorative motion is turned off?

Test the prototype with a small, varied group of intended users before calling the direction validated. Observe task completion and misunderstandings; then ask what felt distinctive and what felt forced. Treat age groups separately in research rather than extrapolating adult feedback to younger users.

## 10. Decisions for design review

- Review the exact maroon/magenta shades and Cormorant Garamond/DM Sans pairing on the next approved screens.
- Review the folded-ribbon emblem and wordmark; do not reuse the W mark.
- Confirm the interpretation that “no people” excludes decorative model imagery while retaining user-supplied references and optional personal try-on.
- Choose how the personal preview and item tray share a small display.
- Approve the initial gamification mechanics before implementation.
- Decide whether saved-look comparison belongs in the first release.
- Resolve the Insights metric count and initial dashboard content.
- Define the launch age range and relevant account/photo experiences.

The design succeeds when users remember their look, understand their next action, and recognise the app's personality across all four tabs.
