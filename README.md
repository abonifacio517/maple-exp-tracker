# Maple EXP Tracker — Alpha 0.2.19

This release is the third visual polish pass.

## What's new
- Pushed the overall UI further toward a MapleStory-inspired look.
- Refined panel styling and rounded edges so the windows feel softer and less boxy.
- Improved the dark mode with a stronger **Sleepywood-inspired** palette.
- Refined the floating mini HUD so it feels closer to an in-game Maple HUD.
- Kept the EXP badge header, mesos coin header, and glossy Maple-style EXP progress bar.
- Removed unnecessary decorative window control icons from the tracker UI.

## Tracking behavior
- EXP tracking logic is unchanged.
- Mesos tracking logic is unchanged.
- Potion tracking remains disabled while it is being redesigned.

## Deploy
This project is designed to be deployed as a static site on GitHub Pages.

The supplied pixel-art EXP and mesos images are embedded in the main page and mini HUD so they work on GitHub Pages without separate asset requests.


## Notes
- The mini HUD uses Document Picture-in-Picture. The browser's native window bar cannot be fully removed in a web-only version.
- This pass removes the extra in-app HUD title bar, refreshes the EXP and mesos header art, and improves dark-mode button contrast.