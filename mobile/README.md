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

## Build (Android)

The Android project is generated and committed in `android/`. Android Studio is optional: the
command-line SDK is enough (this Mac uses JDK 21 in `~/Library/Java/JavaVirtualMachines` and the SDK
in `~/Library/Android/sdk`, with `platform-tools`, `platforms;android-36` and `build-tools;36.0.0`).

```sh
cd mobile
npm install
export JAVA_HOME=$(ls -d ~/Library/Java/JavaVirtualMachines/jdk-21*/Contents/Home | head -1)
export ANDROID_HOME=~/Library/Android/sdk
npx cap sync android                      # after plugin or config changes
(cd android && ./gradlew assembleDebug)   # → android/app/build/outputs/apk/debug/app-debug.apk
$ANDROID_HOME/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone: turn on Developer options → USB debugging, plug it in, accept the prompt, then
run the `adb install` line. `adb logcat | grep -i -E "capacitor|chromium"` shows the app's logs, and
`chrome://inspect` on the Mac attaches DevTools to the app's WebView in debug builds.

Web changes need no app release: they ship with the Vercel deploy. The icon and splash come from
the brand mark: `node scripts/make-icons.mjs`. iOS (`npm run ios`) needs Xcode and is not set up yet.

## Google sign-in in the app

Google refuses sign-in inside an app's WebView, so `prototype/dist/native-auth.js` opens it in a
Chrome Custom Tab (`@capacitor/browser`). The server finishes the OAuth flow there and returns to the
app through `com.thewardrobeos.app://auth?code=…` (intent filter in `AndroidManifest.xml`). The
code is signed, lasts two minutes and only works with a verifier that never leaves the app's
WebView (`POST /api/auth/app-exchange`), so another app catching the link gets nothing.

## Not verified yet

The bridge is covered by a unit test with a fake plugin (`prototype/tests/wardrobe.test.mjs`).
It has not been run on a real phone against real store accounts: the native projects are not
generated in this repo yet, and each store's sign-in page may behave differently inside an
in-app browser. Test in priority order: Myntra, Flipkart, Amazon, AJIO, Nykaa Fashion, Meesho.
