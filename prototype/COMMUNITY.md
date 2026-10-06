# Discover Community (prototype)

The Community view in Discover is a shared question-and-lead flow. It is not a copy of Reddit or Spotern: those screenshots informed the interaction pattern, not the content or branding.

## Run it

`npm start` in `prototype/` stores development questions, compressed reference images, answers, votes and XP in `.local-data/community.json` (gitignored). Two browsers with different cookies can test the shared flow on one local server.

For Vercel or another multi-instance deployment, attach a Postgres database and set `COMMUNITY_DATABASE_URL` (or `POSTGRES_URL`). The service creates its `tbw_community_state` table on first request. Without a database, `/api/community` returns 503 and the UI says Community is not live; it does **not** pretend that browser-local data is shared. Database credentials must never be committed. This is currently a prototype store using one JSONB state row, not a production-scale schema.

## Screening and XP

Answers begin server-side screening before they are returned to the feed. The deterministic rubric compares garment, colour, style/material and other distinctive words from the question against the answer and link path. At least two pieces of evidence are required. Scores are capped at 85%; only scores above 50% publish. The public answer shows the score, rubric and “not visually verified” warning. It does **not** inspect the linked product image or verify merchant, price, stock or seller. A weak answer remains non-public and earns nothing; the helper can submit a better lead up to three attempts per question.

A published lead awards 10 guest XP once. A guest cannot answer their own question or vote on their own answer; one vote per guest per answer can be changed. Spending 20 XP spotlights one's own question for seven days. There is no conversion to money, merchandise or paid features. XP is tied to a browser's anonymous cookie, not a signed-in account.

## Before public launch

Add real account identity and recovery, stronger abuse prevention/moderation, question and image deletion controls, moderation/appeal for false matches, a normalized database schema and storage retention policy. The present text-only rubric is a *preliminary lead filter*, not an image-similarity or product-verification engine. Do not market it as verified matching.
