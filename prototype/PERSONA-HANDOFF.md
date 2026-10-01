# Style persona onboarding — implementation and handoff

Source branch: `codex/style-persona-onboarding`. PR: https://github.com/ChoudharyAyan/the-better-wardrobe/pull/4

The owner explicitly authorized merging on 2026-09-30. The remaining validation items below still apply after merge. Check GitHub for the final merge commit.

## Product change
Navigation is Discover → My Wardrobe → Style Me → My Profile (reordered 2026-10-01 to follow the funnel; Discover is the default tab). Style Me opens a four-step option-based conversation: current style, everyday occasion, preference, and Target Persona. Six editable directions are offered, including “Still exploring”. Answers persist in this browser; Profile can edit or delete them. The existing outfit board remains at `#style/outfits`, the almirah and Discover flows remain available. Insights is coming soon.

This is deterministic guided onboarding, not an LLM conversation. Optional notes are stored but not interpreted. Photos are temporary references, not automatically recognised garments or persona inference. The outfit board still contains preset demo looks. Rich animation/mascot work and recommendation integration are deliberately future work.

## Feasibility findings
| Source | Supported approach | This PR |
|---|---|---|
| Google Photos | OAuth + Photos Picker: user explicitly selects media | Configurable picker adapter, bounded selected-photo download, local preview |
| Instagram personal accounts | No supported consumer profile-media API | Clear explanation and device upload alternative |
| Instagram professional accounts | Instagram Login API for Business/Creator accounts; permissions/review required | Not implemented; follow-up connector |
| Device photos | Standard mobile photo picker | Up to six JPEG/PNG/WebP images, 10 MB each |

Google Photos does not provide unrestricted existing-library access through the current Library API. Picker is not a silent album/background sync connector. It must open separately, not in an iframe. Account connection does not establish which person or clothes in a group photo belong to the user: any future extraction needs explicit subject and ownership confirmation.

Official references (reviewed for this change):
- https://developers.google.com/photos/support/updates
- https://developers.google.com/photos/overview/authorization
- https://developers.google.com/photos/picker/guides/sessions
- https://developers.google.com/photos/picker/guides/media-items
- https://developers.google.com/photos/support/api-policy
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

Before production, review Google Photos permitted-use policy for the precise garment extraction / personal styling use case and complete any required OAuth verification. Technical API access is not policy approval. No training or ads use is implemented.

## Google setup / live test prerequisite
1. Enable Google Photos Picker API in a Google Cloud project.
2. Configure the OAuth consent screen and test users, with the Picker scope `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
3. Create a Web application OAuth client. Register exact JavaScript origins (for example `http://localhost:5190` and the eventual HTTPS deployment). Client IDs are public configuration; do not add a client secret to browser code.
4. Set `GOOGLE_PHOTOS_CLIENT_ID` in the server environment and restart. Leave empty to keep device uploads working with a clear connection-not-configured message.
5. Connect, approve the scope, open the picker, select up to six images, return, and press “I’ve selected my photos”. Selection checks respect the returned polling interval. Verify preview, removal, cancel, denied permission, expiry, and mobile return from the picker.

No real Google account was connected during development. No new paid API requests were made. A mobile LAN HTTP address may not be an eligible Google OAuth origin; use localhost on desktop or a configured HTTPS origin for live OAuth.

## Code map and data handling
- `dist/persona.js`: choices, local preference storage, delegated UI actions, ephemeral photo state, Google Identity Services token flow.
- `dist/persona.css`: responsive Montserrat onboarding styles.
- `lib/photos.mjs`: server adapter with injectable fetch, fixed provider endpoint, bearer auth, Google image host allowlist, redirect rejection and image size limits.
- `server.mjs`: `/api/photos/config`, POST `/api/photos/create`, `/collect`, `/delete`; same-origin checks, JSON and body bounds.
- `tests/persona.test.mjs`: preference validation and fixture-based import / expiry / cleanup cases.

Preferences use `tbw-persona-v1` localStorage. Photos and access token live in tab memory only; photos disappear on reload. Google image bytes transit this server to create previews, are not written to disk or included in observability, and are returned with no-store. Cleanup deletes the Picker session after import/cancel; it never deletes library photos. Closing the tab can leave a provider session until its normal expiry. There is no cross-device account storage in this PR.

## Validation and remaining work
Automated check and suite pass without live providers. Browser keyboard walkthrough verified all four steps, Target Persona and unconfigured Google fallback. Pointer automation in the in-app browser did not activate even navigation links; touch/pointer behaviour must be rechecked in a normal browser before production use. Do not describe this as fully mobile-QA approved.

Priority follow-ups for Claude:
1. Live OAuth testing with the owner’s configured client ID and consent; test session timeout and cancellation races while downloads run.
2. Browser/device touch validation and focus/scroll refinement for the chat transcript.
3. Explicit-consent garment-only analysis of chosen references; confirm subject/ownership rather than face identity inference.
4. Feed approved preferences into the styling engine; retain truthful demo labels until implemented.
5. Add professional Instagram connector only after app registration and required review; do not advertise personal account import.
6. Production auth, user-owned persistence, retention/deletion controls and rate limiting before broad deployment.

Run `cd prototype && npm run check && npm test`. Start a separate preview with `PORT=5190 HOST=127.0.0.1 node server.mjs`.
