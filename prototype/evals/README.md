# Model lab

Tests every candidate vision model on the same labelled screenshots and Indian shopping queries, then writes a
publishable report. Everything runs on your machine; results you choose to publish show in the Developer tab.

## The $10 pilot (start here)

Everything now runs on one OpenRouter balance with `--via openrouter` (Gemini included). Check credit any time with `npm run lab -- balance`; every paid step lowers its cap to the credit actually left.

12 models on ~80 images and ~60 queries. Typical spend ~$5.75, worst case ~$10, and `--max-usd` makes the cap hard.

| Paid from | Models | Typical | Worst case |
|---|---|---|---|
| Your Gemini key | Gemini 3.1 Flash-Lite · 3 Flash · 3.5 Flash · 3.6 Flash · 3.1 Pro (ceiling check) | ~$3.65 | ~$6.35 |
| One OpenRouter top-up | GPT-5 nano · GPT-5.4 nano · GPT-5.4 mini · GPT-5.6 Luna · Claude Haiku 4.5 · Qwen3-VL 30B · Qwen3-VL 235B | ~$2.10 | ~$3.60 |

Held back for later: GPT-5.6 Terra, Claude Sonnet 5.5, GPT-5.6 Sol, Claude Opus 5.5. Gemini 3.1 Pro stands in
as the ceiling: if it beats the best mid-range model by only a few points, the other flagships will not change
your decision. If the gap is large, Terra + Sonnet on 40 images costs about $1.40 more.

1. Keys: keep `GEMINI_API_KEY`; add `OPENROUTER_API_KEY` with a $5 top-up (OpenRouter adds a small fee on
   purchases). OpenAI and Anthropic accounts are not needed for the pilot.
2. `npm run lab -- preflight --models pilot --via openrouter` (free). Fix any flagged ids in `evals/models.mjs`
   (Gemini ids live in `model`, OpenRouter ids in `openrouter`).
3. Golden set: ~70 real screenshots in `.local-data/evals/golden/images/` (the 12 bundled samples make ~80) and
   ~20 real queries next to them (the 42 bundled make ~60). Draft labels almost for free with a model that is
   not in the test, then correct them by hand:
   `npm run lab -- prelabel --dir .local-data/evals/golden/images --models gemini-2.5-flash-lite --max-usd 0.5`
4. `npm run lab -- run --models pilot --via openrouter --limit 3 --max-usd 0.5` (smoke test, ~$0.10–0.40).
5. `npm run lab -- run --models pilot --via openrouter --max-usd 9.5`
6. `npm run lab -- report latest`

With ~80 images, differences under about 5 points are noise: good for ruling tiers in or out, not for
splitting near-ties. Call it a pilot when you publish.

## The full study set (16 models)

`--models pareto` (same as `all`) runs these. They are the Pareto-friendly 80% of the candidates: three
models are opt-in because something cheaper or newer covers the same ground.

| Tier | Models |
|---|---|
| Very cheap | GPT-5 nano · Qwen3-VL 30B-A3B (open weights) · Qwen3-VL 235B-A22B (open weights) |
| Cheap | GPT-5.4 nano · Gemini 3.1 Flash-Lite |
| Mid-range | Gemini 3 Flash · GPT-5.4 mini · Claude Haiku 4.5 · GPT-5.6 Luna |
| Mid-high | Gemini 3.5 Flash (current production) · Gemini 3.6 Flash |
| Expensive | Gemini 3.1 Pro · GPT-5.6 Terra · Claude Sonnet 5.5 |
| Very expensive | GPT-5.6 Sol · Claude Opus 5.5 |

Opt-in (`--models everything`, or name them): Gemini 2.5 Flash-Lite (legacy, being retired), GPT-5.5 (same
price as Sol, older), Claude Fable 5.1 (twice the Opus price), and the local Ollama Qwen3-VL 2B.

## Expected cost (list prices, one repeat)

| Golden set | Typical | Pessimistic (heavy reasoning tokens) |
|---|---|---|
| 200 images | ~$32 | ~$55 |
| 300 images | ~$48 | ~$82 |
| 200 keyword queries | ~$9 | ~$15 |
| Drafting labels for 300 images (`prelabel`, 2 models) | ~$13 | ~$23 |

About 70% of the spend is the four expensive and very-expensive models. Cached answers are free, so re-running
a report or adding a model only pays for what is new. `estimate` prints the exact figure for your set.

## Steps

1. **Keys.** In `prototype/.env`: `GEMINI_API_KEY` (already there), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
   `OPENROUTER_API_KEY`. Put a monthly spend limit on each provider dashboard as a second safety net.
2. **Check model ids (free):** `npm run lab -- preflight`. Fix any id it flags in `evals/models.mjs`
   (it suggests near matches, for example a `-preview` suffix).
3. **Smoke test (~$0.60):** `npm run lab -- run --models pareto --limit 3`. Every provider adapter gets exercised
   on 3 images and 3 queries. Read the failures column: anything non-zero here is a setup problem, not a model one.
4. **Build the golden set** (the part that matters most, see below).
5. **Full run:** `npm run lab -- estimate`, then `npm run lab -- run --max-usd 80`.
6. **Stability check (~$10–15):** re-run the top five plus Gemini 3.5 Flash with `--repeat 2` so the report can
   show run-to-run variance where the decision is actually made.
7. **Report:** `npm run lab -- report latest` → `report.md`, `linkedin.txt` and PNG charts in
   `.local-data/evals/reports/<runId>/`. **Publish to the Developer tab:** `npm run lab -- publish latest`, then
   commit `evals/results` and `dist/evals` (these aggregate numbers become public on the Vercel site).

## Building the golden set (200–300 images)

Aim for the mix your users will really send, for example: 30% Instagram/Reels screenshots, 20% Pinterest,
15% celebrity or influencer looks, 20% Indian ethnic wear, 15% plain product shots. Tag each image so the report
can break scores down by type.

1. Put the images in `prototype/.local-data/evals/golden/images/` (gitignored: real screenshots never enter git).
2. Draft labels: `npm run lab -- prelabel --dir .local-data/evals/golden/images --max-usd 15`.
   Two strong models from different vendors draft each image and every disagreement is listed under `review`.
3. Open `.local-data/evals/golden/drafts.json` and, per image: delete wrong items, fix fields, **delete any field
   you are not sure about** (missing fields are not scored, wrong ones are), add `tags`, set `exhaustive: true`
   only if every buyable item is listed, then set `"status": "verified"`. Only verified images are used.
4. Bias note: the two drafting models (default Gemini 3.1 Pro and Claude Opus 5.5) start from their own answers.
   Correcting every draft by hand removes most of that advantage; mention it in the published method.

Queries: add real ones from your search logs to a JSON file in `.local-data/evals/golden/` using the shape of
`evals/golden/queries.sample.json`. Only include an `expect` field when you are sure of the right answer.

## Commands

`list` · `preflight` · `estimate` · `run` · `report <runId|latest>` · `publish <runId|latest>` · `prelabel --dir`.
Common flags: `--models` (tiers, ids, `pareto`, `everything`), `--tasks look,query`, `--limit N`, `--repeat N`,
`--max-usd N`, `--max-dim 1024`, `--no-cache`, `--include-drafts`.
