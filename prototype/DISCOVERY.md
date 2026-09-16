# Current workflow

See [DISCOVERY-WORKFLOW.md](DISCOVERY-WORKFLOW.md) for v2 matching, progress and scoring. The earlier implementation notes below are retained as history and are superseded where they differ.

# Discover: first live integration

## Enable the providers

The owner must put their own credentials in `.env` (outside `dist`, ignored by git):

- `GEMINI_API_KEY`: Google AI Studio key from a Free Tier project with billing disabled.
- `SERPAPI_API_KEY`: SerpApi account key with Lens and Shopping access.
- `PUBLIC_BASE_URL`: active HTTPS ngrok URL pointing at this server. This is required for Lens to fetch the cropped image, not for description-based shopping search.
- `GEMINI_MODEL`: defaults to `gemini-3.5-flash`; change to another image + structured-output compatible model if required by account access.

Never enter provider keys into the public app or paste them into chat. Restart `npm start` after changing `.env`. Open `/api/discover/status` to check configuration booleans; it does not expose keys. A configured key is not proof of valid billing or access.

## Working flow

1. Screenshot remains in-browser; user selects one garment category and adjusts crop with labelled controls.
2. Optional explicit AI analysis sends a resized crop to Gemini generateContent with structured output. User edits colour, fit, pattern and details; uncertain material/brand is not asserted.
3. Explicit search sends description to Shopping and, when public URL is configured, the cropped image to Lens through SerpApi. Results from both routes are interleaved before shortlisting so neither crowds the other out.
4. One broad colour/category search is added only if initial retrieval returns fewer than five candidates.
5. Results are deduplicated. Up to three immersive-product tokens resolve to actual merchant offers. Otherwise the UI labels Google shopping links as listings.
6. Up to six candidate pages are inspected for JSON-LD Product data, only on a bounded retailer allowlist. HTTPS public IPv4 is pinned, redirects rechecked, page size capped and requests timed out. Blocked/unsupported pages remain unverified. Multiple products/offers are not treated as a verified selected variant.
7. Up to eight images receive batched vision comparison against the uploaded crop. Application code combines dimension assessments (visual 35%, fit 25%, colour 20%, pattern 10%, details 10%). Unknown values are omitted; under 60% evidence coverage produces no score. This is an experimental vision-based ranker, **not an embedding implementation or calibrated exact-match probability**. The UI shows qualitative labels and differences.
8. Destination-market results precede global visual leads. Known above-budget local prices and explicitly out-of-stock checked items are excluded. Unknown prices remain visible. Delivery, PIN-code eligibility and selected size are not claimed verified.
9. Up to twelve cards link to source/retailer pages. Save stores the real candidate in the browser’s Saved inspiration shelf, separate from owned pieces.

India, US, UK and UAE share the pipeline with corresponding search localisation and budget currency. A market label means a localised search result, not guaranteed delivery.

## Limits and state

- Maximum two simultaneous operations; default 20 analysis/search operations per server hour, shared by everyone on the ngrok preview. Each search can make multiple provider requests (up to six SerpApi calls and one vision comparison); this is not a currency spending limit. Set provider-side budgets as well.
- Source uploads: JPG/PNG/WebP, existing 10 MB browser limit. Crop resized to at most 1200 pixels; server accepts at most 3 MB decoded crop and 4.5 MB request body.
- Crop tokens use random 192-bit identifiers. Crops are held in server memory, never written to disk; deleted when retrieval completes, and inaccessible after five minutes. Token possession grants temporary access. Provider retention is separate and governed by the provider’s policies; Gemini requests set `store:false`.
- Keys stay server-side. Only `dist/` is served as static content. No account database or production authentication is added.
- Cancelling stops the browser waiting; upstream work already started may finish and incur cost.
- No exact-product identity claims, auto-purchases, PIN/size verification, training or automatic wardrobe ownership.

## Verification

`npm run check` checks syntax. `npm test` runs existing wardrobe flows, injected-provider integration tests and a local HTTP boundary test. The injected-provider tests verify request construction, partial failures, ranking, deduplication, crop cleanup, missing keys, budget filters and merchant resolution without incurring API charges.

Live provider quality/latency/retailer parsing remains unverified until keys are supplied. Full browser visual QA is also pending because browser security verification was unavailable in this workspace. Next validation: 30–50 varied screenshots, top-five relevance, wrong-category rate, valid merchant links, destination availability, latency and actual provider cost. An embedding ranker and category-specific calibrated weights remain future work.

## API references

- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/structured-output
- https://serpapi.com/google-lens-api
- https://serpapi.com/shopping-results
- https://serpapi.com/google-immersive-product-api

Gemini has no paid-provider fallback. A quota response stops the call. Free billing status is controlled by the Google project, not an API parameter: keep billing disabled to meet the ₹0 requirement. No live calls were made during this migration.

## Live smoke test — 16 September 2026

Both configured providers responded successfully. Gemini described the sample cream shirt. SerpApi reported Free Plan. After fixing empty-query fallback and bounded retailer/image retrieval, a full India search returned 12 localised results, four with visual comparison scores, and no pipeline warnings. This is a single smoke test, not a relevance benchmark or delivery verification. All 21 automated checks passed. Browser visual QA remains pending.
