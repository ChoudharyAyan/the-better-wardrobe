# Working on this repo (for any coding agent)

This project is developed by its owner using more than one coding agent
(Claude Code and ChatGPT Codex, switched between depending on which has
usage quota available). This file is the shared contract so agents don't
clobber each other's work. Read it before making any change.

## Start of session

1. `git fetch origin && git log origin/main -5` — see what actually landed
   most recently. Don't trust a stale summary in your own context; another
   agent may have merged work since you last looked.
2. `git checkout main && git pull origin main` before branching, so new
   work builds on the latest state.
3. For product/implementation context, read `HANDOFF.md` first, then
   `PRODUCT.md` and `DESIGN.md`. Treat `HANDOFF.md`'s roadmap section as
   informative, not authoritative — it can go stale the moment either
   agent finishes a phase it describes as "not started." Trust `git log`
   over any roadmap doc for what's actually done.

## Branching and merging — never push directly to `main`

`main` is protected: pushes are rejected, only merges through an approved
pull request are accepted.

1. Create a branch before making any change:
   `git checkout -b <agent>/<short-kebab-description>`
   — e.g. `claude/fix-dark-mode-leak`, `codex/india-retailer-registry`.
   The prefix says which agent/session made it, for a quick skim later.
2. Make the change, run the checks below, commit with a message that
   explains *why*, not just what (this repo's existing commit log is the
   style reference — lead with the bug/symptom, name the root cause, name
   what was verified).
3. `git push -u origin <branch>`, then open a PR:
   `gh pr create --title "..." --body "..."` (or the equivalent in your
   environment). CI (`.github/workflows/ci.yml`) must pass before it's
   mergeable — it runs `npm run check` and `npm test` in `prototype/`.
4. Do not merge your own PR unless the owner has explicitly said to. By
   default, leave it open for the owner to review and merge from GitHub
   (or ask them for a merge explicitly). If asked to merge, prefer
   `gh pr merge --squash` to keep `main`'s history linear.

## Before calling anything done

- `cd prototype && npm run check && npm test` — all 33+ tests must pass.
  Add tests for new behavior rather than leaving it unverified.
- Never commit `.env`, anything under `.local-data/`, `.local-tools/`, or
  `.local-models/` — all gitignored already; double-check `git status`
  before staging broadly.
- If you changed anything a person would look at (a screen, a flow, copy),
  say plainly whether you actually saw it render correctly or whether you
  only reasoned about it from source — don't claim visual verification you
  didn't do.
- Don't spend SerpApi quota (live search calls) without the owner's
  go-ahead in the current conversation — `DISCOVERY_DATA_MODE=auto` will
  replay a prior exact search for free; prefer that or fixture-based tests
  over new live calls.

## Design authority

`Design Docs New/` is the authoritative UI spec (read `00-INDEX.md` first).
The non-negotiables called out there (Montserrat only, no serif/italic
display type, the wardrobe is a physical almirah not a card grid) have
already caused real regressions when violated — don't reintroduce them.
