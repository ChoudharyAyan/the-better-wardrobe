# Order import extension (local development only)

Runs the store connectors inside your own signed-in browser tabs and sends
**product fields only** (name, brand, size, photo, date, status) to The Better
Wardrobe running on this computer. It's the desktop stand-in for the native
app's in-app browser, which will reuse `connectors.js` unchanged.

## Try it

1. Start the app with connectors on:
   `cd prototype && ORDER_CONNECTORS=true PORT=5190 HOST=127.0.0.1 node server.mjs`
2. Chrome → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose `prototype/extension`.
3. Sign in to the store in the same Chrome profile.
4. Click the extension → **Import** next to the store. A tab opens, reads your orders and closes.
5. In the app: My Wardrobe → Add → tap the store chip → review and save.

## Stores

| Store | How it reads | Status |
|---|---|---|
| Myntra | Order data embedded in `/my/orders?p=N` | Verified on a real account (111 lines) |
| Flipkart | `rome.api` order list with the page's session | Verified (8 orders; refunds skipped, replacements kept) |
| Slikk | Observes the page's own `/user/order` responses (`observer.js`) | Verified (5 orders) |
| AJIO | `POST /api/my-account/get-user-orders/…` with the session cookie | Unverified: endpoint answers, but the test account had no orders |
| Tata CLiQ | Observes `orderhistorylist_V2` while stepping the period filter | Unverified: no orders to test |
| Nykaa Fashion | Observes `/fe-api/omsApis/v2/orders` | Unverified: no orders to test |

Unverified stores go through a shape-based reader (`normalizeGeneric` in
`dist/order-import.js`) and show a "check the name and category" note on each piece.

## Rules the connectors follow

- Never read, store or replay login tokens or cookies. Use the page's own session, or observe responses the page already received.
- Keep only product fields inside the store tab; addresses, payments, phone numbers and IDs never leave it.
- The server accepts batches only with `ORDER_CONNECTORS=true`, only on localhost, and never on Vercel.
