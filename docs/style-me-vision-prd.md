# WardrobeOS — Style Me Vision PRD

Version: 1.0 · 14 October 2026 · Status: approved for development on 14 October 2026

Revision: Canvas and on-self preview are P0. Existing FR IDs remain stable; Canvas is FR#20. This document governs Style Me only. My Wardrobe is being developed separately with Claude; its PRD was read for alignment and remains unchanged.

## 1. Vision

Style Me is a personal styling agent that turns a request, garment, inspiration image, or occasion into an outfit the user can act on. It works with a full wardrobe, a few known pieces, or no wardrobe. It connects **what I own → how I could wear it → what is missing → where I can find it → what I actually wore**.

The core promise: **“Tell us what you’re dressing for. Get looks that suit you, use what you have, and help you find what you need.”**

AI-native means conversation is the main means of expressing and refining intent; outfit cards and direct controls make the answer usable. Headless means the styling engine exposes structured, versioned capabilities independently of its interface. It does not mean a text-only experience or an autonomous purchasing agent.

## 2. Evidence and competitive direction

Primary sources are the full PDFs supplied by Ayan Choudhary, dated 12 October 2026: Acloset (16 pages), Whering (12 pages), and Vastra (8 pages). All 36 pages were text-extracted and reviewed, with visual page overviews and closer inspection of key styling, community, extraction and wear-loop screenshots. Earlier Markdown reports were corroborating sources. These are observations from the tested sessions, not independently verified current product capabilities. Proposed requirements below are product decisions, not instructions taken from the reports.

| Evidence | Preserve | Competitive response | Requirements |
| --- | --- | --- | --- |
| Acloset winning 1–4; lagging 7 | Clear value explanation, guest entry, optional personalization, transparent background work | Deliver styling before importing; contextual permissions; no forced long quiz | FR#1, FR#2, FR#18 |
| Acloset winning 5–6; Vastra winning 2–3; Whering lagging 3 | Clean garment assets, meaningful categories, editing and preview | Separate garments from people; preserve true appearance; allow correction | FR#5, FR#9, FR#13 |
| Acloset winning 6; lagging 5; Whering lagging 2; Vastra lagging 1 | Wardrobe and weather styling | Occasion-aware, explained alternatives with owned-only, mixed and from-scratch modes | FR#3–FR#8 |
| Acloset lagging 6; Whering winning 1–2 | Community styling, share cards, moodboards | Recreate, adapt and find missing pieces from any inspiration | FR#10, FR#11, FR#15 |
| Acloset winning 7; Whering winning 3–4/lagging 4–6; Vastra winning 4/lagging 5 | Planning, wear logging, feedback, useful recaps | Turn history into the next outfit; prioritize usefulness over analytics dashboards | FR#12, FR#14, FR#16 |
| Acloset lagging 1–4; Vastra lagging 2–4 | Background tasks and honest progress | Fast usable recommendations, asynchronous imagery, transparent limits | FR#17, FR#18 |
| Whering lagging 6–7; Acloset lagging 6 | Local relevance and understandable navigation | Indian occasions, climates, garments, retailers and currency; polished labelled controls | FR#4, FR#7, FR#19 |

Marketplace and receipt import breadth is a required **My Wardrobe integration dependency**, not a second import system inside Style Me. Magazine content, community moderation, commerce indexing and full wardrobe analytics belong to their respective shared modules. Their useful outputs must be reachable from Style Me.

## 3. Users, jobs and outcomes

- New user without digitized clothes: get a useful outfit immediately, without pretending suggested pieces are owned.
- User with a partial or full wardrobe: combine available pieces, rescue an underused item, or identify a worthwhile gap.
- Occasion-led user: dress for a specific event, venue, weather and comfort level.
- Inspiration-led user: translate a photo or community look into a realistic personal version.
- Repeat user: refine, plan, wear and learn without repeating the same preferences.

Primary outcome: the user reaches a look they would wear and completes a relevant next step. Purchases and time spent chatting are secondary outcomes.

## 4. Product principles

1. No minimum wardrobe size, selfie, body measurements, location permission or account to request a first look.
2. Respect explicit constraints before aesthetic novelty. Distinguish hard constraints from preferences.
3. Keep ownership and evidence visible: owned, user-described owned, suggested concept, verified product, or unverified reference.
4. Prefer reuse in mixed mode; never silently override an owned-only request.
5. Explain choices with specific, concise reasoning. Do not claim objective fashion correctness, guaranteed fit or bodily inadequacy.
6. Preserve useful output during enrichment, failures and refinements.
7. Ask only questions that materially affect the answer. Let the user proceed with editable assumptions.
8. Keep community participation and core feedback accessible; price expensive optional generation transparently.

## 5. Functional requirements

### FR#1 — Entry and first value [P0]

Provide a concise promise, example prompts, and entry actions: Dress for an occasion, Style this item, Start from scratch, Recreate a look, and Use my wardrobe. Guest sessions receive real styling output. Onboarding is skippable. Authentication is contextual when durable saving or sharing identity requires it, with the session preserved through sign-in. Explain guest persistence honestly.

Acceptance: an empty-wardrobe guest can request and refine a look without upload or sign-in; returning users resume their last session.

### FR#2 — Conversational brief and preference memory [P0]

Accept natural language and image attachments. Build an editable brief containing occasion, time, place, dress code, aesthetic, garment scope, budget, currency, comfort, coverage, exclusions and available items. Ask at most two high-impact questions in the initial response when needed. Otherwise state assumptions and generate. Capture optional preferences progressively. Distinguish session choices from preferences the user explicitly saves; allow inspection, correction and deletion.

Acceptance: “less formal, no heels, under ₹3,000” updates the relevant constraints without resetting the occasion. Sensitive appearance or identity attributes are not inferred from photos.

### FR#3 — Styling source modes [P0]

Support Owned only, Mix owned + new, and From scratch. Infer a proposed mode from the request and expose it clearly. Users can switch without restarting. Partial wardrobes remain useful. An owned-only result with missing essentials explains the gap and offers feasible partial looks or a mode change; it never invents owned items. Provide a searchable Essentials picker with multi-select for common garments, including Indian categories, so users can describe a starter wardrobe without photos. Show conceptual assets as representative. Generic basics become owned only when the user confirms ownership.

Acceptance: zero, one, five and fifty-item wardrobes all produce honest, actionable results; purchased or saved products remain unowned until confirmed.

### FR#4 — Occasion styling [P0]

Support work, interviews, dates, campus, travel, beach, parties, weddings, festivals and everyday dressing, including Indian and Indo-Western outfits. Interpret venue, role, activity, duration and dress code. For broad requests such as “wedding,” clarify the function or present explicitly labelled assumptions. Distinguish suggestions for guests, hosts and other roles when provided.

Acceptance: a humid outdoor wedding and an air-conditioned office dinner yield meaningfully different fabric, footwear and layering guidance; cultural assumptions remain editable.

### FR#5 — Style an item or selected pieces [P0]

Accept wardrobe IDs, a photo, a product reference, or text such as “my navy kurta.” Users can pin pieces, exclude pieces and ask for several ways to wear one item. For multi-garment images, show detected pieces for selection and correction. An uploaded reference does not imply ownership. Unknown material or fit is labelled uncertain.

Acceptance: the pinned item survives swaps and regeneration; an ambiguous image supports confirmation or text correction instead of silent misclassification.

### FR#6 — Start from scratch [P0]

Create complete conceptual outfits without wardrobe data or shopping access. Include garment types, colours, silhouette, likely suitable materials, footwear and optional accessories, plus styling instructions. Provide starter choices for users who cannot name an aesthetic. Product imagery and generated visuals must be distinguished from real stock.

Acceptance: a first-time user receives a coherent wearable direction and can later map pieces to owned items or verified products.

### FR#7 — Context and practical suitability [P0]

Use user-provided place, date and conditions. Weather lookup is optional; disclose source and freshness when available. Never guess the user’s state as fact. Permit manual weather entry and useful recommendations if lookup fails. Account for walking, commute, rain, heat, indoor cooling and user-stated coverage or accessibility needs. Future dates beyond reliable forecasts use labelled seasonal assumptions.

Acceptance: permission denial does not block styling; unsuitable unavailable items are excluded; explicit no-leather or no-heels constraints apply to all slots.

### FR#8 — Outfit options and explanations [P0]

Default to three meaningfully different looks where the brief and inventory permit. Each includes a name, occasion fit, garment slots, provenance, concise rationale, styling instructions, relevant tradeoffs, unresolved gaps and actions. Offer fewer rather than pad with near-duplicates. Identify experimental combinations explicitly and explain when they could work. Avoid decorative numerical confidence scores without calibrated evidence.

Acceptance: hard-constraint violations cannot be returned as valid final looks; insufficient inventory yields an honest explanation; image generation is not required to view the recommendations.

### FR#9 — Refinement and direct editing [P0]

Support chat and direct actions: swap a slot, pin, remove, make more casual, change colour, reduce cost, use only owned pieces and regenerate unpinned pieces. Display a usable board automatically and offer Open Canvas inside the conversation (FR#20). Chat refinement and Canvas edit the same outfit revision. Canvas is a required P0 capability; entering it is the user’s choice. Keep version history and undo. Revalidate the complete outfit after edits.

Acceptance: “change only the shoes” preserves all other chosen pieces; conflicting locks or constraints are explained with resolution choices.

### FR#10 — Wardrobe gaps and shopping handoff [P0 gaps; P1 verified commerce]

Separate what is owned from what is missing. Rank gaps by necessity and reuse potential; accessories are optional unless the brief requires them. Offer a no-purchase alternative where feasible. Discover supplies real product candidates matched to colour, category, size requirements, budget, region and retailer preferences. Show price currency, retrieval time, availability evidence and direct links. Explain when size or stock is unknown. No fabricated URLs or prices; no purchase execution.

Acceptance: concept-only suggestions remain useful when catalog access fails; a strict total budget covers required new pieces and reports whether shipping is known; no recommendation is described as available in the required size without evidence.

### FR#11 — Inspiration to personal outfit [P1]

Accept a photo, moodboard or community look; links work only where content access is supported. Extract styling attributes and selected garments, then offer Recreate from my wardrobe, Adapt to my occasion, or Find similar. Preserve attribution for community sources. Ask for an upload if a link is inaccessible. “Similar” must explain differences and must not imply an exact match.

Acceptance: a community look leads directly to a personal brief and actionable owned/missing split, without an hour-long dead-end wait.

### FR#12 — Save, plan and wear [P0 save; P1 planning and wear]

Save a versioned look with its brief, rationale and item references. Offer collections/moodboards, event/date planning, Mark as worn, and undo. Reminders require opt-in. Before a planned event, recheck relevant weather and item availability; suggest replacements when needed. Wear logging is user-confirmed and updates shared wardrobe history idempotently.

Acceptance: saving a concept never adds it to owned inventory; duplicate taps do not double-log a wear; deleted wardrobe items do not make old saved looks unreadable.

### FR#13 — Visual board and on-self preview [P0]

Render clean boards using real assets where available and labelled placeholders otherwise. Background removal and optional enhancement must preserve identifying garment details; retain originals. Users can preview a frozen Canvas outfit on themselves using a consented reference photo. This is an optional user action but a required P0 product capability, not deferred enrichment. A mannequin or static outfit board alone does not satisfy this requirement.

Use a separate asynchronous preview job bound to the exact frozen outfit version, garment assets and reference-photo version. Explain photo requirements before capture/upload; guide retakes for missing body coverage, blur or unsuitable framing. Do not infer missing measurements. User-described or conceptual pieces can be illustrated, but their approximate appearance must be identified. Unsupported categories or insufficient visible detail are disclosed before rendering, with a correction or alternative path; do not silently omit or substitute pieces.

Show queued, processing, completed, failed and cancelled states with real progress; support safe retry and resumable jobs. Ask for consent before sending personal photos to a provider. Disclose any cost before starting; technical retries must not double-charge. Show the original frozen board alongside the result. Clearly label the result as an illustrative preview with possible garment/body inaccuracies, not proof of fit or sizing. Keep reference photos private and support deletion of photos, results and derived assets under a stated retention policy.

Acceptance: freeze a supported shirt/trousers/shoes combination, supply a valid personal photo, and receive an actual on-self preview of that exact frozen version. A preview failure preserves the frozen design and offers retry. Later edits never relabel an old preview as the current design. Consent denial permits continued Canvas use. A queued job is cancelled or its result invalidated when its photo is deleted. No identifying garment change is passed off as faithful reproduction.

### FR#14 — Feedback and learning [P0 feedback; P1 longitudinal learning]

Collect lightweight feedback with reasons such as too formal, uncomfortable, repetitive, not my style or too expensive. Ask after useful interaction, not during generation. Learn from explicit choices and confirmed wear history. Offer “why am I seeing this?” and memory reset. Do not infer dislike from failure to purchase.

Acceptance: rejecting heels prevents repeated heel suggestions in the same session; persistent exclusions require a visible saved preference; reset removes derived personalization as well as displayed settings.

### FR#15 — Community styling and sharing [P1]

Support opt-in public looks, private share cards, save-to-board, style a shared item and styling another person’s explicitly shared items. Provide For You, outfit selfies and styling submissions views, creator follow and reactions. Support private link sharing and exportable cards through the device share interface. A user can create a moodboard inline without leaving the look. Attribute contributors and offer featured looks with transparent criteria. Core posting and participation should be free; final business policy remains to be approved. Public sharing needs a preview that removes private context. Include reporting, blocking, moderation and deletion in the release scope.

Acceptance: private wardrobe/profile data never becomes public through a share action; community cards expose Recreate/Adapt/Find similar where supported; withdrawal of shared items removes future access.

### FR#16 — Actionable history, recaps and education [P2]

Turn history into underused-item suggestions, useful repeats, packing ideas and optional seasonal recaps. Include short relevant styling/care guidance and optional opt-in reports. Expose optional most/least worn items, top looks, category and colour distribution, wardrobe usage, cost per wear and wardrobe value through shared analytics. Distinguish actual owned inventory from concepts in every calculation. Reward accepted contributions or useful reuse milestones through optional badges, without imposing item-count gates on styling. Cost per wear appears only with valid price and wear data; no invented zeros or sustainability claims. Analytics are optional and lead to a styling action.

Acceptance: sparse data yields practical suggestions instead of empty charts; each recap can start a new brief, style an item or plan a look.

### FR#17 — Headless styling capabilities [P0]

Expose versioned operations for create/resume session, update brief, propose looks, refine, retrieve status, save, feedback and cancel, plus Canvas item/board edits, freeze, fork a frozen design and request an on-self preview. Return validated structured outfits alongside conversational text. Core objects: StyleSession, StyleBrief, GarmentReference, Outfit, OutfitVersion, ProductCandidate, Feedback, WearEvent, CanvasState, FrozenDesign, PreviewJob and AsyncJob. Canvas layout and garment selection are separate fields: moving a card changes board layout, while changing clothing layer order changes the outfit and triggers revalidation. PreviewJob records the frozen design ID, outfit revision, garment asset versions, reference-photo version, consent record and job status. Each garment reference carries source, ownership state, item/version reference and evidence. Events distinguish brief update, draft, validated outfit, enrichment progress, completion and error.

Support authorization at every resource boundary, idempotent mutations, request tracing, explicit timeouts, cancellation and bounded tool/model budgets. Validate constraints and ownership independently of generated prose. Treat retrieved text and image metadata as untrusted content. Shared logic must serve the app and future interfaces consistently.

Acceptance: an API client can complete the core styling/refinement flow without UI logic; another user’s wardrobe cannot be retrieved by changing an ID; a cancelled or superseded job cannot overwrite a newer outfit.

### FR#18 — Latency, failure recovery and transparent cost [P0]

Stream genuine progress and useful output. Run catalog search, garment imagery and try-on independently where possible. Persist asynchronous jobs when promised; provide safe retries with no duplicate charge. State any credit cost before an optional paid operation. Do not block every chat refinement behind image generation. Preserve briefs and last valid outfits on failure.

Acceptance: model, wardrobe, weather, catalog and image-service outages each have a tested fallback; temporary failure does not erase the user’s choices or fabricate a successful result.

### FR#19 — Privacy, accessibility and localization [P0]

Explain photo processing and third-party services before upload where consent is required. Request location/camera/photo access only at use. Provide text/manual alternatives, data deletion and clear guest/account retention rules. Photos and wardrobe data are private by default. Use INR and India-relevant garments, retailers, occasions and climate in the initial market while supporting editable region/currency. Label navigation and controls; support keyboard, screen readers, contrast, text scaling and reduced motion. Never require body measurements for ordinary suggestions.

Acceptance: a user can complete the core flow with text only, denied permissions and assistive technology; deletion reaches stored images and derived profile data within the declared retention policy.

### FR#20 — Canvas inside the conversational agent [P0]

**Purpose:** let users play with an outfit visually, add or remove garments, freeze a chosen design and see it on themselves, within the same styling conversation.

**Entry and placement.** An outfit card offers Open Canvas, and chat understands “open canvas,” “let me build it myself” and “show this on me.” Canvas opens as an embedded panel in the current agent session. On mobile it may expand to an accessible full-height sheet, with Back to conversation retaining every edit. It is not a separate module or standalone navigation destination. Start from an AI outfit, saved look or empty board, with no minimum wardrobe size.

**Garment tray.** Provide category trays for tops/shirts, trousers/bottoms, one-piece outfits, footwear, outerwear and accessories, using appropriate Indian categories. Sources are My Wardrobe, user-described pieces, representative Essentials and selected Discover candidates when available. Each card displays ownership and provenance. Search and filters work without leaving Canvas. From-scratch users can build entirely with labelled conceptual pieces.

**Playful editing.** Drag garments into meaningful slots; also provide equivalent tap/click and keyboard Add, Replace, Remove, Move layer, Pin and Undo actions. Snap into place with short optional animations, selection highlights and a subtle completion celebration. Offer Try another combination and AI help for a selected slot; random choices must be constrained by the brief and pinned pieces. No timers, forced streaks, mystery pricing or unsupported fashion scores. Reduced-motion and screen-reader users get the same editing capabilities.

**Outfit model.** Support valid top/bottom and one-piece combinations, optional outerwear/accessories and explicit clothing layer order. A multi-slot piece is one selected garment, not duplicated inventory. Replacing a garment changes that slot deliberately; multiple tops require explicit layering. Board placement is visual arrangement and is not evidence of fit, tuck, drape or rendered position on the body. The user may request tucked/untucked or open/closed layers as separate styling instructions.

**Agent collaboration.** Chat and Canvas share one versioned outfit and editable brief. “Add white sneakers” appears in Canvas; deleting the jacket updates the next agent response. AI changes present a concise change summary and leave pinned items intact. Flag conflicting items, missing required pieces, unsuitable weather or exceeded budgets with reasons and ways to resolve them. Conceptual items may be frozen; invalid constraints, conflicting layers or unsupported preview coverage must be resolved or explicitly amended before preview. Race conditions use revision checks: never overwrite newer edits silently.

**Freeze.** Freeze design creates an immutable snapshot of the selected garments, source/ownership labels, asset versions, layering instructions, layout and brief. Preview the summary before final freeze. A frozen view offers See on me, Save look and Edit a copy. Further edits create a new draft; the existing frozen design and any preview remain attached to their original version. Changing the board’s decorative layout alone does not change the outfit contents. Freeze does not mark anything as owned, worn or purchased and does not charge or start image generation automatically.

**See on me.** From the frozen design, select or capture a reference photo with consent and start FR#13. Keep the frozen board visible while rendering. View the result beside the outfit and offer Retry, Edit a copy, Save and Delete preview. A mock response or mannequin fallback cannot pass the P0 release gate. If the preview provider is unavailable, retain the design, explain the failure and allow retry; never claim it has completed.

**State flow:** draft → validated draft → frozen snapshot → preview queued → processing → completed / failed / cancelled. Opening an existing frozen design for editing forks a new draft. Navigation, sign-in migration and retries preserve the appropriate state and identifiers.

Acceptance:

- From one conversation, add a shirt, trousers and shoes; remove/replace each; pin a garment; undo an edit; freeze; then view an actual on-self preview.
- Complete the same journey with owned pieces, conceptual pieces and a mixed selection, keeping provenance visible.
- Chat edits and direct manipulation remain synchronized; simultaneous stale edits are detected and resolved.
- A preview uses the exact frozen snapshot; editing a copy while it renders cannot affect its output or overwrite the newer draft.
- Saved drafts and freezes resume after reload; guest migration preserves them at sign-in with the declared guest persistence policy.
- Tap/keyboard controls complete the flow without dragging; mobile navigation and reduced motion preserve functionality.
- Invalid photo, unsupported garment, service failure, cancellation, expired image URL, deletion and duplicate request paths have explicit recoverable behavior.

## 6. End-to-end experience

**No wardrobe:** “Style me for a beach evening in Mangalore” → editable assumptions/location/date → three concept looks → “no shopping, I have beige shorts” → confirm those as user-described owned → refine around them → save or share.

**Owned wardrobe:** occasion request → choose Owned only → retrieve available garments → three grounded options or an explained inventory limitation → pin a shirt → swap footwear → save → plan → confirm worn → improve subsequent suggestions.

**Mixed wardrobe:** occasion plus budget → reuse suitable owned pieces → explain required gaps → optional verified Discover candidates → choose a candidate → keep it unowned until confirmed → recompute outfit and total.

**Inspiration:** upload or community look → confirm selected pieces → adapt to climate, occasion and taste → recreate from owned pieces → offer missing concepts/products → save with attribution.

**Canvas-first:** ask for a look or start an empty Canvas → add a shirt, trousers and shoes from the tray → ask the agent to improve the combination → pin the shirt and replace the shoes → freeze the design → consent and provide a photo → view the on-self preview → save or edit a new copy. This full journey is P0.

All journeys share the same persistent brief, outfit model and refinement logic. Changing mode must not force a new conversation.

## 7. Quality and performance release criteria

Proposed targets are engineering objectives, not measured guarantees. Measure at p50/p95 on a defined representative network/device and input cohort; include cold starts and report image-upload time separately.

| Area | Proposed release gate |
| --- | --- |
| Responsiveness | Request acknowledgement p95 ≤1 second; first useful styling draft p95 ≤5 seconds; first validated complete outfit p95 ≤10 seconds; default alternatives p95 ≤15 seconds |
| Canvas interaction | Local add/remove/move/undo responds within 100 ms p95 on the agreed test devices; network or AI work never blocks local editing |
| Frozen design integrity | Exact snapshot binding, stale-write protection and idempotent freeze/preview requests pass all release scenarios |
| On-self preview | Actual supported-garment rendering on a user photo; target p95 ≤45 seconds after valid input is accepted, excluding upload; timeout at 90 seconds returns a recoverable status with no duplicate charge |
| Preview quality | Evaluate at least 30 consented photos and 10 supported combinations, including Indian categories claimed at launch; ≥85% reviewer acceptance for garment recognizability and layering; materially altered or omitted pieces cannot be labelled faithful |
| Refinement | First validated revised outfit p95 ≤8 seconds when no new upload is required |
| Hard constraints and ownership | Zero known violations in the release evaluation suite; runtime validation blocks violations and invented owned IDs |
| Styling quality | ≥85% of evaluation requests receive at least one wearable, brief-appropriate look according to a documented reviewer rubric; use two reviewers and adjudicate disagreement |
| Honesty | Every garment/product carries provenance; every weather/price/stock claim carries appropriate evidence or an explicit uncertainty label |
| Reliability | Core flow succeeds in ≥99% of valid production requests over a rolling 7-day window, excluding explicitly cancelled requests; dependency failures also tracked separately |
| Privacy | All cross-user access, private-share leakage, deletion and consent scenarios pass before launch |

Start with at least 100 representative briefs across no/partial/full wardrobes, Indian and Western categories, hot/rainy/cool conditions, tight budgets, exclusions, contradictory constraints and multiple refinements. Review coherence, feasibility, contextual relevance, differentiation, helpful explanations and honest sourcing. Include adversarial product metadata, stale inventory, inaccessible links, denied permissions, service failures, cancellation and duplicate actions.

On-self preview is a separate P0 release gate with its own proposed time and quality budgets; it does not delay the first styling answer. Validate the preview provider and supported garment matrix before committing launch promises. P0 must include at least a shirt/trousers/shoes preview; publish the tested supported categories and disclose any limitations. Untested categories cannot be claimed as supported. Advanced avatar generation and multi-angle previews are P2. If proposed timings cannot be met with validated quality, revise the architecture or explicitly amend this PRD before release.

## 8. Measurement

North-star: weekly users who confirm a suggested look as something they would wear, save/plan/wear it, or choose an applicable product. Report these actions separately; a click alone is not proof of satisfaction.

Track first-session useful-look rate, time to first accepted look, successful refinement rate, save-to-confirmed-wear conversion, 7/28-day repeat styling, no-wardrobe activation versus wardrobe-user activation, and community inspiration-to-personal-look conversion. Also track Canvas entry-to-freeze conversion, freeze-to-preview completion, preview acceptance, editing abandonment, retry rate and render cost per accepted frozen look. Guardrails: constraint violations, repetitive suggestions, abandonment, unverified commerce claims, service errors, inference/render cost per accepted look and privacy incidents. Establish cohort baselines in beta before assigning growth targets.

## 9. Prioritization, delivery and module boundaries

P0 means required for the initial Style Me release. P1 completes connected workflows after P0; P2 adds depth after the core and connected experience are validated. Implementation order within P0 is sequencing, not permission to drop a requirement. Split-priority rows specify exactly which behavior ships in each release.

| FR | P0 — initial release | P1 — connected release | P2 — enrichment |
| --- | --- | --- | --- |
| FR#1 | Guest entry and first value | — | — |
| FR#2 | Conversational brief; editable explicit saved preferences | — | — |
| FR#3 | All three source modes; photo-free Essentials | — | — |
| FR#4 | Occasion and dress-code styling | — | — |
| FR#5 | Style selected pieces; pins and correction | — | — |
| FR#6 | From-scratch outfit generation | — | — |
| FR#7 | Practical context; manual/weather fallback | — | — |
| FR#8 | Explained, distinct options | — | — |
| FR#9 | Chat/direct refinement; synchronized Canvas edits | — | — |
| FR#10 | Owned/missing split and no-purchase alternatives | Evidence-backed product search and shopping handoff | — |
| FR#11 | — | Inspiration recreation/adaptation | — |
| FR#12 | Save/version/resume looks, Canvas drafts and frozen designs | Collections, event planning, wear logging and reminders | — |
| FR#13 | Boards; real on-self preview of frozen Canvas designs | — | Advanced avatars, poses and multiple views |
| FR#14 | Explicit feedback and saved exclusions | Longitudinal learning from confirmed history | — |
| FR#15 | — | Community, private sharing, export cards and featured contributors | — |
| FR#16 | — | — | Recaps, education, optional analytics and rewards |
| FR#17 | Styling, Canvas, freeze and preview API contracts | Connected API extensions | Additional interface clients |
| FR#18 | Progress, recovery, transparent costs and bounded jobs | — | — |
| FR#19 | Privacy, accessible Canvas, India-first localization | — | Broader localization |
| FR#20 | Entire embedded Canvas → freeze → See on me flow | — | Additional creative tools after validation |

**P0 implementation order after approval:** (1) shared brief/outfit and wardrobe adapter contracts; (2) conversational styling and structured validation; (3) embedded Canvas and synchronized editing; (4) durable freeze/versioning; (5) reference-photo handling and real preview integration; (6) end-to-end quality, accessibility, recovery and privacy verification. Preview-provider feasibility must be explored early because it is a P0 dependency, not left until the final step.

**P0 exit:** users with zero, partial and full wardrobes can get and refine recommendations, edit Canvas, freeze, preview a supported outfit on themselves and save/resume. All P0 acceptance criteria and applicable quality gates must pass. A fake renderer, mannequin-only result, detached editor or disabled See on me button does not satisfy P0.

My Wardrobe owns ingestion, canonical garment records, garment corrections, availability and wear records. Discover owns product retrieval, availability, retailer links and evidence. Style Me owns briefs, composition, explanations, refinement, gap analysis, Canvas drafts/layout, frozen outfit snapshots and personal preview orchestration. Shared services own identity, consent, media storage/jobs, community moderation, notifications and telemetry. Personal preview photos are not wardrobe-item photos and need a separate consent/retention contract.

### Alignment with the separately developed My Wardrobe module

The supplied My Wardrobe PRD is reference context only. No requirements have been transferred into it or copied out of it to change Style Me’s product scope. The interfaces below are proposed coordination contracts, not claims about implemented APIs. The reference describes existing code elsewhere; that application source is not present in this workspace and has not been verified here.

| Boundary | Style Me needs | Responsibility and fallback |
| --- | --- | --- |
| Item retrieval | Stable item ID/revision; name/category; confirmed ownership; editable attributes with uncertainty; original/faithful visual; source; optional size/price | My Wardrobe supplies records. Unknown attributes stay unknown; Style Me uses representative placeholders when assets are missing. |
| Availability/lifecycle | Known available/unavailable status, deletion/archive and revision updates | Consume lifecycle events when implemented. Until then, allow session exclusions and ask users about availability where material; do not claim a live laundry/lent status. |
| Contextual launch | Style item or wardrobe gap opens Style Me with selected IDs and optional occasion/brief | My Wardrobe owns its CTA. Style Me validates IDs/access and starts the existing session contract. |
| Account and guest scope | Authorized user/guest context, persistence capabilities and migration outcome | Shared identity/persistence contract; Style Me preserves its own session and Canvas state and never assumes a wardrobe is synced before integration is verified. |
| Wardrobe mutations | Optional ownership confirmation or corrected garment attributes | Use explicit user-confirmed commands through My Wardrobe’s interface; Canvas changes do not mutate wardrobe records. |
| Wear feedback | Confirmed outfit wear with selected owned-item IDs, event ID/date and idempotency key | P1 handoff to My Wardrobe wear logging. Style Me does not duplicate its wear ledger. |
| Community scope | Explicitly shared item IDs and visibility/consent boundaries | P1 integration through the shared Community feature. Never expose private inventory by default. |

Style Me has no minimum-item gate. My Wardrobe’s milestone/unlock messaging belongs to its owner; its adapter must not gate from-scratch or partial-wardrobe Style Me access. This boundary requires coordination, without rewriting either module’s document. Likewise, later My Wardrobe lifecycle or community phases must not block P0 Canvas: use supported read interfaces and explicit fallbacks.

Before integration, agree an interface schema/version, error contract, event contract, authorization behavior and fixture set with the separately developed module. Prototype adapters may use fixtures while contracts settle; final acceptance for wardrobe-connected paths requires real integration. Do not copy connector, ingestion, taxonomy-management or ledger implementations into Style Me. The user can provide dependencies from that work when implementation begins; this document does not authorize sending Claude messages.

## 10. Decisions for implementation after approval

Recommended defaults: India-first but region-editable; three distinct options; owned-first mixed mode when inventory exists; from-scratch mode otherwise; no compulsory quiz; P0 embedded Canvas and real on-self preview; core text/board/Canvas editing accessible before any disclosed paid rendering; private by default. Pricing, exact free limits, supported initial retailers, retention periods, provider contracts and production hosting require concrete implementation decisions before their respective launches.

After product approval: confirm these defaults and stage scope; locate the current app source or establish the application foundation; design the API/data contracts and representative styling evaluation set; build the shared engine and full core journeys; validate against this PRD; then complete P1 connected and P2 enrichment requirements. The user approved development on 14 October 2026. Implementation must satisfy the agreed P0 scope before the first release. Maintain a requirement-to-design-to-code-to-verification matrix using these stable FR IDs. Any scope amendment must state the affected IDs, user impact and revised acceptance criteria.

## 11. Winning-feature coverage and PDF traceability

“Carry forward” means preserve the user benefit; mechanics that undermine immediate value are adapted explicitly. Every winning area remains in the full vision, even when delivered after the first core release.

| Source winning area | PDF pages | Destination and treatment |
| --- | --- | --- |
| Acloset 1: onboarding | 1 | FR#1: clear promise, skippable explanation and guest entry; use only substantiated social proof |
| Acloset 2: tailored quiz/import offer | 2 | FR#2 + My Wardrobe: progressive preferences and relevant optional import offers |
| Acloset 3: import breadth | 2–3 | My Wardrobe integration: camera, album, web/library, supported marketplaces, receipt forwarding/email and browser import; release each source after feasibility validation |
| Acloset 4: transparent background import | 3 | FR#18–FR#19 + ingestion job contract: disclosed fields, real progress and resumable work |
| Acloset 5: clean tagged assets | 4 | FR#5/FR#13 + canonical wardrobe taxonomy and extraction |
| Acloset 6: complete styling toolkit | 4–5 | FR#4/FR#7/FR#8/FR#9/FR#13/FR#16/FR#20: suggestions, category selection, layouts/canvas, weather, optional try-on and stats |
| Acloset 7: retention | 5–6 | FR#12/FR#14/FR#15/FR#16: calendar, education, community, opt-in reports, feedback and optional rewards; replace minimum-item unlock with immediate styling |
| Whering 1: community styling | 1 | FR#15: style shared items, attributed submissions, reactions/follows and discovery views |
| Whering 2: saving/sharing | 2 | FR#12/FR#15: inline moodboards, links and exportable share cards |
| Whering 3: Unpacked | 2–3 | FR#16: opt-in seasonal recap linked to styling actions |
| Whering 4: sustainability stats | 3 | FR#16 + shared analytics: valid optional metrics; respect the survey finding that these are secondary for the target audience |
| Whering 5: quick basics | 3–4 | FR#3/FR#6: Essentials multi-select; never silently mark aspirational items as owned |
| Vastra 1: clear entry and Essentials | 1 | FR#1/FR#3: understandable entry and photo-free starter pieces |
| Vastra 2: extraction quality | 2 | FR#5/FR#13: individual garments and explicit Indian categories; correct uncertain tags |
| Vastra 3: disclosure and queue | 2–3 | FR#18/FR#19: consent, per-job stages and recoverable background work |
| Vastra 4: wearing feeds insight | 3 | FR#12/FR#14/FR#16: confirmed wear updates history, recommendations and optional insights |

Competitive-gap evidence: Acloset lagging findings are on pages 6–13 (slow/inaccurate import, blocking AI, closet-only answers, community dead ends and permissions); Whering on pages 4–9 (limited ingestion, manual styling, recognition errors, passive calendar, participation friction and localization); Vastra on pages 4–6 (slow unexplained styling, narrow input, per-action costs, empty insights and absent discovery/community).

Implementation dependencies must preserve quality: ingestion should expose confirmed ownership, duplicates, deleted/returned/gift items, processing status and editable categories. Style Me must exclude non-apparel and unavailable items from normal clothing selection while retaining user-chosen accessories. It may use already-confirmed items while imports continue. Unknown or low-confidence imported items cannot silently become recommendation facts. Broad mailbox access is not a prerequisite for styling.

## Source files and alignment reference

- /Users/ayanchoudhary/Downloads/Acloset App Teardown.pdf
- /Users/ayanchoudhary/Downloads/Whering App Teardown.pdf
- /Users/ayanchoudhary/Downloads/Vastra App Teardown.pdf

Alignment reference only: /Users/ayanchoudhary/Downloads/My Wardrobe Vision PRD.md (read-only; separate module; no edits).
