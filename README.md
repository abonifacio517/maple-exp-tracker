# Van's Maple EXP Tracker — Alpha 0.2.43

This release focuses on **faster, movable-inventory mesos reading**, manual potion costs, and an accurate pause-aware timer. EXP and level recognition remain screen-only.

## Alpha 0.2.43 — Browser-only local AI digit learning (experimental)

- Add **mesos-ai.js**, a tiny, supervised **nearest-neighbor (k-NN)** digit classifier that runs entirely inside Chrome. This is a first-stage, trainable local model, **not an already-trained neural network or autonomous AI agent**. No API, remote inference, account or screenshot upload is needed.
- Users can open **Correct meso balance manually**, type the number currently visible in their inventory, and click **Confirm & teach local AI**. The feature segments the actual cropped numerals (handling short comma strokes and some touching digits), labels digit patterns from the confirmed balance, and stores *only normalized digit examples* in browser localStorage.
- The UI displays how many of the ten digits have training examples, plus a toggle to disable the local classifier and a separate Clear learned digits button. Training is opt-in and can be reset without changing EXP sessions or potion counters.
- On each detected inventory scan, the local classifier may show a best-effort **unverified AI estimate** if the current glyphs closely resemble learned examples. **Raw OCR remains the fallback** and continues to run less frequently to avoid freezes. In OCR Settings, the AI match and raw OCR can be inspected separately.
- **AI guesses alone never change confirmed mesos snapshots or mesos/hour.** Strongly conflicting AI/OCR readings are also excluded from automatic confirmation. Manual snapshot saving remains available.
- No raw screenshot frames are stored persistently or uploaded. Only a small, temporary crop of the user-shared inventory textbox is held in memory for explicit teaching; saved training data is a capped collection of digit-feature bitmaps.
- Initial accuracy depends on having enough representative corrections for the character's font and game scaling; missing digits and unusual UI sizes may still need OCR/manual snapshots. Tests include the supplied 483,583 bitmap reconstruction, comma removal and touching-digit separation. **Not yet validated in live MapleStory.**
- The app remains entirely browser-based; screen-only recognition is unchanged.

## Alpha 0.2.42 — Raw mesos OCR with immediate, labeled best-effort balance

- **No enhanced mesos images or digit-template comparisons**. The original black-on-white textbox crop, with only pixel-preserving nearest-neighbor enlargement for readability, is passed to one Tesseract OCR recognition call.
- A plausible OCR number displays immediately in the Mesos Tracker even when Tesseract returns a low (including 0%) confidence score. A fallback extracts digits from OCR output with formatting noise.
- Such a reading is **clearly labeled “OCR estimate · unverified”**, including in the Maple HUD, so players can compare it with the game inventory. Confirmed mesos totals and mesos/hour **do not incorporate low-confidence or formatting-salvaged guesses**. Repeated strictly formatted readings with at least 55% confidence may still establish a normal confirmed snapshot.
- OCR Settings now shows only the original-color textbox preview and raw OCR diagnostic output. The unused enhanced preprocessing path and the mesos-font script are no longer loaded.
- Retains the responsiveness improvements from Alpha 0.2.40, including a local inventory search, cancellable screen scans and five-second OCR throttle. EXP, potion tracker, session timer and visual theme remain unchanged.
- Automated regression checks covered 0% confidence guesses, formatting-noise fallback and separation of unverified estimates from confirmed mesos/hour. Live Chrome/MapleStory accuracy still needs player testing.

## Alpha 0.2.40 — Responsiveness and lower mesos CPU load

- Reworked the optional mesos textbox detector to **yield back to the browser every ~9 ms** during full-screen searches. A missing or relocated inventory no longer runs a five-scale search in one uninterrupted main-thread block.
- Reuse a small screenshot region around the last detected mesos field; fall back to cancellable full-screen discovery when the inventory moves outside that area. In a simulated 1280×720 test this reduced captured pixels by about **95%** on stable inventory positions.
- Reduce mesos polling to once every **2 seconds**, limit re-searches when the inventory is absent to approximately **5 seconds**, and rate-limit expensive fallback OCR to once every **5 seconds**. Fully trusted digit-template readings still confirm without waiting for OCR.
- Render enlarged raw/enhanced OCR preview canvases **only while OCR Settings is expanded**, and no more often than every 5 seconds. The OCR worker keeps its configuration, avoiding repeated parameter setup.
- A no-inventory synthetic frame was searched with browser yields, and both full/nearby textbox location and cancel-on-pause behaviors passed regression tests. Browser and real-game performance may still vary.
- No changes to EXP calculation, KPQ counts, potion accounting, theme appearance or Maple HUD behavior.

## Alpha 0.2.39 — Fix clipped mesos digits

- The movable mesos textbox finder captures the full white number field, plus a safe pixel margin, rather than cropping 18 pixels down from its top edge.
- The black-on-white font reader now identifies white textbox rows and retains all glyph rows, including the bottom stroke and comma descender. The blue frame/border is excluded without deleting fixed bottom rows.
- The enhanced OCR crop uses the same white-row mask and preserves anti-aliased bottom strokes instead of removing two bottom rows.
- Script URLs are versioned so a Chrome refresh loads the corrected locator, font reader and preprocessing.
- A synthetic 67×23 reconstruction of the player's confirmed 483,583 example, including blue surrounding UI rails, was recognized as 483,583 by the revised pixel-template path.
- Unknown digits and conflicting OCR still require independent confirmations; this fixes clipping but cannot guarantee accurate recognition of every scaled UI or font.

## Alpha 0.2.38 — Mesos OCR cross-check and priced consumable selection

- Improve ambiguous black-on-white mesos recognition. When two pixel thresholds produce the same provisional number and a separately enhanced OCR pass agrees, that reading becomes a provisional candidate, **not an immediate confirmed balance**. Repeated matching captures are required; high-confidence conflicting OCR is withheld. Diagnostic output explains disagreements.
- The live textbox detector and conservative, two-frame confirmation of fully trusted font templates remain intact. Missing glyphs or genuine disputes can still require a manual balance snapshot.
- The HP and MP consumable dropdowns now show **fixed NPC shop prices** from [MeowDB's MapleStory Classic consumables efficiency table](https://meowdb.com/msclassic/npc-shops/item-efficiency/consumables). Consumable usage uses the selected NPC price automatically, so separate price inputs are removed.
- Includes both potions and recovery foods listed in the HP/MP tables, excluding items marked unavailable in this release. Prices represent shop replacement value, not player-market or actual purchase price.
- Existing local potion counts/usage totals remain saved; selecting a different consumable establishes a new count baseline.

## Alpha 0.2.37 — Fast mesos box reader, potions and paused session clock

- Mesos detection searches the actual white number field and its gold coin / blue border anywhere in the captured MapleStory window, with support for repositioned inventory and multiple UI scales. It no longer relies on finding an inventory title.
- Confirming mesos now requires two independent high-confidence template reads (three for weaker OCR, and an additional confirmation for very large jumps) rather than always waiting for three or four scans. The independent scan loop runs about every 1.3 seconds.
- The OCR settings dropdown now shows the raw and processed mesos number crop, template/OCR output and candidate confidence details.
- The digit atlas now includes additional verified glyphs from the 483,583 example and handles two touching digits; a synthetic black/white reconstruction of this supplied crop was successfully read as 483,583 by the template engine.
- The mesos total displays the last confirmed balance. Mesos gained/hour uses positive differences between confirmed snapshots divided by active time since the first mesos snapshot. Purchases and transfers may affect the visible balance; they are not mistaken for separate potion costs.
- Manual HP and MP potion tracking includes dropdowns for potion type, on-hand counts, user-specified price per potion, an Update button, and a dedicated reset-baselines button for restocking. Estimates are stored locally and are not subtracted twice from mesos balance. Potion prices must be entered by the user.
- The session timer stops on Pause and resumes without adding paused time. Active duration is used for displayed rates.
- The mini HUD mesos figure is correctly labeled “Last confirmed mesos balance.” The EXP/level OCR path remains unchanged.

## Alpha 0.2.36 — Unified version and theme switch position

- Align the version label to the top right above the Henesys/Sleepywood theme switch.
- Apply the same vertical placement to both modes and narrower viewports.
- Keep character sprites, Maple HUD, and tracking behavior unchanged.

## Alpha 0.2.35 — Sleepywood header sprite sizing

- Reduces only the Sleepywood-mode top-left character sprite, on both desktop and mobile, to more closely match Henesys's visual scale.
- The original image assets, Henesys sprite, Maple HUD and tracking logic are unchanged.

## Alpha 0.2.34 — Sleepywood character header

- Adds the user's transparent white-hat character sprite to the **main application's top-left header in Sleepywood (dark) mode only**.
- Keeps Van's existing character sprite in Henesys (light) mode.
- Crops only transparent space around the supplied cleaned sprite. Character pixels are otherwise untouched.
- Does not change the Picture-in-Picture Maple HUD, OCR or tracked statistics.

## Alpha 0.2.33 — Mini HUD visual parity

- Rebuilt the Document Picture-in-Picture HUD styles for both Henesys and Sleepywood themes, replacing legacy glossy progress bar and beveled controls.
- Match the main app's bright **green EXP progress bar**, **orange current-level badge**, colored blue panel headers, clean borders and readable EXP/hour, ETA and KPQ statistic cards.
- Preserve the existing live stats, mesos WIP indicator, theme synchronization and experimental expandable EXP/min graph.
- Version the HUD script URL to help bypass cached code. Recognition and calculations are unchanged.

## Alpha 0.2.32 — Reliable Henesys metric contrast

- Corrected the original Henesys style rule that was forcing EXP/hour, ETA, and KPQ values to white on pale cards.
- Added an HTML-level contrast safeguard for those three figures and versioned the stylesheet URL so Chrome loads fresh styles rather than stale cached CSS.
- Both themes keep the same text tone as their mesos balance figures. Tracking logic and HUD remain unchanged.

## Alpha 0.2.31 — EXP metric contrast

- EXP/hour, estimated time to next level and KPQ clears counts now share the same theme-aware text color as the mesos balance figures.
- Fixes white-on-pale-stat-card readability in Henesys mode; Sleepywood and all tracker calculations are otherwise unchanged.

## Alpha 0.2.30 — Henesys underground and sharing button

- Henesys background is slightly less zoomed (124% desktop, 112% mobile) and framed farther toward the ground (42% desktop, 34% mobile).
- Share game window is green in both Henesys and Sleepywood modes, with no label change. Stop sharing remains red.
- Sleepywood scene, Maple HUD and tracking logic are unchanged.

## Alpha 0.2.29 — Henesys map replacement

- Replaces the earlier wide Henesys background with the newer user-supplied 16:9 village screenshot, optimized as a WebP embedded in the site's SVG asset.
- Retains the Henesys crop/zoom, blur, and opacity, and refreshes the CSS URL to ensure browsers load the new artwork.
- Sleepywood, OCR and Maple HUD remain unchanged.

## Alpha 0.2.28 — Map backgrounds

- Add user-provided **Sleepywood** and **Henesys** map screenshots as optimized, self-contained SVG image assets, each embedding a web-friendly WebP version of the supplied artwork.
- Sleepywood decorates dark mode; Henesys decorates light mode. Images are fixed behind the panels, emphasizing upper sky and buildings rather than lower map ground.
- A slight blur and saturation adjustment preserve the artwork without competing with EXP readings.
- Background opacity stays visible (58% Sleepywood / 53% Henesys on desktop, slightly reduced on narrow screens).
- Overlay/HUD, OCR recognition, EXP math and mesos tracking are unchanged.

## Alpha 0.2.27 — Henesys and Sleepywood refinement

- Light mode is now **Henesys mode**: a sky-blue/white variant of Sleepywood's compact panels, smaller margins, simpler headers, and grouped EXP metrics.
- The mode-switch label offers **Henesys mode** while in Sleepywood, and **Sleepywood mode** while in Henesys. Existing theme preference is preserved.
- Session time returns to a dedicated slot on the right side of the share/track/HUD button row (stacked responsively on narrower screens).
- The cumulative **+ EXP gained** appears next to the current/required EXP fraction underneath the progress bar; the redundant EXP-gained metric card has been removed.
- Both themes use a MapleStory-inspired **green EXP bar** and an **orange badge** around the current-level number.
- The Maple HUD overlay is intentionally unchanged, as are the EXP/mesos OCR engines and all KPQ calculations.

## Alpha 0.2.26 — Dark-mode refresh

- Dark mode now follows a compact charcoal-and-navy visual language with flat cards, thin borders, blue full-width section bars and a bright blue EXP progress bar. Light-mode colors are intentionally unchanged.
- Reduced page width and spacing; session timer moves into the header beside Van's sprite. Live EXP stats form a compact, responsive grid.
- Replaced the generic mesos currency mark with an original gold coin and engraved maple leaf, closer in spirit to MapleStory's mesos imagery (not an official extracted asset).
- The browser Picture-in-Picture HUD has matching dark-only styling, clearer metric spacing, a small Van sprite and the same gold meso coin. The experimental EXP/min graph is retained.
- Recognition, OCR, KPQ estimate math and screen-only permissions are unchanged.

## Alpha 0.2.25 — Minimal HUD and experimental EXP/min chart

- Van's updated original sprite replaces the earlier version; the beige background is made transparent without sharpening or adding filters.
- Header subtitle is shortened to “Classic World training tracker.”
- The sharing status dot is red when disconnected and green while sharing.
- Top action buttons keep stable dimensions as labels change.
- EXP and mesos icons are clean, lightweight geometric SVG graphics on the main page and in the HUD.
- All section headers now extend to the panel's top and side edges. Settings, session details and diagnostics remain collapsible.
- HUD columns clearly separate EXP/hour, time to level and KPQ clears remaining. The redundant HUD Compact and Close buttons are removed (close using the browser's native Picture-in-Picture control or the main page).
- The HUD's “Show EXP/min graph” control expands an experimental 20-minute line graph using confirmed EXP-gain events only. The browser may restrict resizing the Picture-in-Picture window; scrolling still works.
- EXP, level and mesos OCR detection pipelines are otherwise unchanged.

## Alpha 0.2.24 — Layout and controls

- Header is now Van's Maple EXP Tracker with a transparent pixel-art character sprite.
- Share/Stop Sharing and Resume/Pause are paired stateful buttons with distinct colors; automatic HUD detection still starts after sharing.
- Session timer is larger; the top toolbar stays compact.
- EXP card shows EXP/hour, ETA, KPQ clears and EXP gained without duplicating the current EXP or percentage shown beside the bar.
- KPQ estimate remains based on 2,550 EXP per clear, excluding varying mob EXP.
- Manual level entry is in the OCR settings dropdown at the bottom.
- Session details is collapsed by default; scan details also stays collapsible.
- Mesos tracking has an explicit work-in-progress warning; the Alpha 0.2.20 mesos reader is unchanged.
- Picture-in-Picture mini HUD includes KPQ clears and ETA alongside level progress.

## Previous mesos recognition improvements

- A dedicated template reader compares individual glyphs against confirmed digits from user-supplied inventory screenshots (427,993, 466,629, and 428,381). The reference library presently covers 1, 2, 3, 4, 6, 7, 8, and 9. Missing digits (0 and 5) are **not** guessed; OCR handles them until real samples can be collected.
- The mesos field is separated from surrounding HUD rails, isolated as dark numerals on white, and upscaled 8× with nearest-neighbour interpolation for fallback OCR.
- Confidence is based on digit-template ambiguity, independent OCR preprocessing agreement, and **repeated captured frames**. An OCR confidence percentage on its own is insufficient.
- A rolling 30-second / 10-reading voting window survives intermittent unreadable frames, and significant balance jumps need additional confirmation.
- Conflicting high-confidence template and OCR readings leave the previous confirmed balance unchanged.
- The diagnostics still expose the digit matching and OCR results for troubleshooting.

## Boundaries

- OCR and digit templates are not guaranteed to be correct on every screen size or quantity.
- All recognition happens from user-approved screen capture. No MapleStory memory, files, packets, or controls are touched.
- EXP, level tracking, the website theme, and the mini HUD are unchanged; potion tracking remains disabled.
- The app is a static website for GitHub Pages.