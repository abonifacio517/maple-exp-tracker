# Maple EXP Tracker — Alpha 0.2.8

A browser-based, **screen-only** MapleStory Classic World EXP, mesos, and potion tracker. The website only analyzes pixels from the window you approve for screen sharing. No game-memory reading, injection, packet access, or automated game input. Passive screen capture is not automatically authorized by Nexon's terms; check with Nexon if compliance is important.

## Changes from Alpha 0.2.7

### Inventory can move to the corners

- A dedicated *mesos footer detector* now looks for the white balance field, golden coin emblem, and blue inventory footer rails anywhere in the shared game frame. It is not dependent on the top bar or the whole inventory being visible.
- Supports fully visible inventories in any screen position, plus some partial offscreen placements **when the mesos digits themselves remain visible**. If the number is covered or outside the shared frame, no read is possible; the previous confirmed balance is preserved.
- Detection and OCR use the same frozen frame. If the inventory moves during OCR startup, the detector reacquires the footer instead of calling it "closed" solely because the old position has changed.
- This change does not modify the actual OCR algorithm or meso balance confirmation requirements (two matching captures). EXP and level readers remain untouched.

### Automatic HP/MP digit recognition

- Added a digit-level pixel reference library extracted from seven real supplied hotbar screenshots showing Orange Potion and Lemon quantities `49–43` and `114–108`.
- Unlike the older whole-stack reference matcher, the new matcher handles number positions separately. It can recognize some combinations of already-known digit shapes which were **not** trained as whole numbers.
- Very strict shape-error and runner-up separation thresholds prevent a new/unrecognized digit from being forced into a memorized value. If no confident pixel match exists, the old cautious OCR and stored-calibration fallback remains available.
- For these specific calibrated consumables, a starting count can be confirmed automatically after three matching frame captures. For other items or uncertain stacks, the manual baseline and correction remain available.
- Verified quantity decreases are included in potion-cost estimates; possible missed uses (while hidden, restocked, or during unreadable frames) cannot be reconstructed reliably.

## Testing performed

- Independent footer recognition and field cropping on synthetic screenshots with inventory at the top-left, middle, and bottom-right; a partly offscreen left/top inventory; a right-clipped inventory where mesos are still visible; and 80% / 125% scaled versions. A game screenshot without inventory returns no false footer in these tests.
- All fourteen reference stack counts (HP 43–49 and MP 108–114) recognized by the per-digit reader. A deliberately corrupted glyph was rejected. A synthetic mix of known MP digit glyphs was correctly recognized in 6 of 7 tested combinations; the seventh was rejected rather than misclassified.
- JavaScript syntax checks passed. **An end-to-end live browser/game session was not available in the test environment**, so actual in-game tracking remains to be verified by the player.

## Using the tracker

1. Open the Netlify website in Chrome or Edge and share the MapleStory window.
2. Select **Orange Potion** for HP and **Lemon** for MP to use the included specialized digit library. Other consumables still work through the earlier OCR / manual confirmation path.
3. Open the inventory anywhere in the game. The tracker tries to find the footer every ~2 seconds and uses two matching reads before updating mesos.
4. Keep the two consumables in the **top-left** and **second-from-left** cells of the first hotbar row, with the 4×3 hotbar visible.
5. Use the expanded scan details if the program shows "unverified"—these rejections are deliberate safeguards. The selected NPC prices affect the estimated potion value and profit.

## Technical / deployment

Static HTML, CSS and JS; no build command. The EXP module, level module and net-profit accounting code are preserved from Alpha 0.2.7. This release adds `inventory-footer.js`, `potion-digits.js`, and `potion-digit-reader.js`, and changes `extras.js`, `potion-reader.js`, and `index.html`.

No perfect OCR guarantee: sprites, display scaling, overlay interference, and variations in potion background can still make numeric readings ambiguous. The tracker keeps the last verified count rather than guessing. The Netlify deployment must be confirmed separately from a successful GitHub push.