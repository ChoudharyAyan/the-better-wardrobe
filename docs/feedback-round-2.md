# Feedback round 2: build plan and handoff (15 Oct 2026)

Written by Claude Code for whichever agent continues (the owner is switching
to Codex when Claude's quota runs out). Each item says what to build, where,
and what is already known. Tick items off in `HANDOFF.md` as PRs land.
Branch in progress: `claude/feedback-round-2` (see "Status" per item).

## Context: what shipped just before this round

- **#41 Discover feedback:**
  - Calmer Discover home.
  - Ask Bao as one bounded screen (`proContent()` and `fitAsk()` in
    `dist/discover-conversation.js`, `.dc-pro*` styles at the end of
    `dist/sticker-studio.css`).
  - The Gemini-style growing composer.
  - Fast / Balanced / Thinking modes (`MODELS` in `lib/discovery.mjs`, each
    with an OpenAI fallback through OpenRouter).
- **#39 / #40:** a kawaii T-shirt mark everywhere (app, website, Android icon).
- **#37:** cutouts via Gemini box + SAM 2.1 on the server
  (`lib/garment-sam.mjs`), with Nano Banana (`studio`) as the fallback.
- **#36:** `GEMINI_BACKEND=vertex`. Production uses Vertex AI with the
  owner's key, billed to Google Cloud credits.
- **#38:** "Paste a product link" removed from the add screen. Stores refuse
  server fetches; the API route remains.

## Owner's requests (direct)

1. **Remove "How I searched"** from Ask Bao results.
   - `renderRetrieval()` in `dist/discover-conversation.js`; it is used inside
     `renderResults()`.
   - Tests in `tests/discover-conversation.test.mjs` assert
     `How I searched · 3 searches · 4.2s`; change them to assert it is absent.
2. **Make the mode picker obvious.** Today it is a small "Balanced ▾" pill in
   the Ask Bao header (`renderModes()`), and the owner says it is not visible
   enough.
   - Plan: a 3-way segmented control (Fast | Balanced | Thinking) as its own
     row directly above the composer, inside the panel, with the cost under
     each label.
   - Keep `data-conversation="pick-model"` so the existing tests and handlers
     still work.
3. **Cart under My Profile.** Anything shown in Discover (Ask Bao results,
   Mall new arrivals and offers) gets an "Add to cart" button; My Profile shows
   "My cart" with items, total, remove, and "Open at store".
   - Plan: a small module `dist/cart.js` with `window.TBWCart` = add, remove,
     list, count, plus a `cart-change` event.
   - Storage: localStorage key `tbw-cart-v1` (wrap reads and writes in
     try/catch). An item is
     `{id, title, image, price, currency, url, store, source:'ask'|'mall-new'|'mall-offer', addedAt}`.
   - Render a `cartCard()` in the `profile` route of `dist/app.js`, after
     `progressCard()`.
   - Show a count badge on the My Profile tab.
   - Per-device for now; account sync is a later step (note this in the UI
     copy: "Saved on this device").
4. **Mall and Community in the Ask Bao framework.** Same calm style as
   `.dc-pro`: a slim header row (small friend face, title, one-line
   subtitle), 1px borders, no comic speech bubble (`StickerStudio.mallIntro()`
   and `communityIntro()` render the "KITSU SAYS" / "MISO SAYS" bubbles).
   - Community: visual treatment only. The owner said "no change required for
     the community section", so keep its features.

## User feedback (from WhatsApp screenshots the owner forwarded)

5. **Tapping a suggestion should start the search** (no Enter needed). Applies
   to the Ask Bao suggestions (`data-conversation="prompt"`) and the trending
   looks (`data-conversation="look"`).
   - Today the look card only fills the draft. The test "Sticker Studio
     trending cards fill the draft and only search on explicit submission"
     enforces that.
   - Change the test: tapping now searches. It spends credits, so the
     tap-to-search is the user's explicit action.
6. **Signed-out users are treated as male.** Add a "For: All · Women · Men"
   filter at the top of Ask Bao.
   - Server: `server.mjs` around line 248 deletes `body.department` and sets
     it only from the signed-in profile (`departmentFor`).
   - Plan: accept `body.audience` in `{'womenswear','menswear',''}` from the
     client and, when set, use it as the department (it is the person's own
     explicit choice). Otherwise fall back to the profile.
   - Client: remember the choice in localStorage `tbw-audience`, send it with
     `interpret`, and show it in the header.
   - Also check the results: a search returned "Junior Boys" items; consider
     dropping kids' items unless asked.
7. **Back from a store page should return to the app.** Result links use
   `target="_blank"`.
   - On iOS Safari (the user's phone) that opens a new tab, and Back does not
     return.
   - Plan, web: open in the same tab, and before leaving save the
     conversation (`state.messages`, `current`, `results`) to `sessionStorage`
     (`tbw-ask-restore`). On load at `#discover/ask`, restore it so Back shows
     the results again.
   - Plan, Android app (Capacitor): open with `@capacitor/browser`
     (`Browser.open({url})`, already a dependency, used by `dist/native-auth.js`).
     It is a Custom Tab with its own close button, and Back returns to the app.
8. **"I don't understand the Mall; how is it different from Myntra?"**
   (owner's answer: make it useful).
   - **(a) A daily refresh that actually publishes.** See "Mall refresh" below.
   - **(b) "Today in the Mall" at the top of the Mall:** at least 5–6 new
     arrivals and 5–6 current offers (with % off) across stores, each with
     Add to cart (item 3) and Open at store.
     - Data: `GET /api/mall/updates` (server.mjs ~line 52) returns the feed
       `{generatedAt, brands:{[id]:{status, designs[], offers[]}}}`.
     - Offers have `price`, `originalPrice` and `discountPercent`. Designs have
       `isNew` and `firstSeenAt`.
     - Pick the newest `designs` and the biggest `offers`, varied across
       brands (at most 1 per brand).
9. **Community:** the user liked it. No functional change.

## Mall refresh: root cause and plan

- **Today:** `.github/workflows/refresh-mall.yml` runs 4 times a day and the
  crawl works (100 stores; on 14 Oct about 36 had designs or offers). Every
  run then **fails at the last step** with "GitHub Actions is not permitted to
  create or approve pull requests". The repo setting
  `can_approve_pull_request_reviews:false` and default permissions are
  `read`.
- **Result:** the feed in `dist/assets/mall-updates.json` is frozen at
  2026-10-05. Even when it worked, it only published after someone merged
  the PR by hand.
- **Plan (no human in the loop):**
  - Store the feed in Postgres (production has `POSTGRES_URL`; Neon). Copy the
    `postgresStore` pattern from `lib/chats.mjs` or `lib/inbox.mjs`, as one row
    keyed `mall-feed` with a JSON value.
  - Add `GET /api/mall/refresh`, allowed only with
    `Authorization: Bearer ${CRON_SECRET}` (Vercel sends this header to
    crons when the `CRON_SECRET` env var exists).
    - It runs `refreshMall()` from `lib/mall-feed.mjs` over the brands due
      (`checkedAt` older than 20 h), within a time budget of about 240 s
      (`maxDuration` is 300), with concurrency 6.
    - Save after each brand so a timeout keeps progress.
  - Add `crons` to `prototype/vercel.json`. Two daily entries an hour apart
    let the second finish what the first could not, e.g.
    `{"path":"/api/mall/refresh","schedule":"30 21 * * *"}` and
    `"30 22 * * *"` (03:00 and 04:00 IST).
  - `/api/mall/updates` should read the DB feed first, then fall back to the
    bundled snapshot.
  - Create `CRON_SECRET` in Vercel production as a random value and never
    print it. Remove the `schedule` from `refresh-mall.yml` (keep
    `workflow_dispatch`) so it stops failing four times a day.
  - The crawler respects robots.txt and identifies itself
    (`BetterWardrobeMallBot`); keep that.

## Environment and accounts (state on 15 Oct 2026)

- **Vercel production env:**
  - `GEMINI_BACKEND=vertex`, and `GEMINI_API_KEY` = the owner's
    service-account-bound key (Gemini API + Agent Platform API allowed).
  - `OPENROUTER_API_KEY` drives Ask Bao's modes; `OPENAI_API_KEY` and
    `SERPAPI_API_KEY` are also set; `DISCOVERY_DATA_MODE=auto`.
- **SerpApi:** the free plan, about 60 searches left this month. Each Ask Bao
  search uses about 2–4. The owner should upgrade before user testing.
- **Old Gemini key "API key 1"** in project Teardown Labs
  (`fieldnotes-ayan-2026-1008`): rotated to "New API key 1".
  - Deleting the old one needs the owner to type DELETE in the Cloud console.
    The safety classifier blocks an agent from doing it.
- **Phone (Pixel 10a):** the production app (`~/Downloads/TheWardrobeOS.apk`,
  loads https://app.thewardrobeos.com) is installed.
  - The owner must reset the screen timeout. An agent set it to 30 min by
    mistake; the original value is unknown.
- **Local test loop:**
  - Run `PORT=5311 HOST=127.0.0.1 node server.mjs` in `prototype/`; it reads
    the gitignored `prototype/.env`.
  - Then, on the phone: `adb reverse tcp:5311 tcp:5311` and a debug build with
    `server.url=http://localhost:5311` (edit
    `mobile/android/app/src/main/assets/capacitor.config.json` after
    `npx cap sync`).
  - Reinstall `~/Downloads/TheWardrobeOS.apk` afterwards.

## Status at end of Claude's session (15 Oct 2026, ~12:30 IST)

Shipped and live on https://app.thewardrobeos.com:

| PR | What |
|---|---|
| #43 | No "How I searched"; tap-to-search on suggestions and trending looks; Fast/Balanced/Thinking switch above the composer (`renderModeBar`); For: All · Women · Men (`renderAudience`, `body.audience` → `audienceLocked`) |
| #44 | Cart (`dist/cart.js`, `TBWCart`), "My cart" at the top of My Profile, count badge on the tab; Back from a store restores Ask Bao (web: same tab + `sessionStorage` `tbw-ask-restore`; Android: in-app browser tab in `dist/native-auth.js`) |
| #45 | Mall daily refresh: Vercel cron → `/api/mall/refresh` (Bearer `CRON_SECRET`) → Postgres `tbw_mall_feed`; `GET /api/mall/today`; "Today in the Mall" strips with + Cart; calm Mall header; GitHub schedule removed |

Production check: the first manual refresh covered 100/100 stores in 100 s;
Today had 4 offers and 6 new arrivals.

## Next, in priority order

1. **Community visual pass (item 4, second half).** Replace Miso's speech
   bubble (`StickerStudio.communityIntro()`, used by the `discover/community`
   route in `dist/app.js`) with the same calm header as the Mall
   (`.mall-pro-head`). The owner said no functional change for Community.
2. **More verified offers.** Only stores whose pages expose a compare-at
   price count. `crawlBrand()` in `lib/mall-feed.mjs` looks at 4 candidates
   per section; raising it to 8 and adding sale-section URLs to
   `VERIFIED_SECTIONS` would surface more. Never show an unverified discount.
3. **Check on the Android phone:** the in-app browser tab for store links
   (`dist/native-auth.js`) and the cart badge. They were only verified in
   headless Chromium.
4. **Cart sync for signed-in users** (today it is per device). Add a small
   account-keyed table like `tbw_discover_chats` in `lib/chats.mjs`.
5. **Kids' results for adult searches** ("Junior Boys" showed up). Consider
   filtering kids' items in `lib/discovery.mjs` unless the words ask for kids.

## Owner to-dos (not code)

- **SerpApi:** the free plan has about 55 searches left this month, and each
  Ask Bao search uses 2–4. Upgrade before more user testing.
- **Delete the old Gemini key "API key 1"** in Google Cloud project Teardown
  Labs. It was rotated, but deletion needs you to type DELETE in the console.
- **Pixel screen timeout:** an agent set it to 30 min by mistake. Set it back
  in Settings → Display.

## Round 3 (15 Oct 2026, afternoon): owner feedback and status

| Ask | Status |
|---|---|
| Ask Bao felt "stuck": the whole screen should scroll once you search | done (#47). Before the first question the panel fits one screen. After it, `.dc-flow`: the page scrolls and the composer is sticky above the tabs (`fitAsk()` returns early once there are messages). |
| Modes always shown | done (#47). Folded behind a `Balanced ▾` chip in the composer (`modes-toggle`); picking a mode folds it again. |
| Placeholder text in every text box looks random | done (#47). One global `::placeholder` rule at the end of `dist/sticker-studio.css`: 14px, weight 500, #9A8C93. |
| "Today in the Mall" full screen, endless, Pinterest-style, "On offer" and "Curated designs for <name>", Men/Women | done (#47). `GET /api/mall/board?kind=offers\|curated&audience=&page=` (`mallBoard()` and `audienceOf()` in `lib/mall-store.mjs`). The overlay `#mall-board` is in `dist/discover-mall.js`: masonry columns, a sentinel loads 24 more, + Cart on every pin, and Men/Women shares `tbw-audience` with Ask Bao. Curated is a fixed daily order that alternates stores. When the pool runs out it says so honestly; the pool grows with the daily crawl. |
| My Wardrobe, Style Me and My Profile in the same professional + kawaii style, "like a proper B2C marketplace app" | done (#48), first pass: `#main[data-area]` is set per tab in `dist/app.js`; one block of shared rules at the end of `dist/sticker-studio.css`: 26px titles, 1px-border cards with no 3D shadows, a white level card with a plum bar, Style Me's tabs as a segmented control, and Bao's wardrobe bubble replaced by a quiet line with a small face (`.pro-sub`). Seen at 412px only. Possible next polish: the import store chips, Style Me's buddy area and the onboarding card. |

### Spec for the next step: the uniform pass on My Wardrobe, Style Me and My Profile

Use the Ask Bao and Mall vocabulary already in `dist/sticker-studio.css`:
`.dc-pro-head` / `.mall-pro-head` headers, white cards with a 1px
`var(--ss-line)` border and 18–22px radius, one plum accent, 11px uppercase
section labels (`.dc-pro-label`), small friend faces (`StickerStudio.friend`)
instead of speech bubbles (`guide()`), and no tilted tags or wobble.

- **My Wardrobe** (`dist/app.js` `wardrobe` route + `dist/wardrobe.css`):
  - the header becomes a slim row (title, piece count, Add);
  - the import card and the Your photos card become plain white cards;
  - the almirah stays as the cute element.
- **Style Me** (`dist/style-me/style-me.css`, `.sm-*`):
  - the same header row;
  - the tabs become a segmented control like `.dc-pro-modebar`;
  - the composer reuses `.dc-pro-composer` styling.
- **My Profile:**
  - cart first (done);
  - the progress and badges card in the same card style;
  - the onboarding and credits cards aligned.
- Check each at 412px and 1280px, and keep `npm test` green; many tests
  match on these routes' text.

- **15 Oct, #49:** the almirah rails scroll sideways again. `.almirah.interior` is a grid; without `grid-template-columns:minmax(0,1fr)` and `min-width:0` on its children, the column grew to the full width of the clothes, so the rails never overflowed and could not be swiped (`dist/styles.css`).
