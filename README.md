# Maple EXP Tracker — Alpha 0.2.14

A screen-only MapleStory Classic World training companion, hosted on GitHub Pages. It reads EXP and inventory mesos from user-approved browser window capture. It does not inject into the game, read game memory, sniff packets, or send automated input. Screen-only processing is not a guarantee of Nexon's authorization.

## What changed

- **Potion tracking is paused and removed from the active app.** No hotbar OCR, potion prices, potion use calculations or potion corrections run. Older versions remain available in repository history if we revisit the feature.
- **Net mesos change** replaces potion-adjusted "estimated grinding profit". The headline is the difference between the latest verified mesos balance and the first recorded balance. It includes both spending and earnings, and makes no attempt to assign potion costs.
- **Mini overlay:** Click **Open mini overlay** in the Game connection panel for a compact, always-on-top browser Picture-in-Picture window showing EXP/hour, time to level, level progress and net mesos. The mini window has Compact/Expand and Close controls. Keep the main tracker tab open; OCR stays in the tab, not in the mini overlay.
- Preserves existing EXP 5-second scanning, auto level recognition, mesos 2-second scanning, and manual EXP/meso corrections.

## How to use the mini overlay

1. Open this website in current **desktop Chrome or Edge** over **HTTPS** (GitHub Pages).
2. Share the **MapleStory application window** and start tracking.
3. Click **Open mini overlay**, then move/resize the floating window over your windowed game or another window.
4. Click **Compact** to fit less information into a smaller space, **Expand** to restore details, or **Close ×**.
5. Keep the main website open and the game visible. Minimized game windows or revoked screen sharing can pause reads.

### Limits

Document Picture-in-Picture availability depends on browser support and secure context. This is an always-on-top window, **not a fully transparent or mouse-click-through game overlay**. The site cannot dictate its window position and cannot force its native window opacity. A truly click-through transparent Windows overlay would require a separately installed desktop app, which has additional policy/compatibility considerations.

## Mesos accounting

Net mesos change = last confirmed balance − first confirmed balance. It is **not** necessarily monster mesos earned or profit adjusted for consumption. If you buy potions or other items during a session, those purchases are already reflected in the meso balance change. Only amounts visible in the inventory or manually entered are known; between snapshots, the last verified balance is displayed.

## Technical notes

- `index.html`, `styles.css` — interface.
- `app.js` plus `exp-table.js`, `digit-atlas.js`, `pixel-matcher.js`, `ui-anchors.js`, `level-atlas.js`, `level-templates.js` — EXP and level.
- `extras.js` plus `inventory-footer.js` — mesos.
- `overlay.js` — optional mini Picture-in-Picture window that only mirrors already displayed stats.

OCR depends on Tesseract.js loaded over a CDN. Data is processed locally in the browser. A failed scan preserves last verified values.