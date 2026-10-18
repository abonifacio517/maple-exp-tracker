MAPLE EXP TRACKER - AUTO HUD (WEB v3.0)
=====================================

WHAT'S NEW
- No need to draw a box during normal use.
- After you share your MapleStory game window, the website searches the bottom HUD for the static EXP label.
- It uses the bright-green brackets shown around your percentage to separate the EXP number from the percentage.
- It starts OCR automatically once the two regions are found.
- OCR tries several image treatments and requires matching numbers before accepting a reading.
- EXP and percentage are re-read approximately every five seconds while tracking. If processing takes longer, scans will not overlap.
- If you resize the shared game capture, the HUD region is detected again.
- A manual fallback remains for unfamiliar HUD layouts or resolutions.

HOW TO UPDATE YOUR NETLIFY WEBSITE
1. Extract this ZIP. It contains index.html, app.js, styles.css, and exp_anchor_template.png.
2. Sign in to Netlify, open your existing site, and find the Deploys section.
3. Upload/drag the extracted folder with all four files for a manual deployment.
4. Refresh your site's URL (Ctrl+F5 if you see the old version).
5. Open MapleStory in windowed mode with the bottom EXP bar visible.
6. Click 'Share game window', then choose the MapleStory WINDOW rather than a browser tab.
7. The website should detect the EXP label, outline EXP in green and percentage in blue, and start reading automatically.
8. You can click 'Find EXP again' if you change the game's size or HUD.

TROUBLESHOOTING
- No EXP found: Ensure the whole bottom EXP status panel is visible, choose the game WINDOW in screen sharing, and click 'Find EXP again'.
- OCR unclear: Open the OCR details panel to see the enlarged crops and accepted/rejected readings. Try 6x or 8x enlargement.
- Different UI skin: Use the optional manual selection controls under the preview.
- Zero EXP/hour: It needs two correctly recognized EXP readings that differ before a gain is computed; allow at least ten seconds and defeat some monsters.
- A blank window when minimized: Browsers may pause window capture while a window is minimized; restore MapleStory.
- The first scan may be slow because Tesseract.js needs to download its OCR engine.

PRIVACY AND SAFETY
- Screenshots are analyzed in the browser. The app has no upload endpoints and does not send frames to our server.
- Tesseract.js is fetched over the internet from a public CDN; it runs OCR locally.
- No game process access, memory reading, packet inspection, or game inputs.
- Screen-only behavior is not a guarantee of compliance with MapleStory/Nexon rules.

TEST STATUS
- The EXP-label locator and automatic green-bracket separation were tested against the reference screenshot and scaled variations (80%, 125%, 65%).
- JavaScript syntax was checked. OCR was also tried on crops from the reference screenshot using a native Tesseract test tool, not in a live browser.
- This version has NOT been run against a live MapleStory stream. Please report any detection or OCR failures.
