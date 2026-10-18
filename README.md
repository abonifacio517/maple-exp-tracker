# Maple EXP Tracker — Alpha 0.2.3

## Improved level detection
- Corrected the level crop position: the previous reference box missed the orange level badge by over 100 pixels.
- Uses orange-badge pixel templates first; supplied digit samples include **3** and **4** from the user's screenshot. Other glyphs invoke a separate level-only OCR worker.
- Level recognition is independent of EXP and mesos OCR. The initial level must match in two separate captures before use.
- An unknown or conflicting digit is **not** guessed. Manual Set level remains available. You can optionally save a verified level digit sample in Scan details after entering your exact visible level.
- EXP scanning stays at 5 seconds, mesos scanning stays at 2 seconds, and percentage is still computed using EXP / level requirement.
- No game injection, memory read, client file access, or automatic gameplay actions.

## Live test limitations
- Tested against the user's level-34 close-up and full-window screenshots, plus scaled crops and a wrong-location rejection.
- Only two level glyph templates are available initially. New digits can trigger OCR fallback; this still requires validation against the live MapleStory HUD.
- Screen-only capture is not an explicit guarantee of compliance with game rules.

## Mesos responsiveness (Alpha 0.2.2)
- Inventory balance is recognized by a separate Tesseract OCR worker rather than waiting for the EXP scan to finish.
- The application attempts a meso scan every 2 seconds while tracking. The first capture initializes the worker and may take longer.
- It accepts a new balance only after two independent consecutive readable frames match; unclear readings preserve the last confirmed number.
- The number crop excludes the adjacent `MESOS` word. Capture remains screen-only with user permission.
- When the inventory is hidden, the tracker keeps the last confirmed balance and searches periodically for the window to reappear.
- EXP scanning is unchanged at 5-second intervals; potion tracking is unchanged in this patch.