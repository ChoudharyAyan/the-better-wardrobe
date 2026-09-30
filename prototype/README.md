# The Better Wardrobe — local walkthrough

A mobile-first, interactive prototype. The current UI follows `Design Docs New/`: Montserrat, warm neutrals, rose accents and a physical almirah for the wardrobe.

## Run

From this directory, run `npm run local`, then visit http://127.0.0.1:5173/. This starts the project-local Ollama service when needed and then starts the website. The server listens on this computer only. Stop with Ctrl+C.

The local testing setup uses `qwen3-vl:2b` through Ollama for garment analysis and visual scoring. It has no LLM request quota and does not send the crop to an LLM provider. The model and Ollama binaries live in the project-level `.local-models/` and `.local-tools/` folders.

Discover uses `DISCOVERY_DATA_MODE=auto`: the first exact crop and search combination calls the configured search providers and records a successful final result in `.local-data/discovery-replays.json`. Repeating the exact input replays that result without spending SerpApi calls. Set the mode to `live` to bypass recordings, or `replay` to prohibit all new provider searches. Gemini remains configured as an optional benchmark and can be selected with `VISION_PROVIDER=gemini`.

## Suggested walkthrough

1. **Discover:** choose an example look or upload a photo. Pick a garment, inspect sample India/global matches, and save inspiration.
2. **My Wardrobe:** add photos, review names and categories, then save items. Try filters, search and editing. Saved inspiration stays separate from owned pieces until you confirm ownership.
3. **Style Me:** choose an occasion, swap or keep pieces, undo a change, and save a look. Review the missing pieces or switch to owned items only. Log a wear for a fully owned outfit.
4. **Insights:** switch between Frugal, Splurge, YOLO and Custom modes. Select an item, edit its purchase price, add wear logs or condition reviews, and see the calculations change.

Use **Local preview 01** in the header to open the guide or reset sample data. Start with five owned items; the sample cream shirt and denim are additions to explore.

## What works

Navigation across seven screens, local photo previews, editable import review, wardrobe categories and search, saved inspiration, ownership confirmation, outfit swaps/undo/keep, saved looks, wear logging, condition reviews, metric selection and calculations from local records.

Wardrobe edits are saved in this browser’s local storage. Personal styling reference photos are session-only. No accounts or server database are connected. Clearing browser data removes local records. Large uploads can exceed browser storage; a visible warning appears if saving fails.

## Discover live integration

Uploaded screenshots now enter the real Discover integration: crop, optional AI description, attribute edits, shopping search and saved finds. Provider keys are required; missing configuration is explicitly shown. See [DISCOVERY.md](DISCOVERY.md) for setup, implemented ranking and verification limits. Reference examples still use sample matches.

Below screenshot search, Discover has an **Explore the mall** experience and a **Find it through people** community preview. The mall arranges 100 links from the owner-provided `DISCOVER-INDIA-SOURCE-SHORTLIST.md` into nine districts, shopping lanes, and storefronts. A small avatar walks to the selected district, lane, or store; unique visits are kept on this device. The complete store list is also available as a collapsed, accessible directory. This is a research shortlist, not a live arrivals feed or an audited seller list. The community preview supports example threads, local questions and answers, helpful votes, and local reputation points. It is saved in this browser only: other users cannot see or answer posts yet, and points cannot be redeemed for merchandise. Shared community accounts, moderation, reward rules and live drop ingestion need a separate backend.

## What is illustrated

The reference collections use clearly labelled sample results. Uploaded screenshot discovery has provider adapters, but live provider verification awaits credentials. Natural-language styling, social imports, virtual try-on and shopping checkout are not connected. Style Me displays an outfit board, not a rendered try-on. Retailer handoffs are demonstrations. A personal reference photo stays unchanged.

## Validation

Run `npm run check` for syntax checks and `npm test` for state, flow, HTTP and Discover checks. These cover screen rendering, asset references, ownership separation, import edits, outfit changes, wear/review calculations, empty states, escaped user text, storage failures, mall navigation, local community posts and helpful votes.

Browser automation was unavailable because the browser security check could not be verified. Full browser visual and interaction QA remains pending; the checks above are code-level checks, not end-to-end browser tests.

## Reference files

- `/Users/ayanchoudhary/Downloads/PRODUCT.md`
- `/Users/ayanchoudhary/Downloads/Design system overview, seven screens.zip`
- Extracted reference: `../mockup-reference/Better Wardrobe - Screens v2 Atelier.dc.html`

Reference files are preserved. The archive’s support.js is not included or executed. See ASSETS.md for media provenance. This prototype has no deployment, staging infrastructure or production integrations.
## Developer observability

Set `DEVELOPER_DASHBOARD=true` in `.env` and restart the local app. A **Developer** tab appears at `http://localhost:5173/#developer` with provider timings, failures, retry attempts, cache/replay usage, and sanitized search history. The endpoint is available only through localhost and never returns API keys, uploaded images, or product URLs. Set the flag to `false` before sharing a build to remove the tab and return 404 from its endpoint.
