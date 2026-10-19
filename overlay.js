'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Note: the browser/OS still controls the native window toolbar for Document Picture-in-Picture.
(() => {
  const button = document.getElementById('overlayBtn');
  if (!button) return;

  let miniWindow = null, timer = null, compact = false;
  const sourceValue = id => document.getElementById(id)?.textContent?.trim() || '—';
  const currentTheme = () => (window.__getMapleTheme ? window.__getMapleTheme() : (document.body.classList.contains('theme-dark') ? 'dark' : 'light'));
  const expArtSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARQAAABUCAYAAABDX8ihAAAEiUlEQVR4nO3dS2hUZxjG8ZOL15ikk4RWgxmHJAYljliNFxShuBAXXiApGtFaWmwrXfaC1LYuCqmKIiiCotKWiK5U0F2iuHGh0SatMbYupkFMYlNM0tpi4qWNXbSr8nytn31Pzkz8/5ZPJt/5OJN5OOTlnAkCAAAAAAAAAAAAAAAAAAAAAAAAACMhK+oN/FNRYvaTqPcAZIqBW+1p9RnOjnoDAEYPCgWAGQoFgBkKBYAZCgWAmdyoDuya5lTOmidfXzK5LNT9AOmsr7dL5qkgkJ+jqKY/XKEAMEOhADBDoQAwQ6EAMEOhADAT+pTHapqzYdMmu02FaN2Scpn3//bAZP3u/kGZ3xt8JPPKKQUyv/hdr9dxCyeOlfmiqhdl3nytW+ZrF/udH9eNXdlZeojR1tnnWP+hY6Vo1JVu83p97c4ZXq+PavrDFQoAMxQKADMUCgAzFAoAMxQKADOR3ctjdW/OyzPiJuu4fHPzttfrh4f1XCJZs1TmiYrp3nuS689dIPMP36mXeUvzaZkvXF4r83nlJTJvutwh892fN8j81XMnZe57fioS+n3/5L23Zd52LSXzaeWVMs8Urs9RqqN1hHfyF65QAJihUACYoVAAmKFQAJihUACYiWzK4+t4Y6POR3gf/2VNzUcyd01/SsqqTI77491fZL73qJ6qbFm7Uuanmi7IvDiYK/OPt26VeVnlTJk/eqzvOfI9P/f+kHEwtXSyzA/ueVPmyUWv6IVCdjzwuzcnU3CFAsAMhQLADIUCwAyFAsAMhQLATMZMefBsunv1E8w6e3T+7sY1Mn/j/R0yHzd+oszzC4ueYnfPbs5M/eS3zq6fZP5g6H6Y28HfuEIBYIZCAWCGQgFghkIBYIZCAWCGKY+xMbk5Mj9z4rDM82PFXut/dfq8zG/+0OW1TkH+JJkPP9H31PTf6ZT5tKpqr+P6np+CmH5S3P0h/T0+Dfu/lHlefuFT7A7/F1coAMxQKADMUCgAzFAoAMxQKADMRDbl6evVUwmr7+uJyuPf9aPEVtdvlvmkwpjJcePT9bRlYc0cmedNGC/z7bsOyLzh0w9kvvuLszLPHTNW5mGfn5xc/SddUa2fOJfpXJ+jqHCFAsAMhQLADIUCwAyFAsAMhQLATOhTnoFb7VkqTwWBvmnEIdOnP1nZurur5y81WT/Hsf5b61bIfPueIzL/+spVmb9eXyvzipfyZN79q9fbG/r5mTBOT52GHurvCUo3rmlOqqNV5q7PXdi4QgFghkIBYIZCAWCGQgFghkIBYCaS/wT/m6LEbL/xQJrp+f6KzFu/va5/wfMduNrWLvP+gQGZF8f0vTCf7dqnt5OtNzS1dIrMTzYelPmyVetlfqNFP3EuMWux1358nTp2SOZ1r20xWT8qUU1zXLhCAWCGQgFghkIBYIZCAWCGQgFgJq3+QzyaxeLJQceP9FjI3yVHfteRyy+8+fn29W0+B43Fk3HHj5oceY0j73Hs5wWf/fiKxZPNjuMuD/O4oxVXKADMUCgAzFAoAMxQKADMUCgAAAAAAAAAAAAA8Fz7E+pV4TwoL82KAAAAAElFTkSuQmCC';
  const mesosArtSrc = 'data:image/png;base64,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';

  const html = `
    <div class="hud-window">
      <div class="hud-controls">
        <button id="hudCompact" class="hud-btn" title="Toggle condensed layout">Compact</button>
        <button id="hudClose" class="hud-btn close" title="Close overlay">Close ×</button>
      </div>
      <div class="hud-body">
        <section class="hud-card primary-card">
          <div class="card-head"><img src="${expArtSrc}" alt="EXP"><span>EXP TRACKER</span></div>
          <div class="primary-number" id="hudPerHour">0</div>
          <div class="primary-caption">EXP per hour</div>
          <div class="split-line">
            <div><div class="mini-label">Time to level</div><div class="mini-figure" id="hudEta">—</div></div>
            <div class="align-right"><div class="mini-label">Current level</div><div class="mini-figure">Lv. <span id="hudLevel">—</span></div></div>
          </div>
          <div class="bar-head"><span>Level progress</span><strong id="hudPct">—</strong></div>
          <div class="track"><div id="hudBar" class="fill"></div></div>
          <div class="bar-foot"><span id="hudExp">— / — EXP</span><span id="hudRemain">—</span></div>
        </section>
        <section class="hud-card mesos-card">
          <div class="card-head"><img src="${mesosArtSrc}" alt="Mesos"><span>MESOS TRACKER</span></div>
          <div class="meso-amount" id="hudMesos">—</div>
          <div class="primary-caption">Net mesos change</div>
          <div class="mesos-footer"><span id="hudMesoBadge" class="pill">Awaiting inventory</span><span id="hudStatus">Waiting for tracker</span></div>
        </section>
      </div>
    </div>`;

  const css = `
    :root{font-family:Verdana,Tahoma,"Trebuchet MS",Arial,sans-serif}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
    body{padding:6px;background:linear-gradient(180deg,#cde2f8,#eff6fd);color:#293948;user-select:none}
    body.theme-dark{background:linear-gradient(180deg,#2a2637,#181a22);color:#f1f5fb}
    .hud-window{position:relative;display:flex;flex-direction:column;min-height:100%;padding:42px 6px 6px;border:3px solid #30475f;border-radius:24px;background:linear-gradient(180deg,#fbfeff,#e8f1f8);box-shadow:0 16px 30px rgba(67,94,122,.18), inset 0 2px 0 rgba(255,255,255,.92)}
    body.theme-dark .hud-window{border-color:#181a23;background:linear-gradient(180deg,#454055,#2f3240);box-shadow:0 16px 30px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.08)}
    .hud-controls{position:absolute;top:10px;right:10px;z-index:2;display:flex;gap:8px}
    .split-line,.bar-head,.bar-foot,.mesos-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .hud-btn{border:2px solid #385974;border-radius:999px;background:linear-gradient(180deg,#ffffff,#dfeaf3);color:#35556d;font:900 11px Verdana,sans-serif;padding:6px 10px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
    body.theme-dark .hud-btn{background:linear-gradient(180deg,#5f5973,#45495a);color:#eef5ff;border-color:#1d2131;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
    .hud-body{display:grid;gap:10px;padding:0}
    .hud-card{border:2px solid #8ea8bf;border-radius:18px;padding:14px;background:linear-gradient(180deg,#f9fbfe,#edf4fa);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
    .primary-card{position:relative;overflow:hidden}
    .primary-card::after{content:"";position:absolute;right:-12px;top:-8px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.32), transparent 68%);pointer-events:none}
    body.theme-dark .hud-card{border-color:#857e98;background:linear-gradient(180deg,#37374a,#2b2d39);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
    .card-head{display:flex;align-items:center;gap:10px;color:#647889;font-size:11px;font-weight:900;letter-spacing:.06em}
    body.theme-dark .card-head{color:#d2d4e1}.card-head img{image-rendering:pixelated;image-rendering:crisp-edges}.card-head img:first-child{width:72px;height:auto}.mesos-card .card-head img{width:28px;height:auto}
    .primary-number{font-size:clamp(30px,10vw,44px);line-height:1;font-weight:900;color:#356fa3;letter-spacing:-.06em;margin:8px 0 4px;font-variant-numeric:tabular-nums}
    body.theme-dark .primary-number{color:#a8d3ff}.primary-caption,.mini-label,.bar-foot,.mesos-footer{color:#647889;font-size:11px;font-weight:800}
    body.theme-dark .primary-caption,body.theme-dark .mini-label,body.theme-dark .bar-foot,body.theme-dark .mesos-footer{color:#d2d4e1}
    .mini-figure{margin-top:4px;color:#bc7414;font-size:19px;font-weight:900;font-variant-numeric:tabular-nums}.align-right{text-align:right}
    body.theme-dark .mini-figure{color:#f4c15b}.bar-head{margin:12px 0 7px;color:#293948;font-size:11px;font-weight:900}.bar-head strong{color:#bc7414}
    body.theme-dark .bar-head{color:#eef4fb}body.theme-dark .bar-head strong{color:#f4c15b}
    .track{position:relative;isolation:isolate;overflow:hidden;height:28px;padding:4px;border:2px solid #46525d;border-radius:12px;background:linear-gradient(180deg,#f6fafc 0%,#d3dbe1 10%,#7d8b96 28%,#47535c 48%,#8797a2 78%,#ecf1f5 92%,#b9c5ce 100%);box-shadow:0 2px 0 rgba(255,255,255,.75), inset 0 1px 0 rgba(255,255,255,.9)}
    .track::before{content:"";position:absolute;inset:4px;border-radius:6px;z-index:0;background:linear-gradient(180deg,#a7afb6,#6e777f 56%,#c4cbd1);box-shadow:inset 0 2px 3px rgba(26,38,47,.55)}
    .fill{position:relative;z-index:1;width:0%;height:100%;border-radius:6px;border:1px solid #6c9604;background:repeating-linear-gradient(90deg,transparent 0 30px,rgba(86,112,5,.28) 31px 32px,transparent 33px 34px), linear-gradient(180deg,#fffbb0 0%,#edf96a 16%,#caeb1e 40%,#95c708 68%,#6e9b05 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.85), inset 0 -2px 0 rgba(88,123,5,.8), 0 0 6px rgba(215,239,103,.35);transition:width .35s ease}
    .fill::after{content:"";position:absolute;left:0;right:0;top:0;height:45%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.08))}
    .meso-amount{font-size:31px;line-height:1.05;font-weight:900;color:#526c7e;letter-spacing:-.05em;margin:10px 0 4px;font-variant-numeric:tabular-nums;word-break:break-word}
    body.theme-dark .meso-amount{color:#e0e8f1}.meso-amount.positive{color:#458f5a}.meso-amount.negative{color:#cb575d}
    .pill{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;border:2px solid #30475f;background:linear-gradient(180deg,#f7fbff,#e6eef5);color:#647889;font-size:10px;font-weight:900;max-width:170px;text-align:center}
    body.theme-dark .pill{background:linear-gradient(180deg,#4b455b,#3a3d4e);color:#e2e7ef;border-color:#1d2131}.pill.positive{color:#458f5a}.pill.negative{color:#cb575d}
    body.compact .hud-window{padding-top:38px}body.compact .hud-body{gap:8px}body.compact .primary-number{font-size:30px}body.compact .meso-amount{font-size:25px}body.compact .primary-caption,body.compact .bar-foot{display:none}
    @media(prefers-reduced-motion:reduce){.fill{transition:none}}
  `;

  function syncTheme(doc){
    doc.body.classList.toggle('theme-dark', currentTheme() === 'dark');
  }

  function update(){
    if (!miniWindow || miniWindow.closed) return;
    const doc = miniWindow.document, at = id => doc.getElementById(id);
    const mapped = {
      hudPerHour: 'perHour',
      hudEta: 'eta',
      hudLevel: 'characterLevel',
      hudPct: 'progressLabel',
      hudExp: 'expFraction',
      hudRemain: 'expRemaining',
      hudMesos: 'netProfit'
    };
    for (const [to, from] of Object.entries(mapped)) {
      const node = at(to);
      if (node) node.textContent = sourceValue(from);
    }
    const fill = at('hudBar');
    if (fill) {
      const original = document.getElementById('progressBar');
      const w = parseFloat(original?.style?.width || '');
      fill.style.width = Number.isFinite(w) ? Math.min(100, Math.max(0, w)) + '%' : '0%';
    }
    const meso = document.getElementById('netProfit'), cl = meso?.className || '', val = at('hudMesos'), badge = at('hudMesoBadge');
    const kind = cl.includes('profit-positive') ? 'positive' : cl.includes('profit-negative') ? 'negative' : '';
    if (val) val.className = 'meso-amount ' + kind;
    if (badge) { badge.className = 'pill ' + kind; badge.textContent = sourceValue('profitBadge'); }
    const status = at('hudStatus');
    if (status) status.textContent = sourceValue('readingBadge') + ' · ' + (sourceValue('sharePill') || '');
    syncTheme(doc);
  }

  function closed(){
    if (timer !== null) { clearInterval(timer); timer = null; }
    miniWindow = null;
    button.textContent = '↗ Open maple HUD';
    button.setAttribute('aria-pressed', 'false');
  }

  button.addEventListener('click', async () => {
    if (miniWindow && !miniWindow.closed) {
      miniWindow.close();
      closed();
      return;
    }
    if (!('documentPictureInPicture' in window)) {
      setStatus('Mini overlay requires a desktop Chrome/Edge browser that supports Document Picture-in-Picture.', 'warn');
      return;
    }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 372, height: 392 });
      miniWindow = pip;
      pip.document.title = 'Maple EXP · Mini overlay';
      const style = pip.document.createElement('style');
      style.textContent = css;
      pip.document.head.appendChild(style);
      pip.document.body.innerHTML = html;
      syncTheme(pip.document);
      pip.document.getElementById('hudClose').addEventListener('click', () => pip.close());
      pip.document.getElementById('hudCompact').addEventListener('click', () => {
        compact = !compact;
        pip.document.body.classList.toggle('compact', compact);
        pip.document.getElementById('hudCompact').textContent = compact ? 'Expand' : 'Compact';
      });
      pip.addEventListener('pagehide', closed, { once: true });
      button.textContent = '× Close maple HUD';
      button.setAttribute('aria-pressed', 'true');
      update();
      timer = setInterval(update, 700);
    } catch (error) {
      closed();
      setStatus('Could not open mini overlay: ' + (error?.message || String(error)), 'warn');
    }
  });
})();