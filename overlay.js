'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Document Picture-in-Picture is NOT a transparent or click-through desktop overlay.
(() => {
  const button = document.getElementById('overlayBtn');
  if (!button) return;

  let miniWindow = null, timer = null, compact = false;
  const sourceValue = id => document.getElementById(id)?.textContent?.trim() || '—';
  const currentTheme = () => (window.__getMapleTheme ? window.__getMapleTheme() : (document.body.classList.contains('theme-dark') ? 'dark' : 'light'));

  const html = `
    <div class="hud-window">
      <div class="hud-titlebar">
        <div class="logo-wrap">
          <span class="leaf">🍁</span>
          <div>
            <div class="brand">MAPLE EXP</div>
            <div class="brand-sub">ALPHA 0.2.18</div>
          </div>
        </div>
        <div class="title-actions">
          <button id="hudCompact" class="hud-btn" title="Toggle condensed layout">Compact</button>
          <button id="hudClose" class="hud-btn close" title="Close overlay">Close ×</button>
        </div>
      </div>
      <div class="hud-body">
        <section class="hud-card primary-card">
          <div class="card-head"><img src="data:image/png;base64,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" alt="EXP"><span>EXP TRACKER</span></div>
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
          <div class="card-head"><img src="data:image/png;base64,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" alt="Mesos"><span>MESOS TRACKER</span></div>
          <div class="meso-amount" id="hudMesos">—</div>
          <div class="primary-caption">Net mesos change</div>
          <div class="mesos-footer"><span id="hudMesoBadge" class="pill">Awaiting inventory</span><span id="hudStatus">Waiting for tracker</span></div>
        </section>
      </div>
    </div>`;

  const css = `
    :root{font-family:Verdana,Tahoma,"Trebuchet MS",Arial,sans-serif}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}
    body{padding:8px;background:linear-gradient(180deg,#cde2f8,#eff6fd);color:#293948}
    body.theme-dark{background:linear-gradient(180deg,#2a2637,#181a22);color:#f1f5fb}
    .hud-window{display:flex;flex-direction:column;min-height:100%;padding:6px;border:3px solid #30475f;border-radius:24px;background:linear-gradient(180deg,#fbfeff,#e8f1f8);box-shadow:0 16px 30px rgba(67,94,122,.18), inset 0 2px 0 rgba(255,255,255,.92)}
    body.theme-dark .hud-window{border-color:#181a23;background:linear-gradient(180deg,#454055,#2f3240);box-shadow:0 16px 30px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.08)}
    .hud-titlebar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:19px 19px 14px 14px;background:linear-gradient(180deg,#d8e6f2 0%,#8eb1cd 30%,#6e96b6 68%,#5b7f9d 100%);border:2px solid #36526b;color:#fff;box-shadow:inset 0 2px 0 rgba(255,255,255,.7)}
    body.theme-dark .hud-titlebar{background:linear-gradient(180deg,#7a7892 0%,#5b5872 36%,#41475c 74%,#32384b 100%);border-color:#171b28}
    .logo-wrap,.title-actions,.split-line,.bar-head,.bar-foot,.mesos-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .logo-wrap{justify-content:flex-start}.leaf{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(180deg,#fff7cc,#ffd86a 60%,#e8a93f);border:2px solid #77592a;font-size:20px}
    .brand{font-size:14px;font-weight:900;letter-spacing:.08em}.brand-sub{font-size:10px;font-weight:800;opacity:.9}
    .hud-btn{border:2px solid #385974;border-radius:14px;background:linear-gradient(180deg,#ffffff,#dfeaf3);color:#35556d;font:900 11px Verdana,sans-serif;padding:7px 10px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
    body.theme-dark .hud-btn{background:linear-gradient(180deg,#5f5973,#45495a);color:#eef5ff;border-color:#1d2131;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
    .hud-body{display:grid;gap:10px;padding:10px 4px 4px}
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
    body.compact .hud-body{gap:8px;padding:8px 2px 2px}body.compact .primary-number{font-size:30px}body.compact .meso-amount{font-size:25px}body.compact .primary-caption,body.compact .bar-foot{display:none} body.compact .hud-titlebar{padding:8px 10px}
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
      const pip = await window.documentPictureInPicture.requestWindow({ width: 380, height: 430 });
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