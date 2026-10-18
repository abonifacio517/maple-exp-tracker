# Maple EXP Tracker v7 — EXP-first tracking

A simple screen-only MapleStory Classic World EXP tracker. The browser reads the EXP number (approximately every 5 seconds) and attempts to recognize the orange level badge. **Character names and screen percentages are not OCR-read.**

Level percentage is calculated as `current EXP / EXP_TO_NEXT[level] * 100`. If level detection is unverified, the percentage is blank rather than guessed; users can type their current level in the main dashboard and select **Set level**.

The EXP table for levels 1–99 is bundled in `exp-table.js`, based on https://meowdb.com/msclassic/guides/exp-table-level-1-to-100 (level 34 requires 155,540 EXP to reach 35).

## Deploy

Publish the contents of this folder to any static host, including Netlify. No build command is needed. Host the four files `index.html`, `styles.css`, `app.js`, and `exp-table.js`. Requires HTTPS for window sharing, internet access for Tesseract.js, and an unminimized shared MapleStory window.

## Limitations

No general-purpose OCR system can guarantee flawless small-font recognition. This tracker requires multi-pass matching for EXP and repeats level readings before confirming a detected level. Uncertain readings are ignored; the last accepted reading remains visible. After manually changing the level, the EXP baseline is reset to avoid fake gains. A manual level entry locks level auto-detection until it is re-enabled in Scan details. Level-ups and manual corrections should be verified against the game.

No game injection, reading process memory, packet capture, or game automation. This does not guarantee compliance with Nexon's third-party rules.