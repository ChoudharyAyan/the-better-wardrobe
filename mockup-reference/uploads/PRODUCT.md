# The Better Wardrobe — Product Definition

A mobile-first fashion discovery and personal wardrobe app organised into four primary tabs: **Discover**, **My Wardrobe**, **Style Me**, and **Insights**.

This is a living product brief covering Discover, My Wardrobe, Style Me, and Insights. Implementation details and unvalidated ideas are not commitments to working capabilities. Open scope and design decisions are recorded within each section.

## 1. Discover

### Purpose and promise

Turn visual inspiration into shoppable clothing and accessories, connecting the journey from seeing a look to finding something the user can buy.

**Our promise: the exact vibe.** We prioritise similarity in style, colour, silhouette, and overall feeling. We do not promise to identify or sell the exact original item. Screen-worn and celebrity pieces may be custom-made, discontinued, or unavailable online. An exact item is a welcome result when it can be verified, not a prerequisite for a successful discovery.

### The user need

“I saw a look I loved. Help me find clothes or accessories that capture it, and give me useful shopping links—especially options I can buy in India.”

The inspiration can come from any app or source: a film, television show, YouTube video, social post, saved photo, or another image. Users should not need to know the brand, garment terminology, or original source to begin.

### Entry points and priorities

| Input | Intended experience | Priority |
| --- | --- | --- |
| Screenshot or uploaded image | Recognise the visible clothing and accessories, then find similar shoppable products | First release focus |
| Link | Use accessible visual content from a supplied URL as inspiration | Later; supported sources and extraction behaviour to be defined |
| Keywords or natural-language query | Interpret a described item, look, character, or aesthetic and find relevant products | Later |
| Broad cultural reference | Resolve a request such as “Get me one of Brad Pitt’s looks from Meet Joe Black” into a specific visual direction | Later; may require clarification or a choice of looks |

The first release concentrates on **image recognition followed by real product search and shopping links**. Search here means finding existing products on shopping websites, not generating fictional products or store URLs.

### Image-first user journey

1. **Provide inspiration.** The user uploads an image or screenshot, regardless of its original app.
2. **Choose the target.** The app identifies visible clothing and accessories. When multiple items appear, the user can select the relevant item or request the overall look. Recognition should be correctable.
3. **Interpret the look.** The app identifies visible characteristics such as item type, colour, pattern, silhouette, fit, and styling. Unclear details should remain uncertain rather than being invented.
4. **Search broadly.** Search for relevant products beyond India when useful, so discovery is not restricted to domestic inventory.
5. **Find India-focused options.** Prioritise relevant shopping links for India and present the closest local alternatives when the original or strongest global match is unavailable there.
6. **Compare the matches.** Show product imagery, similarity scores, short match explanations, and available shopping information so the user can assess the trade-offs.
7. **Continue to the product.** Let the user open the actual retailer page to inspect the item and purchase it. Cart integrations are a separate future scope decision.

### Global discovery, India-focused shopping

Global search helps establish what best captures the reference. India-focused results make that inspiration actionable for the initial audience.

- Distinguish **global matches** from **India shopping options** in the results.
- Where useful, pair a global reference with its closest India-available alternative.
- Clearly label international products and unknown delivery availability. A globally accessible website does not establish delivery to India.
- Display price, currency, retailer, and size or stock information only when available from the source. Avoid implying that unverified availability is current.
- If no strong India-specific match exists, say so and let the user inspect global options or broaden the search.
- Do not silently replace a strong match with a weak domestic result and present them as equivalent.

### Similarity scores

Each recommended product should communicate how closely it matches the selected item or reference look. The score is a **similarity estimate**, not the probability that the product is the original item.

Matching should consider:

- Garment or accessory category.
- Colour and pattern.
- Silhouette, cut, proportions, and apparent fit.
- Visible texture and design details, where discernible.
- Overall styling and aesthetic—the vibe.

Pair the score with a short explanation, for example: “Similar relaxed silhouette and cream colour; different collar and fabric texture.”

The scoring method, weighting, and calibration remain to be defined and tested. Do not invent precise percentages for a prototype. Keep availability and price separate from visual similarity so users understand why an option is recommended.

The initial comparison is against the uploaded reference or selected item. Compatibility with the user’s owned wardrobe is a separate concept to define with My Wardrobe and Style Me.

### Result experience

Results should help the user reach a useful shopping decision, with each product showing:

- Product image and name.
- Retailer and direct product link.
- Price and currency, when known.
- Global versus India shopping context, including any verified delivery information.
- Similarity estimate and a concise explanation of matches and differences.
- A clear distinction between a similar alternative and a verified exact item.

The experience should support both individual-item discovery and understanding the pieces that make up an overall look. When a result is weak, unavailable, or uncertain, make that visible and offer a useful next step: select a different item, provide a clearer image, or broaden the criteria.

### Personality and visual direction

Discover should feel expressive, playful, and fluent in fashion and pop culture. Animations and aesthetic labels can make recognition and results feel personal, while keeping the uploaded reference and products easy to inspect.

Illustrative aesthetic labels include:

- **Draper-coded:** Don Draper-inspired tailoring and polished styling.
- **Bruce Wayne-coded:** refined, understated, sharply tailored looks.
- **Adam Sandler-coded:** relaxed, oversized casualwear, including baggy denim where it fits the reference.
- **BTS-coded:** selected oversized tees, denim, and accessory-led looks inspired by the reference; not a claim that the group has one fixed style.

These are playful descriptions of the aesthetic, not claims of identity, endorsement, or verified screen-worn provenance. Use them when they fit the actual input, rather than forcing every outfit into a celebrity persona.

Loading animations should describe real stages of the search. They must not imply that a retailer, product, or match has been verified before that happens.

### First-release success criteria

- A user can upload a screenshot and select the clothing or accessory they care about.
- The app returns real product links that meaningfully resemble the reference.
- Users can understand why results match and where they differ.
- India-focused shopping options are clearly distinguished from global results.
- Missing exact matches do not prevent a useful discovery journey.
- Failed searches and uncertain matches are handled honestly.

### Decisions still to make

- Initial supported clothing and accessory categories.
- Product-search providers, retailer coverage, and availability verification.
- Similarity-score presentation and validation.
- Whether full-look shopping ships alongside single-item search or follows it.
- Budget, size, and other refinement controls.
- Supported URL sources and the later natural-language discovery flow.

## 2. My Wardrobe

### Purpose and promise

Give users a clear, visual inventory of the clothing and accessories they already own, with a smooth way to add and update items.

**The core output: “I can see what I have.”** A user should be able to browse their shirts, trousers, belts, and other pieces without opening cupboards or piecing together old photos.

My Wardrobe organises personal items and purchases from across retailers and marketplaces. The app is an aggregation and personal organisation layer, not a marketplace or an e-commerce store. This inventory becomes shared context for discovery, styling, and insights.

### The user need

“My clothes and accessories are scattered across my cupboard, photos, and purchases. Help me bring them into one wardrobe that I can browse, understand, and keep updated.”

Support clothing and accessories across men's and women's wardrobes, with categories suited to the actual items users own.

### Input methods

| Input | Intended experience | Scope |
| --- | --- | --- |
| Selected photo uploads | Start with a small batch of three to five photos; extract individual clothing and accessory items from them | Primary starting flow; exact batch limits to be decided |
| Connected social photos | Explore connecting Instagram first, then other social platforms, to extract items from user-selected, accessible photos through the same review flow | Exploration; access and integration feasibility must be established |
| Confirmed purchases from Discover | Add a discovered product to the wardrobe after the user confirms buying or owning it | Cross-tab flow |

Social connection is an alternative input method, not a prerequisite for building a wardrobe. Do not assume that connecting an account grants access to every photo or that every visible item belongs to the user.

### Photo-to-wardrobe journey

1. **Select photos.** The user uploads a small batch of existing photos containing their clothes and accessories.
2. **Identify separate pieces.** Detect the visible shirts, trousers, belts, and other items within each image. One photo can yield multiple wardrobe candidates.
3. **Create individual representations.** Isolate the pieces into recognisable visuals for the wardrobe interface. Preserve the source image for comparison during review; the exact cutout or illustration treatment will be defined in UI/UX work.
4. **Suggest categories and names.** Prepopulate descriptive names and categorise the items based on visible evidence.
5. **Review and correct.** Let the user confirm which items they own, edit names and categories, reject incorrect detections, and resolve potential repeats across photos before saving.
6. **Place items in the wardrobe.** Present confirmed pieces in their relevant categories using the visual wardrobe experience.
7. **Keep it current.** Make adding more photos, correcting item details, and removing items straightforward as the wardrobe changes.

If an item is partly hidden or cannot be extracted reliably, offer a correction or another photo rather than silently inventing its appearance. Repeated photos of the same garment should not automatically inflate the inventory; possible duplicates need review.

### Names, aliases, and item details

Each item should have an automatically suggested, editable name. Useful descriptions take priority over guessing a brand.

- A visible blue shirt might become **“Blue full-sleeve shirt.”**
- Black chinos might become **“Black chinos.”**
- If a brand is clearly identifiable, suggest a name such as **“USPA khakis”** for user confirmation.
- The user can rename a generic entry to **“Levi's blue full-sleeve shirt”** or use their own alias.
- When brand evidence is absent or uncertain, leave it unspecified. Do not infer a brand from a generic colour, cut, or aesthetic.

The initial item record should support its visual, name or alias, category, visible attributes such as colour, optional brand, and source reference. Details needed for analytics will be defined with Insights; adding an item should not require completing financial data.

### Visual wardrobe and categorisation

The design reference is the way a SolidWorks-style exploded view separates a whole into understandable individual components: an outfit becomes distinct, inspectable pieces arranged in a coherent wardrobe.

This is an interaction and presentation reference, not a requirement to build CAD tools or accurate 3D garment models.

- Organise items into understandable sections such as shirts and tops, trousers and jeans, dresses and skirts, belts, footwear, and other accessories. Final category coverage remains to be defined.
- Let users explore both the overall collection and individual items.
- Use recognisable item visuals so users can identify their own pieces quickly.
- Make browsing, correcting, and adding items easy on a phone.
- Introduce playful animation and gamification around organising and exploring the wardrobe. Specific mechanics, layout, and visual treatment will be decided during UI/UX design.
- Any stylised or generated representation should remain faithful to the actual piece; it should not change identifying details or imply that hidden details were observed.

### Connections to the other tabs

**Discover:** A user-confirmed purchase or owned item can move into My Wardrobe with its available product information and source link. Preserve any useful inspiration or persona context, such as a Draper-coded look, without making that the item's category. A shopping-link click alone does not establish ownership; unpurchased inspiration must remain distinct from owned inventory.

**Style Me:** Use confirmed wardrobe items as the foundation for outfit and occasion recommendations. Recommendations should refer back to the actual pieces the user can browse here.

**Insights:** Use the same inventory as the foundation for usage, spending, and buying-style analysis. Financial and wear data requirements will be specified in the Insights section rather than assumed from a photo.

The wardrobe is a shared source of personal context across the app, not an isolated gallery.

### Success criteria

- A user can start with a few photos and save individually identifiable wardrobe pieces.
- Suggested names and categories reduce manual entry while remaining editable.
- The user can browse what they actually own in a clear, appealing visual collection.
- Incorrect detections and repeated items can be corrected before they distort the inventory.
- Additional items and confirmed purchases can join the same wardrobe without restarting onboarding.
- Confirmed items are available as context for future styling and insights features.

### Decisions still to make

- Initial extraction coverage, upload limits, and handling of difficult photos.
- Cutouts versus stylised illustrations, animation style, and the exploded-view interaction.
- Final category structure, browsing controls, and item detail layout.
- Gamification mechanics that make organising enjoyable.
- Instagram access feasibility, supported photo selection, and later social integrations.
- Duplicate-review behaviour and the exact purchase-confirmation handoff from Discover.

## 3. Style Me

### Purpose and promise

Help users bridge the gap between imagining an outfit and seeing how it could look on them. Style Me is an interactive styling and visualisation playground grounded in the user's wardrobe, with room to explore new clothes and accessories.

**The core journey: “This is what I have. This is how I want to look. Help me get there.”**

The output is a desired look the user can inspect, remix, and act on: which pieces they already own, which additions would complete it, and where those additions can be bought.

### The user need

“I struggle to picture how individual clothes will come together on me. Let me describe an occasion or aesthetic, see the outfit on myself, and try alternatives before deciding what to wear or buy.”

Style Me supports both getting more from existing clothes and discovering additions. It is not limited to outfits that can already be assembled from the user's wardrobe.

### Natural-language styling engine

A headless AI styling and search engine powers the visual interface: it accepts natural-language requests, uses available wardrobe and reference context, and returns outfits and product suggestions that the interface can display and update.

The user-facing experience should combine a search or conversation input, suggested prompts, and an interactive outfit preview. The engine's implementation should not dictate a chat-only interface.

Example requests include:

- “Give me good looks from my wardrobe for a formal setting.”
- “Show me how this beach T-shirt will look on me at the beach for my upcoming Kerala trip.”
- “Style me in baggy jeans and an oversized T-shirt.”
- “Try denim trousers with my white shirt.”
- “This looks good, but add bracelets and a couple of rings.”
- “Keep the black shirt and show me khaki chinos instead.”

Requests can start from an occasion, trip, aesthetic, owned item, newly uploaded piece, or look passed in from Discover. A newly uploaded reference should not automatically be treated as owned.

### User journey

1. **Set the direction.** Describe the desired look or occasion, choose a suggested prompt, or start from a specific piece.
2. **Provide context.** Use items from My Wardrobe, upload additional references, and provide a personal photo when needed for an on-person preview. Exact photo requirements will be defined during implementation and UX work.
3. **Build a candidate outfit.** Compose clothing and accessories that answer the request. Identify which pieces are owned and which are proposed additions.
4. **Visualise the look.** Show a graphical preview on the user when suitable input and supported visualisation capabilities are available. An outfit board may support comparison, but does not replace the intended on-person experience.
5. **Remix conversationally.** Let the user challenge the suggestion, swap individual pieces, add accessories, or change the aesthetic while retaining the parts they like.
6. **Understand the gap.** Explain what is already in the wardrobe and what would need to be acquired to recreate the selected look.
7. **Find the missing pieces.** Offer relevant shopping options and direct product links for proposed additions, prioritising India-focused availability through the discovery search capability.
8. **Continue the wardrobe journey.** After the user confirms buying or owning a suggested item, add it to My Wardrobe for future styling. Merely previewing or clicking a product does not add it as owned.

### The visual playground

Graphics, animation, and playful interaction are central to this tab. The user should feel able to experiment with their appearance, not simply read a list of fashion advice.

- Make the complete outfit and its individual components easy to inspect.
- Allow targeted changes, such as swapping trousers while keeping the shirt, or adding rings without replacing the whole look.
- Keep conversational refinements connected to the current outfit so the user does not need to restate the request after every change.
- Explore setting-aware previews, such as the user's beach outfit in a Kerala-trip context.
- Let users try different combinations and compare their desired direction with the proposed result.
- Use animation and gamification to make experimentation enjoyable; exact mechanics and visual design remain for the UI/UX discussion.

An AI-generated preview is an illustrative approximation of appearance, not proof of physical fit, sizing, fabric behaviour, or exact colour. Preserve recognisable garment details and make the preview's nature clear. If only a generic avatar or outfit board is available, label it accordingly rather than presenting it as a personal try-on.

### Owned items, proposed additions, and the desired look

Every outfit should distinguish its components clearly:

| Component state | Meaning | User action |
| --- | --- | --- |
| Already owned | A confirmed item in My Wardrobe | Use it in the outfit or swap it |
| Reference or unconfirmed item | An uploaded or discovered piece without confirmed ownership | Clarify ownership or find a shopping alternative |
| Suggested addition | A piece recommended to complete the look | Inspect shopping options or request an owned alternative |

For example: “You already have the black shirt and shoes. Add khaki chinos to create this look.” The app then shows suitable chinos and where to buy them.

Keep the visual concept and purchasable product connected. If the preview uses a generic beige shirt, do not imply that an unrelated shopping result is the same garment. Explain meaningful differences between the proposed look and available alternatives.

### Shopping and demand generation

Style Me can create purchase intent by showing how an additional piece improves or completes a look. Recommendations should answer **what to buy, why it works, and where to buy it** in the context of the user's chosen outfit.

- Explore relevant listings from retailers and marketplaces such as Myntra, Flipkart, Amazon, and Meesho. These are target examples, not confirmed integrations or guarantees of inventory access.
- Use real product links and source-backed prices and availability when available.
- Reuse Discover's India-focused product search and global-alternative behaviour where appropriate.
- Make it possible to complete a look using owned items when they satisfy the request; do not require a purchase for every styling session.
- Keep shopping choices alongside the styling experience so users can understand the outfit before following a retailer link.

The app remains an aggregation and styling layer. The shopping handoff does not imply that the app operates a marketplace or provides universal checkout.

### Connections to the other tabs

**My Wardrobe:** Supplies confirmed personal inventory and receives user-confirmed additions. Styling should reference the actual item records, rather than inventing pieces the user supposedly owns.

**Discover:** Supplies inspiration and shopping candidates. Style Me adds personal context: how a discovered piece could work on the user and with the rest of their outfit.

**Insights:** Can later inform suggestions using buying preferences, spending modes, and usage history once those requirements are defined. Do not infer those preferences from appearance alone.

### Success criteria

- A user can describe an occasion or aesthetic and receive a relevant outfit grounded in available context.
- The visual experience helps the user perceive how the proposed combination could look on them.
- The user can refine individual pieces through conversation or visual controls without restarting.
- Owned items and proposed purchases are clearly distinguishable.
- Missing pieces have useful shopping options when matches are available.
- Preview limitations and unavailable products are communicated honestly.
- The user can trace a clear path from their current wardrobe to the desired look.

### Decisions still to make

- First-release scope for personal try-on, outfit boards, and setting-aware previews.
- Personal photo requirements, photo controls, storage, and deletion behaviour.
- Visualisation approach, supported garment combinations, fidelity, and response time.
- Outfit comparison controls, animation, and gamification mechanics.
- How users retain selected pieces across revisions and revisit preferred looks.
- Initial retailer coverage and product-to-preview matching.
- Budget, size, and other refinement controls, alongside the future Insights preferences.

## 4. Insights

### Purpose and promise

Help users understand the value their wardrobe creates, according to their own priorities. Cost per wear is useful, but is only one lens alongside variety, occasions, time, enjoyment, social engagement, and long-term quality.

**The core question: “Why is this piece in my wardrobe, what does it do for me, and is it delivering the value I wanted?”**

Insights should not prescribe frugality, splurging, or sustainability as the correct lifestyle. It gives users evidence and customisable ways to explore their decisions, whether a piece is an everyday staple, an occasional statement, or something bought simply for enjoyment.

### The user need

“Help me understand what I get from the clothes and accessories I buy. Let me decide what value means to me, see how individual pieces perform over time, and use that understanding when I dress or shop next.”

An illustrative ₹4,000 T-shirt might deliver frequent use, favourite outfits, enjoyment, or a specific occasion. An illustrative ₹500 item might deliver a different kind of value. Price alone cannot establish success, durability, or the owner's satisfaction. Brand and price examples are scenarios, not claims about actual products or brand quality.

### Customisable metric families

Use a small, understandable set of headline metrics with room to explore further. **Working interpretation:** the requested “45 metrics” means four to five core metrics; whether this means 4–5 or a broader catalogue of 45 remains an open decision. The families below define the intended coverage, not a locked metric count or launch dashboard.

| Lens | Questions it helps answer | Candidate measures and required context |
| --- | --- | --- |
| Money and cost | What have I spent, and how does that relate to use? | Recorded purchase spend, spending by category or period, cost per recorded wear; requires prices and wear records |
| Time and use | How long have I had this, and when do I use it? | Time owned, logged wears, time since last logged wear, time to first logged wear after purchase; requires dates and wear logs |
| Variety and occasions | How many different ways does this piece serve me? | Distinct logged outfit combinations, categories represented, wears by occasion, range of occasions; requires item-linked outfits and occasion tags |
| New purchases and realised value | Did the new addition do what I wanted it to do? | Recent additions, first use, outfits actually worn with the new item, user-reported satisfaction against the purchase purpose |
| Enjoyment and engagement | What value matters beyond cost? | Optional enjoyment or confidence feedback, favourite looks, and engagement on linked outfit posts where data is available |
| Quality over time | How is this piece holding up? | Dated condition reviews, time or logged wears before a reported issue, repairs, and user ratings for specific quality attributes |

Users should be able to choose which measures appear prominently. Do not collapse these different forms of value into an unexplained universal score.

### Metric meaning and data honesty

- **Cost per wear:** recorded purchase price divided by recorded wears. For example, ₹4,000 over 20 recorded wears is ₹200 per wear. With no recorded wears, show “No wears logged” rather than dividing by zero or implying the item was never worn.
- **Wardrobe spend:** total recorded purchase prices within a clearly defined scope. This is not current resale value; indicate missing prices.
- **Variety:** distinguish combinations actually logged as worn from combinations the AI merely suggests.
- **Occasion use:** count logged events or wears using a defined tagging method; showing a generated outfit is not evidence of wearing it.
- **Time:** distinguish garment age from time spent styling. Any future claim of time saved requires a defined baseline rather than an invented estimate.
- **Value or returns:** use these terms for personal utility and satisfaction, not financial investment returns. A cost-per-wear target can be user-selected, but there is no universal clothing “break-even” point.
- **Coverage:** show when conclusions rely on incomplete prices, sparse wear logs, estimates, or user reports. Keep observed history separate from predictions.

### Modes and personal priorities

Modes change which evidence and suggestions receive emphasis. They are user-selected, editable preferences, not identities inferred from age, appearance, brands, or spending.

| Illustrative mode | Emphasis |
| --- | --- |
| Frugal maxing | Making use of owned pieces, understanding spend, and finding versatile additions within a chosen budget |
| YOLO maxing | Exploring whether a desired purchase delivers the experience, styling options, quality, or satisfaction the user values- Enjoyment, expression, favourite looks, and optional social engagement, with cost metrics available but not necessarily prominent  |
|  |  |
| Custom | A user-selected mix of measures and priorities that can change over time |

These are playful working labels to refine in UI/UX. No mode should shame a user, reward spending for its own sake, or claim that an expensive purchase is justified by speculative benefits.

### Optional social engagement lens

Users may care about the response an outfit received, including Instagram likes or other available engagement measures. Explore linking a post to the outfit and its items through supported integrations or user-entered data.

- Make this lens optional and dependent on actual data access; social connection does not guarantee access to engagement statistics.
- Attribute metrics to the linked post or outfit. Do not claim a particular bracelet or shirt caused the likes.
- Comparisons need context such as audience size and time since posting; raw likes alone do not establish that one garment performed better.
- Let users decide whether engagement matters to them. It is not an objective measure of personal worth or fashion quality.

### Long-term item reviews

Allow users to add dated reviews and updates directly to individual wardrobe items, such as **“After six months, the buttons wore out.”** Build an item history rather than relying only on the impression immediately after purchase.

Useful review details can include:

- Time owned and approximate or recorded wear count.
- Buttons, stitching, fabric, fading, pilling, shape retention, and comfort.
- Washing or care context where known.
- Repairs, condition changes, and whether the user would buy the item again.

Users can revisit an item and update their assessment as it ages. This history should help them understand which products—and, with sufficient evidence, which brands—work well for the parameters they care about.

Keep personal observations identifiable as personal observations. One failed button on one product does not establish a brand-wide quality problem. Any later cross-user quality comparison needs enough comparable evidence, product identification, and explicit sharing choices. Public reviews and aggregated brand intelligence remain scope decisions; personal item reviews are the core requirement.

### AI-native exploration

Combine visual metrics with natural-language questions and explanations grounded in the user's records. AI should connect the evidence to the user's priorities and suggest useful next actions.

Example questions include:

- “What am I actually getting out of this expensive T-shirt?”
- “Which new purchases have I enjoyed wearing most?”
- “Which pieces give me the most outfit variety?”
- “Show me what I wear for formal occasions versus holidays.”
- “Which of my clothes have held up well after six months?”
- “I'm in frugal-maxing mode this month. What should I wear more before buying something new?”

Answers should identify the records and time period behind the conclusion, state missing evidence, and distinguish a calculated fact from an interpretation or forecast. Users should be able to change the lens rather than accept the AI's definition of a successful purchase.

### User journey

1. **Choose what matters.** Select a mode or customise the metrics shown.
2. **See available evidence.** Explore wardrobe-level summaries and individual-item insights, with data gaps visible.
3. **Add lightweight context.** Record prices, wears, occasions, purchase purpose, satisfaction, or condition reviews where useful. Exact capture flows remain to be designed.
4. **Ask or explore.** Use visual controls or natural language to understand spending, variety, use, quality, or enjoyment.
5. **Act on the insight.** Open an item, build an outfit in Style Me, or explore a considered addition through Discover.
6. **Learn over time.** New wear records, purchases, and reviews update the evidence and future recommendations.

### Connections across the app

**My Wardrobe:** Supplies the item inventory and hosts the item-linked history. Insights adds understanding of what each piece contributes without inventing ownership, purchase costs, or use.

**Style Me:** Can use selected priorities and actual history to suggest underexplored combinations, occasion-appropriate favourites, or looks that get more use from a chosen piece. A recommendation becomes a wear record only when confirmed as worn.

**Discover:** Can inform shopping suggestions using expressed priorities, existing inventory, and supported quality observations. It can surface an addition that serves a new purpose or flag a similar owned item without assuming every duplicate is unwanted.

Insights is a shared intelligence layer that binds the tabs together. It should help users make their own decisions, not simply generate retrospective charts or push every finding toward a purchase.

### Success criteria

- Users can understand wardrobe value through more than cost per wear.
- They can customise the emphasis to fit their own priorities and change it later.
- Item-level explanations connect evidence to the purpose or enjoyment of owning the piece.
- Long-term condition reviews can be added and revisited.
- Metrics distinguish missing data, observed history, and predicted outcomes.
- An insight can lead naturally to inspecting an item, styling a look, or exploring a purchase.

### Decisions still to make

- Confirm whether the intended metric count is 4–5 or 45; select the initial headline measures.
- Exact formulas, periods, comparison baselines, and minimum evidence for each insight.
- Lightweight wear logging, occasion tagging, purchase-purpose capture, and review flows.
- Final mode names, customisation controls, and visual presentation.
- Social engagement integration feasibility and manual-entry options.
- Scope and evidence requirements for any public reviews or aggregated brand comparisons.
- First-release AI questions and the priority signals shared with Discover and Style Me.
