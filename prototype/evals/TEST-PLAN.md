# Discover vision study: test plan

Picks the model for Discover's first step, image understanding: seeing every fashion item in a screenshot, naming
it, describing it and phrasing it ready for a keyword search. No web search is involved. Budget: one OpenRouter
balance of $10, spending capped at $9.30. Expected spend ~$6.75.

## For Claude Code: how to run this

Read `evals/README.md` and this file. Then run the steps below in order from `prototype/`, always with
`--via openrouter`. **Stop and show the owner the output after every step marked GO/NO-GO**, and do not start the
next paid step without a yes. Never pass `--no-cache`. Never raise a cap above the credit `balance` reports.
If `preflight` flags a model id, fix it in `evals/models.mjs` (the `openrouter:` field) and re-run `preflight`.

| # | Step | Command | Cost | Time |
|---|---|---|---|---|
| 0 | Setup | apply the patch, add `OPENROUTER_API_KEY` to `.env`, unzip screenshots into `.local-data/evals/golden/images/` (keep the `everyday/` and `celebrity/` folders) | free | 15–20 min |
| 1 | Checks | `npm run lab -- balance` and `npm run lab -- preflight --models pilot,gemini-3.1-pro,claude-sonnet-5.5,gpt-5.6-terra,gemini-3.1-flash-lite --via openrouter` | free | 2 min |
| 2 | Calibrate key **(GO/NO-GO)** | `npm run lab -- autolabel --dir .local-data/evals/golden/images --via openrouter --limit 3 --max-usd 0.3` | ~$0.08 | 1 min |
| 3 | Answer key | same without `--limit`, `--max-usd` = projection × 1.1 | ~$2.60 | 20–35 min |
| 4 | Calibrate test **(GO/NO-GO)** | `npm run lab -- run --set autokey --models pilot --via openrouter --tasks look --limit 3 --max-usd 0.5` | ~$0.12 | 2 min |
| 5 | Full test | same without `--limit`, `--max-usd` = credit left − 0.40 | ~$3.80 | 15–30 min |
| 6 | Validate | `npm run lab -- validate latest --via openrouter --checker gemini-3.1-flash-lite` | ~$0.33 | 5 min |
| 7 | Report | `npm run lab -- report latest` | free | 1 min |

**Total: about 1.5–2 hours end to end, ~$6.75.** The key and the test are the long steps; both resume for free
from cache if interrupted.

If a calibration projects the total above $9.30, cut in this order: test on 80 images (`--limit 80`), then drop
Gemini 3.5 Flash, then build the key on 80 images.

## Models

**Under test (11):** GPT-5 nano · Qwen3-VL 30B · Qwen3-VL 235B · GPT-5.4 nano · Gemini 3.1 Flash-Lite ·
Gemini 3 Flash · GPT-5.4 mini · Claude Haiku 4.5 · GPT-5.6 Luna · Gemini 3.6 Flash · Gemini 3.5 Flash (current production).

**Not under test:** Gemini 3.1 Pro and Claude Sonnet 5.5 build the answer key (only what both agree on is scored);
GPT-5.6 Terra spot-checks the key on 20 images; Gemini 3.1 Flash-Lite runs the text-only privacy check.

## Rubric

**Image understanding (0–100)** = 25% spots items + 25% names the type + 30% describes attributes + 20% search-ready.

| Part | Checks |
|---|---|
| Spots items | Finds each of the key's items (up to the 4 most prominent) |
| Names type | Right product type, including kurta vs kurti, anarkali vs dress |
| Describes | Colour, pattern, fabric, sleeve, neckline, fit, length, occasion, visible brand |
| Search-ready | Its shopper search phrase holds the key's search words, including what makes a celebrity piece distinctive |

Beside the score: failure rate, cost per image, median speed. Eligible for production only with at least 98% valid
answers and naming a person in no more than 2% of celebrity images.

## Expected results (hypotheses, not results)

These are what we expect before running, so the real numbers can confirm or overturn them. With 100 images,
differences under ~5 points are ties.

| Expected rank | Model | Expected score | $ / image | Expected role in Discover |
|---|---|---|---|---|
| 1–3 | Gemini 3.6 Flash | 80–88 | ~$0.0075 | Launch model if it leads |
| 1–3 | Gemini 3.5 Flash (production) | 79–87 | ~$0.0084 | Baseline: is switching worth it? |
| 1–4 | GPT-5.6 Luna | 78–86 | ~$0.0056 | Strongest non-Google option |
| 3–5 | Gemini 3 Flash | 77–85 | ~$0.0028 | Likely best value at 1,000+ searches/month |
| 4–6 | Claude Haiku 4.5 | 75–84 | ~$0.0050 | Fallback from a different company |
| 4–6 | GPT-5.4 mini | 74–83 | ~$0.0042 | Fallback alternative |
| 6–8 | Gemini 3.1 Flash-Lite | 70–80 | ~$0.0014 | First stage of a cheap-then-strong cascade |
| 7–9 | Qwen3-VL 235B | 68–78 | ~$0.0009 | Best open-weights model |
| 8–10 | GPT-5.4 nano | 65–76 | ~$0.0011 | Budget option if reliable |
| 9–11 | Qwen3-VL 30B | 60–72 | ~$0.0006 | Floor for open weights |
| 10–11 | GPT-5 nano | 58–70 | ~$0.0003 | Cheapest floor |

Also expected: every model scores lower on celebrity images (mostly on search-ready phrasing), women's ethnic wear
is the hardest category, small accessories are the most-missed items, and the key makers agree on roughly 80–90%
of items.

## How the result feeds The Better Wardrobe

| Study output | Decision it makes in Discover |
|---|---|
| Leaderboard + eligibility | The launch model and a fallback from a different company |
| Model per volume band | When to switch to a cheaper model or a cascade as searches grow (1k, 10k, 100k a month) |
| Search-ready score | Whether the model's search phrase can go straight to the shopping search, or needs a rewriting step |
| Category and celebrity slices | Whether ethnic wear or celebrity images should be sent to a stronger model |
| Cost per image | The per-search cost line in the Discover budget |
| Taxonomy + prompt version | Frozen as the contract; models stay swappable and the study re-runs from cache |

## Report format

`npm run lab -- report latest` writes to `.local-data/evals/reports/<run>/`:

- `report.md`, the long-form article: what we found · leaderboard · how the answer key was made and checked ·
  which model for the first 1,000 users and after · method · where models struggle.
- `charts/`: cost vs quality with cascades, attribute accuracy by model, score by image type, latency (PNG + SVG).
- `linkedin.txt`, a ready-to-edit post.

## LinkedIn format

Five portrait slides (1080 × 1350), already designed in the claude.ai carousel artifact with illustrative numbers:
1 hook · 2 the test (100 images, the score) · 3 leaderboard with $ / image · 4 what we learned · 5 what we are
building. To finish it, bring `report.md` back to the claude.ai chat that made the carousel and ask for the real
numbers to be put in, then switch off the "illustrative numbers" tag.
