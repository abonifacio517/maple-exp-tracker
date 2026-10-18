# Maple EXP Tracker — Alpha 0.2.0

Experimental static website for MapleStory Classic World. It reads only a browser-approved screen-sharing stream; it does not inject into, automate, or read the game client memory. Screen-only operation does NOT guarantee permission under Nexon rules.

## What's in this alpha

- EXP tracking using a screenshot-derived **pixel-template digit matcher**, with a multi-pass Tesseract OCR fallback for digits not yet represented by the sample (such as 4) or uncertain images.
- Optional user-verified EXP digit calibration in OCR Settings. Enter the exact EXP shown in the game while screen sharing. Saved templates stay in your browser's localStorage.
- Current level detection from the orange level badge (OCR), with an explicit manual level override.
- Live EXP progress and the EXP-to-next-level calculation from the locally bundled classic EXP table.
- Automatic inventory detection using the screenshot's frame/title style. When the inventory is visible during a scan, the tracker attempts a verified mesos snapshot. When it closes, the last balance is retained; net meso change and its approximate hourly rate use those snapshots.
- Hotbar tracking of **top-left slot = HP** and **slot directly to the right = MP**. The tracker observes changes in numeric stack counts and estimates consumables used. Optional manually configured item prices calculate value consumed.
- No continuous game preview. EXP scans are attempted every 5 seconds; mesos/hotbar scans take extra time when needed.

## How to use

1. Open the published website with current Chrome/Edge and click **Share game window**, choosing MapleStory.
2. Keep the game's EXP HUD visible. The tracker attempts to locate it and begins reading EXP.
3. If level OCR is missing or incorrect, enter your current level using **Set level**. Percent is calculated from numeric EXP and the level EXP table.
4. To initialize mesos, open the inventory until the dashboard confirms a balance, then close it. Reopen periodically to take another snapshot.
5. Keep your HP potion in the FIRST slot of the top row of the screenshot-style hotbar, and your MP potion in the SECOND slot. The hotbar must remain visible. Enter optional potion prices if desired.
6. If EXP template matching fails, expand **OCR settings**, type the exact number currently displayed in-game, and click **Calibrate digits**. It will save screenshots' labeled glyphs locally if glyph segmentation matches the number of entered digits.

## Important accuracy limits

This is an ALPHA, not a guaranteed-accurate source of game data. OCR methods can make the same mistake in multiple passes. Ambiguous readings are skipped. The template library is incomplete and screenshot-scale-dependent. Meso snapshots are **net balance differences** including purchases and trades; they are not monster-drop income. Potion decreases can be missed if stacks are restocked/replaced between screenshots. Potion value consumed is displayed separately and is not subtracted again from net meso change. The browser may stop capture when the game is minimized, and browser window sharing permission is required each session.

## Deployment

Static files (no build command). Set Netlify's publish directory to the repository root. GitHub changes to `main` should trigger Netlify if automatic deployments are enabled. Tesseract.js is loaded from its CDN and processed inside the browser; it is not uploaded to this site.

Level EXP table: https://meowdb.com/msclassic/guides/exp-table-level-1-to-100