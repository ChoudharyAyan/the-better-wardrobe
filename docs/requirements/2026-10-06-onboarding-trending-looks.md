# Onboarding, Google sign-in and trending looks — functional requirements

Source: Teardown Bench, "The better wardrobe - discover module v2.0", owner QA notes #14 and #15 (6 Oct 2026).
Note #15 was cut at the tool's 2,000-character limit; the owner confirmed nothing critical followed.
Owner decisions (6 Oct): build Google sign-in now and configure keys later; guests keep credits but get no saved chats or personalisation.

## #14 Trending looks (replaces the three static prompts)
- FR-14.1 Discover shows three starters drawn from a pool of real people's and characters' looks, shuffled on each visit and on "Shuffle".
- FR-14.2 With a profile, two of the three lean to the person's department (male → menswear, female → womenswear).
- FR-14.3 Each look has a researched spec (piece, colour, details, department, shop query; sources in `prototype/lib/looks.mjs`). Tapping it searches from that spec with no model call.
- FR-14.4 Shop queries name the garment, never the person.
- FR-14.5 Typed requests such as "Virat Kohli's airport look" are understood. The model describes the publicly reported piece, or asks which piece when it doesn't know.
- FR-14.6 A person's own "Something else" onboarding answer appears as a "Your idea" starter.

## #15 Welcome, sign-in and onboarding
- FR-15.1 First visit shows a welcome screen with "Continue with Google" and "Explore freely".
- FR-15.2 Google sign-in uses server-side OAuth with authorization code, PKCE and state.
  - The session cookie is signed and HttpOnly, and lasts 30 days.
  - Accounts are stored in Postgres (`tbw_accounts`).
  - Only verified Google emails are accepted.
- FR-15.3 Until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, the Google button is hidden. "Set up my profile" creates a preview profile tied to this browser, so onboarding can be tested; it disappears once Google is configured.
- FR-15.4 Step 1 (required) asks for:
  - name, prefilled from Google
  - age, 13–100
  - gender: male, female or other
  - what to explore, one or more of Discover, Style Me, Wardrobe, or "Something else" with free text
- FR-15.5 Step 2 (optional, skippable) asks for:
  - a fashion self-description: New to fashion → Getting into it → Knows what I like → Trend-watcher → Fashion freak
  - interest chips
- FR-15.6 After onboarding, the person lands on the first thing they chose to explore.
- FR-15.7 Personalisation:
  - Mall districts matching the person's interests (or their gender when no interests are given) get a "For you" sign.
  - Discover defaults to the profile's department unless the words say otherwise. The reply says which styles are shown and how to switch.
- FR-15.8 Guests who explore freely keep the 120 credits but get no saved chats and no personalisation; Discover invites them to set up a profile. Preview profiles keep the guest's earlier chats.
- FR-15.9 The Profile tab shows the account and answers, with "Edit answers" and "Sign out".

## Owner setup still needed
1. In Google Cloud Console, open APIs & Services → Credentials and create an OAuth client of type Web application.
2. Add the authorized redirect URI `https://the-better-wardrobe.vercel.app/api/auth/google/callback` (plus `http://localhost:5173/api/auth/google/callback` for local use).
3. On the OAuth consent screen, use scopes `openid`, `email` and `profile`.
4. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `prototype/.env`. They then get copied to Vercel.
