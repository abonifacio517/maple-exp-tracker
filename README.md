# Maple EXP Tracker — Alpha 0.2.4

## Expanded automatic level detection (1–100)

The screen-only tracker now recognizes level badges through three stages:

1. **Actual MapleStory pixel templates**: fast and accurate for digits already learned. The bundled reference images currently supply digits **3** and **4**, confirmed against the supplied screenshot of level 34.
2. **Independent level-only OCR**: for unfamiliar digits, three white-glyph preprocessing passes must agree. If the whole-number read is inconclusive, each badge glyph gets its own isolated OCR passes. This reader uses a separate Tesseract worker and does not change EXP or mesos OCR settings.
3. **Learned pixels**: after three successive, consistent level readings from separate screen captures, the tracker can store new digit shapes locally for future runs. The manual verified-template button remains available if a digit fails OCR.

Levels **1–100 are supported in the recognition and validation logic**, including one-, two- and three-digit levels. EXP requirements continue to cover levels 1–99; level 100 is a cap without a next-level percentage.

## Protections

- Two independent agreeing level reads are required to update the dashboard.
- While playing, automatic recognition may repeat the current level or detect **current level + 1**; implausible jumps are rejected.
- After a detected level increase, the tracker waits for the EXP counter to reset before changing the EXP requirement and counting a level-up.
- An unverified digit leaves the last confirmed level unchanged. A manual level override remains available.
- Nothing reads game memory, process data, files or packets or sends inputs to the game.

## Existing systems unchanged

- EXP: every 5 seconds, pixel-template recognition and conservative OCR backup.
- Mesos: independent OCR loop, approximately every 2 seconds, with two-frame confirmation.
- Potions: experimental hotbar recognition with verified manual snapshots available.
- No continuous game preview or server-side screenshot upload.

## Testing limitation

The level-34 **pixel templates** were validated using actual supplied screenshots and multiple crop sizes. New-level fallbacks were tested with deterministic synthetic/mocked OCR for **1, 9, 10, 35, 80, 99 and 100** and level continuity checks. **We do not yet have real badge screenshots of all numerals 0–9**, so actual accuracy at other levels cannot be guaranteed until live tested. The tracker should prefer a visible unverified state to silently accepting an unsupported digit.

To test: refresh the published site, re-share the MapleStory game window, click **Try auto-detecting level again** if manual level mode is active, and wait for two reads. If the new level is not recognized, check Scan details and use Set level / Save verified level-digit sample.