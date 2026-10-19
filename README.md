# Maple EXP Tracker — Alpha 0.2.10

A browser-based, **screen-only** MapleStory Classic World EXP, mesos, and potion tracker. The website only analyzes pixels from the window you approve for screen sharing. No game-memory reading, injection, packet access, or automated game input. Passive screen capture is not automatically authorized by Nexon's terms; check with Nexon if compliance is important.

## What's new in Alpha 0.2.10

- HP and MP hotbar scans are attempted every 2 seconds while tracking, independently of EXP and mesos.
- OCR may still take longer than 2 seconds, and overlapping scans are safely skipped. The existing multi-frame confirmations remain in place.
- No changes to EXP, level, mesos recognition or profit calculation.

## Previous work: Alpha 0.2.9

**Potion quantity recognition fix.** The digits in MapleStory's hotbar quantities are at the bottom-left of each slot, while the faint labels at the top indicate hotkeys. The primary problem in Alpha 0.2.8 was a misaligned crop: as little as one pixel made the strict digit templates fail. The reader now searches around the expected quantity area, chooses only an unambiguous high-confidence digit match, and remembers the successful alignment to reduce CPU usage in later scans.

- Separate browser OCR workers for HP and MP when the pixel templates don't recognize a quantity; they can process independently rather than blocking each other.
- OCR checks two enhanced image treatments and uses multiple matching frames before updating potion stacks. It can establish a starting balance via four consecutive high-confidence agreeing OCR readings, or three reliable template reads. Fast pixel matches continue requiring repeated independent captures.
- A small HP/MP **quantity crop preview** appears only if you expand Scan details. It never displays the full game video and has negligible overhead.
- Keeps EXP, level, mesos, and profitability calculation code unchanged.

### Validation

The revised alignment-aware digit matcher recognized all 14 quantities from seven supplied **full hotbar** screenshots (HP 43–49; MP 108–114) when each screenshot's hotbar origin was located. Simulated transitions verified a starting stack of 49 HP and subsequent confirmed decrement to 48 adds exactly one used potion. A no-network browser runtime check passed after mocking browser storage. This is **not** an end-to-end live MapleStory test. The separately supplied Lemon 104 close-up is useful for diagnosis but has not been verified as an accurately read full-window capture; unseen counts can still require correction.

### Testing steps

1. On Netlify after the latest commit is Published, refresh, share the MapleStory window, and start tracking.
2. Choose the correct HP and MP consumables in the dropdowns. Reference digit templates from the supplied screenshots are specific to **Orange Potion** in slot 1 and **Lemon** in slot 2.
3. Keep the 4×3 hotbar fully visible. Watch whether a stack count changes after several observations; calibration happens automatically for verified templates.
4. If counts don't change, open **Scan details & correction** and check the two number-crop previews and **Potion scan diagnostic**. Screenshot these small previews and the status message for a targeted follow-up.
5. Because the potions' white numbers overlap the item art, **no camera/image-only reader can guarantee perfect recognition**. Large stack changes during unreadable periods, and restock/usage between captures, may remain unaccounted for. The tracker must not invent potion costs.

### Previous fixes

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