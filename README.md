# Van's Maple EXP Tracker — Alpha 0.2.28

This release improves screen-only **mesos recognition** without changing the EXP and level recognition code.

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