# Style Me P0 implementation and release checklist

## Scope and source

Implementation follows the approved `style-me-vision-prd.md`, including P0 embedded Canvas (FR#20) and Gemini on-self preview (FR#13). It lives in separate modules to keep integration with the independently developed My Wardrobe module narrow. This is an initial implementation branch, not a production-ready declaration that every PRD release gate has passed.

## Implemented

- Conversational brief, source modes, occasion requests, explicit exclusions, owner-scoped opt-in preference memory/reset and optional user-provided context.
- OpenRouter structured AI outfits with ownership, inventory-ID and pinned-piece validation; curated starter mode when text AI is absent.
- An editable starter direction streams and is persisted before the AI answer. Subsequent user edits prevent the late answer from overwriting the chosen outfit.
- Embedded Canvas with garment trays, source labels, search, drag-to-slot and equivalent buttons, manual described pieces, pins, undo, explicit layers and reference-photo crops through the shared photo reader.
- Frozen outfit snapshots, saved sessions, previous frozen-version selection and editing copies.
- Owner-scoped file/Postgres storage, atomic revisions and account migration of this browser's guest sessions. Non-configured serverless storage fails explicitly instead of claiming persistence.
- Gemini image generation with personal-photo consent, disclosed credits, bounded inputs/timeouts, saved job states, snapshot binding, optional garment image references, failure refunds, retry and deletion. Original personal photos are not saved to session storage. Generated results become inaccessible after 24 hours and are physically purged on the next owner-scoped operation; scheduled global deletion is still required for strict timed erasure.
- A public client adapter registration point: `window.StyleMe.registerWardrobeAdapter(() => records)`. The host can pass available confirmed wardrobe records; currently legacy device records are labelled user-described and sample wardrobe data is excluded.

## Run

```sh
cd prototype
npm ci
npm run check
npm test
npm start
```

Open `http://127.0.0.1:5173/#style`. Without provider keys, starter mode remains available. Do not commit `.env`, personal images or `.local-data`.

Server-side configuration:

- `OPENROUTER_API_KEY`: uses the app's existing prepaid account for text styling; 8 preview credits per successful request, refunded on failure.
- `STYLE_AI_ENABLED=false`: explicitly use curated starters without calling a text provider.
- `GEMINI_API_KEY`, `STYLE_PREVIEW_ENABLED=true`, `STYLE_PREVIEW_MODEL=gemini-nano-banana-2.1`: enable the user-selected Gemini image preview. The model is configurable; its supported image request format follows [Google's image-generation documentation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation).
- `POSTGRES_URL` or `COMMUNITY_DATABASE_URL`: account/session persistence on Vercel. Local development otherwise uses an atomic file in `.local-data`.

No SerpApi searches are made by Style Me P0. Commerce remains P1. Production provider configuration and model access must be checked in the destination environment, rather than assuming a working local key proves deployment configuration.

## API v1 contract

Every route is same-origin, no-store and scoped to the signed-in account or HttpOnly guest identity. Session IDs never substitute for owner authorization.

| Route | Method | Operation |
| --- | --- | --- |
| `/api/style/status` | GET | Public capabilities and representative Essentials |
| `/api/style/sessions` | GET/POST | List/create private sessions |
| `/api/style/sessions/:id` | GET/DELETE | Resume/delete one session and its assets |
| `.../generate` | POST | Request structured outfits; NDJSON supports persisted starter draft, result and error events |
| `.../edit` | POST | Revision-checked Canvas action |
| `.../select` | POST | Select a generated look |
| `.../freeze` | POST | Create immutable snapshot |
| `.../fork` | POST | Edit a copy of a frozen design |
| `.../feedback` | POST | Record explicit feedback |
| `.../reference` | POST | Consent-based reference detection and faithful image crops |
| `.../preview` | POST | Render a frozen version using a consented personal photo |
| `.../preview/:jobId` | DELETE | Cancel/invalidate or delete a preview result |

Mutation bodies include a unique `requestId`, and Canvas mutations include `revision`. Preview bodies use `jobId`, `designId`, `photo`, `consent` and `costAccepted`. Committed mutation retries do not apply twice; active generation reservations prevent duplicate simultaneous text requests. Gemini previews bind to one frozen revision and hashed photo version. Image references are data URLs only; no server fetches of arbitrary user-supplied URLs.

## Remaining release work (do not call P0 complete yet)

- Verify a live Gemini render, garment fidelity and the specified on-self quality cohort using consented photos. An adapter fixture test is not evidence of personal-preview accuracy.
- Measure the 100-brief quality cohort and cold/warm p50/p95 targets; validate budget handling when actual product evidence becomes available. Conceptual suggestions have no verified prices.
- Connect Claude's canonical My Wardrobe records and lifecycle events and test actual signed-in cross-device storage. The legacy browser adapter does not prove the new wardrobe integration.
- Add scheduled expiry cleanup, disconnect cancellation across workers and provider-aware durable background execution for stronger resumability. Current preview requests remain awaited within the server invocation; interrupted jobs expose a retryable failure. Deletion aborts a locally running render; cross-worker invalidation prevents its result being saved.
- Complete deeper hard-constraint coverage for materials, coverage and nuanced natural-language exclusions. Current explicit exclusion matching is conservative phrase matching plus model instructions.
- Confirm the preference-memory UX with users; explicit mode, aesthetic, exclusions and budget memory is implemented separately from session-specific place/weather.
- Complete broader reduced-motion/screen-reader and dark-theme verification. Mobile rendering at 390×844, garment selection/replacement, pins, freezing and save/resume were visually verified; late responses and revision conflicts have automated coverage.
- P1/P2 features remain as prioritized in the PRD: verified commerce, inspiration recreation, planning/wear, community, longitudinal learning and recaps.

## Verification record

- `npm run check` passes; full suite: 169 passed, 2 existing skips, 0 failures.
- Live OpenRouter office styling succeeded after bounding reasoning; the initial request timed out and prompted explicit timeout recovery and starter streaming.
- The Gemini adapter passes injected image-input/output tests. A live test used only a synthetic mannequin fixture (no user photo) and was rejected with HTTP 429. No actual on-self render or fidelity gate is claimed.
- Browser inspection verified Montserrat, no horizontal overflow at 390×844, real AI outfit cards, embedded Canvas, replacement, pins, immutable freeze and saved-session recovery. [Mobile view](screenshots/style-me-mobile.png).
- Production credentials, strict timed erasure, the real My Wardrobe adapter, the 100-brief evaluation and consented preview quality cohort remain unverified.
