# Van's Maple EXP Tracker — Alpha 0.2.25

This release improves screen-only **mesos recognition** without changing the EXP and level recognition code.

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