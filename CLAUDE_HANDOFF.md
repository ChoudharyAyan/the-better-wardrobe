> Historical (1 Oct 2026). Superseded by "Current state" at the top of [HANDOFF.md](HANDOFF.md).

# Claude Code handoff — 2026-09-30

## Start here
The owner authorized merging [PR #4](https://github.com/ChoudharyAyan/the-better-wardrobe/pull/4), Style Me persona onboarding and selected-photo import foundation. Read `AGENTS.md`, then `prototype/PERSONA-HANDOFF.md` for implementation, API feasibility sources, setup and limitations. The latter is the detailed technical handoff for this work; older roadmap entries in `HANDOFF.md` may be stale.

Fetch origin and verify PR #4 is on main. Inspect local changes before switching branches; pull main when safe and create a new `claude/<task>` branch for follow-up. Never discard another agent's or the owner's local changes.

## What landed
- Navigation (since 2026-10-01): Discover is the default tab, followed by My Wardrobe, Style Me and My Profile.
- Four option-based conversation steps: current style, occasion, priority, Target Persona; six style directions and edit/back controls.
- Preferences persist in localStorage; Profile supports deletion. This is deterministic onboarding, not a live LLM chatbot.
- Device photos and Google Photos Picker adapter provide temporary references. Photos are not yet analysed or imported into owned wardrobe items.
- Existing outfit demo remains at `#style/outfits`; Insights shows Coming soon.

## What to do next
1. Verify mouse and touch controls in a normal browser and on a phone. Keyboard walkthrough passed, but pointer automation in Codex's browser did not activate even navigation links. Root cause remains unconfirmed; do not assume this was only a tool issue.
2. Complete live Google Photos OAuth setup and QA. Set `GOOGLE_PHOTOS_CLIENT_ID`, enable Picker API, register the exact origin and a consent test user. This is an OAuth client ID, not a Gemini key. See detailed handoff for steps.
3. Test cancelled/denied sign-in, expired sessions, repeated connection, cancellation while collecting images, and mobile return from the external picker. Harden race/timeout handling before production.
4. Integrate explicit persona preferences into real outfit recommendations. Current outfit board still uses preset demo looks; optional notes are not interpreted.
5. Only then add consent-based photo interpretation with explicit subject and ownership confirmation. Do not infer ownership from a group photo.

## Connector boundaries
Google Photos uses explicit user selection, not silent full-library access. Instagram personal account import is not supported by the official professional API. A Business/Creator connector remains future work. Do not fake a connected state or use a scraping workaround without separately evaluating it with the owner.

## Validation baseline
Implementation commit `aad8ba0`: 50 tests pass; syntax checks and GitHub CI passed. Browser keyboard completion, Target Persona, reload persistence and missing-config fallback were checked. No live Google account import was tested, and no paid LLM/SerpApi calls were made. Re-run `cd prototype && npm run check && npm test` after changes.

## Local checkout caution
At handoff, the working tree contained an unrelated deletion of `CONVERSATIONAL_FLOW.md` and an untracked `CONVERSATIONAL_FLOW - GenZ.md`. These were left untouched and are not part of PR #4. Preserve them; do not reset or clean the checkout blindly.

## Preview
Start from `prototype/` with `PORT=5190 HOST=127.0.0.1 node server.mjs`, then visit http://127.0.0.1:5190/. A previous preview process may have stopped; check before assuming it is live. Use a configured HTTPS origin for phone OAuth testing. Tokens/photos are memory-only; refresh removes references. No secrets belong in Git.
