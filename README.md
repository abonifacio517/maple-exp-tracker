# Maple EXP — Web Tracker v5.0

Static browser-only MapleStory Classic World EXP tracker. The site recognizes EXP and percentage every ~5 seconds in a screen-shared MapleStory window. A separate OCR pass every ~30 seconds reads the character's **name** and **level** from the bottom-left HUD, and can use EXP + percentage to infer the correct level when the orange badge's digits are hard to read.

## Changes in v5.0

- No visible preview or continuously drawn game canvas. Screen capture is requested at 1 FPS; only the EXP/percentage/level/name crops are processed at scan time. Auto HUD detection analyzes one full frame on connection and when you ask to locate HUD again, or the capture size changes.
- Level requirement data built into `exp-table.js`, from [MeowDB — Classic EXP table levels 1–100](https://meowdb.com/msclassic/guides/exp-table-level-1-to-100). Every level 1–99 has a required EXP amount; level 100 has no next level in the referenced table.
- Full current EXP / EXP-to-next-level readout, remaining EXP, and percentage fill bar. Level/name OCR results display above the bar. If OCR fails, open **Scan details & correction** and enter a name or level manually.
- EXP and percentage are checked against the level's EXP requirement when available. Inconsistent OCR readings are rejected rather than counted.
- Handles detected level-up EXP counter resets by adding remaining previous-level EXP plus EXP on the new level.

## Deploy

Connect this repository's `main` branch to Netlify as a static website. Publish directory: repository root. Build command: none. Website files: `index.html`, `styles.css`, `exp-table.js`, and `app.js`.

## Privacy and limitations

All screenshot cropping and OCR happen in your browser; no game memory access, injection, or game input automation. The browser asks permission every time you share the game window; keep it visible and unminimized. The OCR engine is loaded from a public CDN. Character recognition is best-effort and may need a manual correction. Automatic HUD detection is tuned against the user's supplied screenshot; other HUD layouts may fail. Using a screen-only tracker does not guarantee compliance with the game's software rules.