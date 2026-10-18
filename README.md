# Maple EXP Tracker v6 — Accuracy update

A static website for tracking MapleStory Classic World EXP from a user-approved, shared game window. All capture processing runs inside the browser; no game memory, packet access, or game inputs.

## New in v6

- The orange **level badge** is isolated by color, and the **white level digits** are isolated for OCR. The old approach read the orange background instead of the digits.
- The **character name** is cropped from the second row under the class name, so the class name is excluded.
- Name and level each require multiple matching OCR processing passes, plus matching readings on two separate screen captures before the dashboard accepts them.
- On-screen percentage is now *only a cross-check*. Progress is computed as `100 × current EXP / EXP needed for the confirmed character level`, using the bundled MeowDB EXP table.
- If the displayed percentage OCR disagrees (e.g., 2.60% versus computed 7.60%), the tracker keeps the calculated percentage and shows a warning.
- Implausible EXP readings (decreases without a confirmed level-up, exceeding required EXP, or very large jumps) are rejected rather than incorporated in EXP/hour.
- A detected new level is provisional until an EXP counter reset confirms it.
- No game preview is rendered. EXP scans are attempted every 5 seconds; identity rechecks are less frequent to reduce OCR overhead. OCR scans may take longer than five seconds on slower computers; scans do not overlap.

## Deploy

Publish `index.html`, `styles.css`, `app.js`, and `exp-table.js` at the repository root with Netlify's publish directory set to the repository root. Build command: blank (static HTML, no build necessary).

## Important accuracy limitation

This reduces common errors but does not guarantee perfect recognition. A game screenshot may contain too few pixels to tell apart some digits. The tracker errs toward refusing uncertain readings, so stats can pause if OCR cannot verify a number. Check the diagnostic section and use manual correction for the rare cases where OCR is ambiguous.

The EXP requirement table is bundled in `exp-table.js` and sourced from https://meowdb.com/msclassic/guides/exp-table-level-1-to-100.