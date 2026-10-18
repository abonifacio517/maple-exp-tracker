# Maple EXP Tracker — Alpha 0.2.1

Small corrective update to Alpha 0.2.0. EXP recognition is unchanged.

## Improvements

- Mesos: keeps the inventory-window detector and reads an unaltered, tightly cropped number (with a grayscale comparison). Requires the same recognized balance in **two independent screen captures** before showing it as confirmed.
- Mesos fallback: type and save a verified balance manually if OCR has no reliable candidate. Later snapshots update the net balance change.
- Potions: tries tighter crops of the item-count overlays with darker-pixel processing. Because a multi-digit number could be partially read, **the potion tracker requires you to set a first verified count** before accepting automatic updates. It rejects low-confidence OCR and implausible sudden drops.
- Potion fallback: type the actual HP and MP quantities into their fields whenever you open the tracker or need to update them. A lower amount than a previously confirmed count is added to **observed usage**; a higher amount is considered a restock. Changes that happened between unobserved inventory transactions cannot be reconstructed.
- Replaced indefinite 'verifying' messages with diagnostic hints, including tentative mesos readings and detailed OCR outputs under **Scan details & correction**.

## Test steps

1. Reload your Netlify page after the deploy shows **Published**, then share the MapleStory window.
2. Confirm EXP is still updating normally. This code has not changed the EXP recognition pipeline.
3. Open the inventory and leave it visible for at least two scans (usually 10–20 seconds). The mesos section should show your balance if it can read the counter. If not, enter the exact balance with **Save snapshot**.
4. Keep the first two hotbar slots visible. Automatic potion counts remain experimental. If the values don't confirm, use the two manual stack fields. For example, enter 5 and 123 as starting quantities *only if those are the counts currently visible in game*. Later manual snapshots tally verified decreases.
5. When auto readings are still uncertain, expand **Scan details & correction** and report the **Mesos scan diagnostic** and **Potion scan diagnostic** text. This helps improve subsequent alpha builds without guessing.

## Accuracy and policy

No pixel recognition approach can guarantee perfect readings. This update refuses ambiguous values and does not backfill unobserved spending or potion use. We do not access client processes, memory, packets, or controls. Passive screen capture still does not itself guarantee compliance with MapleStory Worlds policies. All image analysis happens in your browser after the game window is explicitly shared. The Tesseract.js library is loaded from a CDN.