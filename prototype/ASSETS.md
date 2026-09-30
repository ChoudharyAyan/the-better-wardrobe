# Asset provenance

Assets support this local design walkthrough. Product photos and prices are illustrative and do not assert live stock or merchant affiliations.

## Generated garment images

`outfit.png`, `cream.png`, and `trousers.png` were generated for this prototype with the image generation tool. They depict a flatlay and isolated garments, with no real model or retailer product identity.

## Reference product photography

- `tee.jpg`: Mockupbee, Unsplash — https://unsplash.com/photos/4rUYuwJ2vGw
- `sunglasses.jpg`: Foto Bakirkoy, Unsplash — https://unsplash.com/photos/GVphCM2cvBc
- `sneaker.jpg`: The DK Photography, Unsplash — https://unsplash.com/photos/NUoPWImmjCU
- `belt.jpg`: seeetz, Unsplash — https://unsplash.com/photos/eNEa7Gsfzzs
- `denim.jpg`: Pure Blue Japan product reference — https://www.pbj-denim.jp/SHOP/GRE-019.html. Reuse permission has not been verified; replace or obtain permission before any public deployment.

Other image files left from earlier draft exploration are not referenced by the current interface.

## Fonts

The active interface uses locally bundled Montserrat at weights 400–800, as required by `Design Docs New/01-design-system.md`. Older Cormorant Garamond and DM Sans files remain from previous mockups but are not referenced by the current app.

## Store identity icons

The mall uses 94 locally bundled public storefront icons as identification marks, not as evidence of a partnership. `dist/assets/brand-icons/sources.json` records each store URL and the icon source captured during the 30 September 2026 import. `scripts/fetch-brand-icons.mjs` and `scripts/fetch-missing-brand-icons.mjs` document the acquisition process. Six stores had no identifiable icon at the checked sources; their sign uses a letter fallback rather than a fabricated logo. These are site icons, not a complete set of approved brand wordmarks or typefaces. Trademarks remain with their respective owners and should be reviewed before a public campaign.
