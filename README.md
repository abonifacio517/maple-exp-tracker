# Maple EXP — Live Tracker (v4.0)

A minimal browser-based MapleStory Classic World EXP tracker. The dashboard automatically identifies the EXP readout and level percentage in a shared MapleStory window, then attempts OCR about every five seconds.

## Install / deploy

This is a static site (no build step). Publish `index.html`, `styles.css`, and `app.js` in the same root directory. Netlify can deploy this repository directly with the publish directory set to `.` and no build command.

## Using it

1. Open the site in up-to-date Chrome or Edge on a desktop computer (HTTPS required for window sharing).
2. Click **Share game window** and select your MapleStory window.
3. Leave the game EXP bar visible. Auto-detection locates EXP and percentage; OCR attempts a read every five seconds.
4. Keep the share active and check the preview/scan status. If HUD detection fails, use **Find EXP again** or open the manual fallback selector.
5. Advanced OCR controls and scan diagnostics are collapsible.

## Notes

- OCR and screenshots are processed in your own browser. The page loads Tesseract.js and OCR assets from third-party CDNs; the code itself has no upload endpoint.
- Screen capture requires your permission each session. Minimized game windows may not produce fresh frames.
- Small fonts can be misread; the software rejects conflicting OCR results and allows manual correction. Accuracy is not guaranteed.
- Does not inject into the game or read memory or network packets. This alone does not guarantee compliance with the game's rules.