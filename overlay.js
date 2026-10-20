'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Note: the browser/OS still controls the native window toolbar for Document Picture-in-Picture.
(() => {
  const button = document.getElementById('overlayBtn');
  if (!button) return;

  let miniWindow = null, timer = null, graphOpen = false;
  const sourceValue = id => document.getElementById(id)?.textContent?.trim() || '—';
  const currentTheme = () => (window.__getMapleTheme ? window.__getMapleTheme() : (document.body.classList.contains('theme-dark') ? 'dark' : 'light'));
  // Small geometric SVG marks replace the previous bulky pixel-art assets in the HUD.
  const expMark = '<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="M3 21L10 13l5 4 10-12M18 5h7v7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const mesoMark = '<svg viewBox="0 0 28 28" width="21" height="21" aria-hidden="true"><circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 8h-6a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8h-6M14 4v20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const html = `
    <div class="hud-window">
      <div class="hud-body">
        <section class="hud-card primary-card">
          <div class="card-head">${expMark}<span>EXP TRACKER</span><span class="hud-level-chip">Lv. <span id="hudLevel">—</span></span></div>
          <div class="bar-head"><span>Level progress</span><strong id="hudPct">—</strong></div>
          <div class="track"><div id="hudBar" class="fill"></div></div>
          <div class="bar-foot"><span id="hudExp">— / — EXP</span><span id="hudRemain">—</span></div>
          <div class="hud-metrics">
            <div class="hud-metric"><div class="mini-label">EXP / hour</div><strong id="hudPerHour">0</strong></div>
            <div class="hud-metric"><div class="mini-label">Time to level</div><strong id="hudEta">—</strong></div>
            <div class="hud-metric"><div class="mini-label">KPQ clears remaining</div><strong id="hudKpq">—</strong></div>
          </div>
        </section>
        <section class="hud-card mesos-card">
          <div class="card-head">${mesoMark}<span>MESOS TRACKER · WIP</span></div>
          <div class="meso-amount" id="hudMesos">—</div>
          <div class="primary-caption">Net mesos change</div>
          <div class="mesos-footer"><span id="hudMesoBadge" class="pill">Awaiting inventory</span><span id="hudStatus">Waiting for tracker</span></div>
        </section>
        <button type="button" id="hudGraphToggle" class="hud-chart-toggle" aria-expanded="false" aria-controls="hudGraphPanel">Show EXP/min graph <span aria-hidden="true">▾</span></button>
        <section id="hudGraphPanel" class="hud-card hud-chart-panel" hidden>
          <div class="hud-chart-title">EXP per minute <small>Experimental · confirmed gains</small></div>
          <canvas id="hudGraph" role="img" aria-label="EXP gained per minute over the last 20 minutes"></canvas>
          <div id="hudGraphNote" class="hud-chart-note">Collecting EXP readings…</div>
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
    body.theme-dark .card-head{color:#d2d4e1}.hud-level-chip{margin-left:auto;white-space:nowrap;font-weight:900;color:#bc7414}.theme-dark .hud-level-chip{color:#f4c15b}.card-head img{image-rendering:pixelated;image-rendering:crisp-edges}.card-head img:first-child{width:72px;height:auto}.mesos-card .card-head img{width:28px;height:auto}
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
    /* Compact, spaced three-column stats and an optional on-demand line graph. */
    .hud-window{padding:12px 6px 8px;min-height:100%}
    .hud-body{gap:9px}
    .card-head svg{flex:none;color:#356fa3}.theme-dark .card-head svg{color:#a8d3ff}
    .hud-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid #a8bfd0;margin-top:16px;padding-top:14px}
    .theme-dark .hud-metrics{border-color:#65677d}
    .hud-metric{min-width:0;padding:0 9px;border-right:1px solid #a8bfd0;display:flex;flex-direction:column;gap:7px}
    .hud-metric:first-child{padding-left:0}.hud-metric:last-child{padding-right:0;border:0}
    .theme-dark .hud-metric{border-color:#65677d}
    .hud-metric .mini-label{font-size:10px;line-height:1.35;min-height:27px;text-transform:none;letter-spacing:.01em}
    .hud-metric strong{font-size:clamp(15px,5vw,19px);line-height:1.2;font-weight:900;color:#bc7414;font-variant-numeric:tabular-nums;white-space:nowrap}
    .theme-dark .hud-metric strong{color:#f4c15b}
    .hud-chart-toggle{width:100%;min-height:32px;border:1px solid #8ea8bf;border-radius:11px;background:transparent;color:#426b89;font:bold 11px Verdana,sans-serif;cursor:pointer}
    .theme-dark .hud-chart-toggle{border-color:#857e98;color:#d7dcf0}
    .hud-chart-toggle[aria-expanded="true"]{background:rgba(98,143,184,.12)}
    .hud-chart-panel{padding:11px 12px}
    .hud-chart-panel[hidden]{display:none}
    .hud-chart-title{font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .hud-chart-title small{font-size:9px;font-weight:700;color:#647889}
    .theme-dark .hud-chart-title small{color:#cbd0dd}
    #hudGraph{display:block;width:100%;height:152px;margin-top:7px}
    .hud-chart-note{font-size:10px;color:#647889;margin-top:3px}
    .theme-dark .hud-chart-note{color:#cbd0dd}
  `;

  function syncTheme(doc){
    doc.body.classList.toggle('theme-dark', currentTheme() === 'dark');
  }


  function drawGraph(doc){
    const panel=doc.getElementById('hudGraphPanel');
    if(!graphOpen||!panel||panel.hidden)return;
    const canvas=doc.getElementById('hudGraph'),note=doc.getElementById('hudGraphNote');
    if(!canvas)return;
    const raw=typeof state!=='undefined'&&Array.isArray(state.expMinuteHistory)?state.expMinuteHistory:[];
    const now=Date.now(),currentMinute=Math.floor(now/60000),firstMinute=currentMinute-19;
    const values=Array(20).fill(0),observed=new Set();
    for(const entry of raw){
      if(!entry||!Number.isFinite(entry.ts)||!Number.isFinite(entry.amount)||entry.amount<=0)continue;
      const i=Math.floor(entry.ts/60000)-firstMinute;
      if(i>=0&&i<20){values[i]+=entry.amount;observed.add(i);}
    }
    const width=Math.max(255,Math.round(canvas.getBoundingClientRect().width||320)),height=152;
    const ratio=Math.min(2,doc.defaultView?.devicePixelRatio||1);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    const ctx=canvas.getContext('2d');
    ctx.scale(ratio,ratio);
    const dark=doc.body.classList.contains('theme-dark');
    const grid=dark?'#606679':'#cad8e3',ink=dark?'#d6d9e7':'#627889',line=dark?'#a8d3ff':'#367eae';
    const pad={left:42,right:10,top:10,bottom:23},w=width-pad.left-pad.right,h=height-pad.top-pad.bottom;
    ctx.font='10px Verdana, sans-serif';ctx.lineWidth=1;
    let max=Math.max(...values);if(max<=0)max=100;
    const magnitude=Math.pow(10,Math.floor(Math.log10(max)));
    const ceiling=Math.ceil(max/magnitude)*magnitude;
    const label=n=>n>=1000?(n/1000).toFixed(n%1000?1:0)+'k':String(Math.round(n));
    for(let k=0;k<=2;k++){
      const y=pad.top+h-k*h/2;ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();
      ctx.fillStyle=ink;ctx.textAlign='right';ctx.fillText(label(ceiling*k/2),pad.left-6,y+3);
    }
    ctx.fillStyle=ink;ctx.textAlign='left';ctx.fillText('20m ago',pad.left,height-4);ctx.textAlign='right';ctx.fillText('Now',width-pad.right,height-4);
    if(observed.size){
      ctx.beginPath();
      values.forEach((v,i)=>{const x=pad.left+w*i/19,y=pad.top+h-h*v/ceiling;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      ctx.strokeStyle=line;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
      const x=pad.left+w,y=pad.top+h-h*values[19]/ceiling;
      ctx.beginPath();ctx.arc(x,y,2.6,0,Math.PI*2);ctx.fillStyle=line;ctx.fill();
      note.textContent='Last 20 one-minute intervals · confirmed EXP only';
    }else note.textContent='Collecting confirmed EXP gains. A graph will appear after your first gain.';
  }

  function resizeHud(){
    if(!miniWindow||miniWindow.closed)return;
    try{if(typeof miniWindow.resizeTo==='function')miniWindow.resizeTo(graphOpen?430:390,graphOpen?620:440);}
    catch(_error){/* Browser may prohibit resizing; the window remains scrollable. */}
  }

  function update(){
    if (!miniWindow || miniWindow.closed) return;
    const doc = miniWindow.document, at = id => doc.getElementById(id);
    const mapped = {
      hudPerHour: 'perHour',
      hudEta: 'eta',
      hudKpq: 'kpqClears',
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
    if(graphOpen)drawGraph(doc);
  }

  function closed(){
    if (timer !== null) { clearInterval(timer); timer = null; }
    miniWindow = null;graphOpen=false;
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
      const pip = await window.documentPictureInPicture.requestWindow({ width: 390, height: 440 });
      miniWindow = pip;
      pip.document.title = "Van's Maple EXP Tracker · HUD";
      const style = pip.document.createElement('style');
      style.textContent = css;
      pip.document.head.appendChild(style);
      pip.document.body.innerHTML = html;
      syncTheme(pip.document);
      pip.document.getElementById('hudGraphToggle').addEventListener('click',()=>{
        graphOpen=!graphOpen;
        const toggle=pip.document.getElementById('hudGraphToggle');
        toggle.setAttribute('aria-expanded',String(graphOpen));
        toggle.innerHTML=(graphOpen?'Hide EXP/min graph':'Show EXP/min graph')+' <span aria-hidden="true">'+(graphOpen?'▴':'▾')+'</span>';
        pip.document.getElementById('hudGraphPanel').hidden=!graphOpen;
        resizeHud();
        if(graphOpen)drawGraph(pip.document);
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