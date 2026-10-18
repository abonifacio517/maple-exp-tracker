# Maple EXP Tracker — Alpha 0.2.5

## Mesos locator reliability patch

The mesos display stays in the same *relative* area of the movable inventory, but the game window, inventory position and UI scaling can vary. This patch:

- Locates the floating inventory using the existing visual title/header anchor.
- Scans the inventory footer for the actual white mesos textbox, then uses its right edge and the first dark digit to define a tightly bounded OCR crop. Never uses an absolute screen coordinate for the balance.
- Locates and reads the mesos field from **one frozen capture frame**, avoiding mismatches when the inventory moves between selection and image processing.
- Reads the enhanced crops with raw, grayscale, and contrast-threshold variants, accepting only valid comma-grouped or plain integer numbers.
- Requires two separate frames to agree before updating a balance. If the field is covered or text is unclear, holds the last confirmed balance.
- Reacquires a moved inventory within the independent 2-second scan loop and shows the location/reading diagnostics in the Scan Details panel.

EXP OCR, level matching, potion tracking and the existing yellow EXP bar are unchanged. This is still a read-only screen-capture web application and does not access the game process, memory or send inputs.

### Tested

- Header locator + relative footer OCR rectangle found the supplied inventory image at its original position, at x=280/y=100 in a larger test screen, and when scaled to 80% at x=410/y=125.
- Tightly-cropped Tesseract sample tests read **427,993** and **466,629** from the user's supplied screenshots.
- JavaScript syntax and number parsing checks passed.

### Still to test in MapleStory

The live browser-screen-sharing and Tesseract.js behavior still needs a real game test. The program may skip numbers if game scaling differs, the inventory is covered, or OCR is uncertain. Use the Mesos scan diagnostic to see **Inventory match**, **Mesos field**, and **OCR** outputs. The previous confirmed mesos amount will remain until the next verified reading.
