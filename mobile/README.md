# The Wardrobe OS phone app (Capacitor)

A thin native shell around the live web app (`server.url` = https://app.thewardrobeos.com), so a
web deploy updates the phone app too. It exists for one reason the web cannot match: **store
order imports** (My Wardrobe PRD FR#3 and FR#5).

## How a store import works

1. In My Wardrobe, the person taps a store chip (Myntra first; then Flipkart, Amazon, AJIO,
   Nykaa Fashion, Meesho).
2. `prototype/dist/native-import.js` opens the store's own order page in
   [`@capgo/inappbrowser`](https://github.com/Cap-go/capacitor-inappbrowser). The person signs in
   there as usual; the app never sees the password or the store's cookies.
3. A bar at the bottom of the store page says "Import my orders". Tapping it runs the same
   `extract()` the browser extension uses (`prototype/dist/store-connectors.js`, an exact copy of
   `prototype/extension/connectors.js`, checked by a test). Only product fields come back.
4. Myntra pages are read four at a time and each page is sent to the app as it lands, so the
   review queue fills while the rest load. The browser closes itself when the import is done.

Stores without a connector yet (Amazon, Meesho) fall back to Amazon's order file and order
screenshots on both web and phone.

## Build

Needs Node 22+, Android Studio (Android) or Xcode 16+ (iOS).

```sh
cd mobile
npm install
npm run android   # first time: adds the android/ project, syncs, opens Android Studio
npm run ios       # first time: adds the ios/ project, syncs, opens Xcode
```

After the first run, `npx cap sync` is enough when plugins change. Web changes need no app
release: they ship with the Vercel deploy.

## Not verified yet

The bridge is covered by a unit test with a fake plugin (`prototype/tests/wardrobe.test.mjs`).
It has not been run on a real phone against real store accounts: the native projects are not
generated in this repo yet, and each store's sign-in page may behave differently inside an
in-app browser. Test in priority order: Myntra, Flipkart, Amazon, AJIO, Nykaa Fashion, Meesho.
