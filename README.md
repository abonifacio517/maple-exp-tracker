# Maple EXP Tracker — Alpha 0.2.7

A screen-only, browser-based MapleStory Classic World training tracker. No injection, client memory access, packets, or input automation. Passive capture still does **not** guarantee compliance with Nexon's terms; ask Nexon for official confirmation if needed.

## What's new

- More focused interface, prioritizing EXP/hour, ETA to level and estimated grinding profit.
- Separate manually selected HP and MP consumables with NPC price data from [MeowDB / NiaDB](https://meowdb.com/msclassic/npc-shops/item-efficiency/consumables), captured October 18, 2026. Both tables include relevant HP/MP food items. Entries marked not available in the game's current release were omitted.
- Top-left hotbar slot is HP; the next slot to the right is MP. The quantities are checked by an independent browser OCR worker with a pixel-pattern shortcut for verified, previously calibrated stack images. Unfamiliar OCR results must agree across three frames. Values must also pass a plausible-change check. No guessed consumption is counted.
- Verified starting potion counts can be entered under **Set / correct potion stack counts**. This helps reject partial digits such as misreading 123 as 2. You can manually enter counts later if OCR struggles; true decrements are recorded and restocks are not subtracted.
- Actual cost of observed potions is accumulated at the NPC price selected **when each quantity decrease is counted**. Changing a consumable invalidates that slot's current baseline until you confirm the new stack; previous session costs remain.
- Mesos balance changes are still confirmed separately through inventory snapshots, every ~2 seconds; EXP tracking remains every ~5 seconds.

## Mesos profit accounting

Default (potions stocked before session):

    Estimated grinding profit = current meso balance − starting meso balance − value of potions consumed

This reflects the economic cost of pre-stocked potions. If you **buy potions during this session**, those purchases already decrease your in-game balance. Switch to **Use balance change only** so the same purchased potions aren't subtracted twice. If your session mixes pre-stocked potions and in-session purchases, neither simple mode gives a fully accurate cost attribution without more information.

The profit estimate is withheld in the default mode until both consumable choices and starting stack counts are confirmed, and if any observed uses lacked a selected price. A negative result is red; a positive result is green. The last confirmed meso balance may be stale if the inventory has stayed closed, and usage during obscured frames or unobserved restocks may be missed.

## How to use

1. Publish the static files in this folder (no build command) from GitHub to Netlify, or upload to any HTTPS static host.
2. Open the site in Chrome or Edge; click **Share game window**, choosing your MapleStory window.
3. Select your HP and MP consumables from the dropdowns (source NPC prices are shown in the menu).
4. Expand **Set / correct potion stack counts** and type the quantities visible in your first two hotbar slots to establish a safe starting point. Keep the hotbar visible.
5. Open the inventory briefly at session start and later to update mesos. The website detects a floating inventory anywhere within the shared game window.
6. Choose the profit accounting mode that matches how you acquired potions.
7. Use the hidden **Scan details & correction** diagnostics if a reader has trouble.

## Limitations / validation

- The live EXP and mesos readers were previously tested by the user and are left logically intact. The newly added potion quantity reader has passed syntax, browser interface and calculation tests, but **has not been validated during live game play**. The provided screenshot's quantity digits are unusually difficult for Tesseract because they overlap artwork. Expect some automatic scans to be rejected. Manual correction remains necessary when digits are unclear.
- Screenshot templates are tied to the visual size and appearance of the selected hotbar, not game memory. Browser capture cannot guarantee a frame when MapleStory is minimized.
- No media is sent to our server; screenshots and OCR are processed within the browser. OCR engine files are fetched from a third-party CDN to run locally.
- NiaDB prices can change and do not include special discounts, other sources of consumables, or player-trade values.

## Alpha 0.2.7 potion reference calibration

- Six real hotbar images supplied by the player teach the numeric quantity region of HP slot (Orange Potion: 48, 47, 46, 45, 44, 43) and MP slot (Lemon: 113, 112, 111, 110, 109, 108).
- The dynamic pixel mask ignores potion art and only compares pixels that differ between these captures. The matcher is strict and refuses to guess the closest number if a value is not one of the references.
- An exact-match starting count can initialize after three consecutive independent captures; other consumables or quantities require the existing OCR/manual fallback.
- The 4x3 hotbar coordinates are relative to the located movable hotbar and work with the new closer crop.
- Different hotbar skins, graphics settings, scaling, or item sprites may require new calibration. All changes are screen-only.