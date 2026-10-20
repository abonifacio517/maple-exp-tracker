'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Note: the browser/OS still controls the native window toolbar for Document Picture-in-Picture.
(() => {
  const button = document.getElementById('overlayBtn');
  if (!button) return;

  let miniWindow = null, timer = null, graphOpen = false;
  const sourceValue = id => document.getElementById(id)?.textContent?.trim() || '—';
  const spriteSrc = new URL('van-sprite.svg', document.baseURI).href;
  const currentTheme = () => (window.__getMapleTheme ? window.__getMapleTheme() : (document.body.classList.contains('theme-dark') ? 'dark' : 'light'));
  // Small geometric SVG marks replace the previous bulky pixel-art assets in the HUD.
  const expMark = '<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="M3 21L10 13l5 4 10-12M18 5h7v7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const mesoMark = '<svg viewBox="0 0 56 56" width="28" height="28" aria-hidden="true"><defs><linearGradient id="hudMesoGold" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#fff1a6"/><stop offset=".45" stop-color="#fbd15a"/><stop offset="1" stop-color="#bf751e"/></linearGradient></defs><circle cx="28" cy="28" r="24" fill="#754418" stroke="#57300f" stroke-width="2"/><circle cx="27" cy="26" r="21" fill="url(#hudMesoGold)" stroke="#ffdc75" stroke-width="2"/><circle cx="27" cy="26" r="17" fill="none" stroke="#b06d26" stroke-width="1.7"/><path d="M27 10L31 19 37 16 35 22 43 26 36 30 39 36 30 33 29 43 25 43 24 33 15 36 18 30 11 26 19 22 17 16 23 19Z" fill="#a9621d" stroke="#8b4b16" stroke-width=".8" stroke-linejoin="round"/></svg>';

  const html = `
    <div class="hud-window">
      <div class="hud-brand"><img src="${spriteSrc}" alt=""><div class="hud-brand-copy"><strong>Van's EXP Tracker</strong><small>LIVE TRAINING HUD</small></div></div>
      <div class="hud-body">
        <section class="hud-card primary-card">
          <div class="card-head">${expMark}<span>EXP TRACKER</span></div>
          <div class="hud-content">
            <div class="hud-level-row">
              <div class="hud-level-title">Level <strong class="hud-level-value" id="hudLevel">—</strong></div>
              <strong class="hud-percent" id="hudPct">—</strong>
            </div>
            <div class="bar-head">Progress to next level</div>
            <div class="track" role="progressbar" aria-label="EXP progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="hudBar" class="fill"></div></div>
            <div class="bar-foot"><span id="hudExp">— / — EXP</span><span id="hudRemain">—</span></div>
            <div class="hud-metrics">
              <div class="hud-metric"><div class="mini-label">EXP / hour</div><strong id="hudPerHour">0</strong></div>
              <div class="hud-metric"><div class="mini-label">Time to level</div><strong id="hudEta">—</strong></div>
              <div class="hud-metric"><div class="mini-label">KPQ clears remaining</div><strong id="hudKpq">—</strong></div>
            </div>
          </div>
        </section>
        <section class="hud-card mesos-card">
          <div class="card-head">${mesoMark}<span>MESOS TRACKER · WIP</span></div>
          <div class="mesos-content">
            <div class="meso-amount" id="hudMesos">—</div>
            <div class="primary-caption">Net mesos change</div>
            <div class="mesos-footer"><span id="hudMesoBadge" class="pill">Awaiting inventory</span><span id="hudStatus">Waiting for tracker</span></div>
          </div>
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
    *{box-sizing:border-box}
    html,body{margin:0;width:100%;min-height:100%;height:100%}
    body{padding:5px;background:#e8f4fc;color:#243d53;user-select:none}
    body.theme-dark{background:#0d151e;color:#f6f8fb}
    .hud-window{min-height:100%;padding:10px;border:1px solid #afc9de;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(46,85,115,.12)}
    body.theme-dark .hud-window{border-color:#34485c;background:#131d29;box-shadow:0 9px 24px rgba(0,0,0,.34)}
    .hud-brand{display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:1px 4px 10px;border-bottom:1px solid #c7dceb}
    body.theme-dark .hud-brand{border-color:#34485c}
    .hud-brand img{display:block;object-fit:contain;width:43px;height:52px;flex:none}
    .hud-brand-copy{display:grid;gap:5px;min-width:0}
    .hud-brand-copy strong{font-size:15px;font-weight:900;color:#243d53;letter-spacing:-.025em}
    .hud-brand-copy small{font-size:9px;letter-spacing:.055em;color:#6b8294;font-weight:800}
    body.theme-dark .hud-brand-copy strong{color:#f6f8fb}
    body.theme-dark .hud-brand-copy small{color:#9fb4c8}
    .hud-body{display:grid;gap:9px;min-width:0}
    .hud-card{overflow:hidden;border:1px solid #bcd6e9;border-radius:14px;background:#fff}
    body.theme-dark .hud-card{border-color:#34485c;background:#131d29}
    .card-head{display:flex;align-items:center;gap:8px;min-height:37px;padding:7px 12px;background:#75a7d0;border-bottom:1px solid #8cb7d9;color:#fff;font-size:11px;font-weight:900;letter-spacing:.075em}
    body.theme-dark .card-head{background:#233e5d;border-color:#365576}
    .card-head svg{width:19px;height:19px;color:inherit;flex:none}
    .mesos-card .card-head svg{width:23px;height:23px}
    .hud-content,.mesos-content{padding:12px 13px}
    .hud-level-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}
    .hud-level-title{display:flex;align-items:center;gap:8px;font-size:21px;font-weight:900;color:#28435a;white-space:nowrap}
    body.theme-dark .hud-level-title{color:#f8fbff}
    .hud-level-value{display:inline-flex;justify-content:center;align-items:center;min-width:45px;min-height:37px;padding:3px 9px;border:2px solid #cc8124;border-radius:10px;background:linear-gradient(180deg,#ffe7a1,#ffba4b);color:#63370b;font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.025em;box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 2px 5px rgba(71,43,10,.12);font-variant-numeric:tabular-nums}
    body.theme-dark .hud-level-value{color:#63370b}
    .hud-percent{color:#327fae;font-size:14px;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
    body.theme-dark .hud-percent{color:#d5e8f9}
    .bar-head{margin:0 0 6px;color:#597186;font-size:11px;font-weight:700}
    body.theme-dark .bar-head{color:#b9ccdd}
    .track{isolation:isolate;overflow:hidden;height:23px;padding:3px;border:1px solid #93aec6;border-radius:9px;background:#e3f0f8;box-shadow:none}
    body.theme-dark .track{border-color:#455568;background:#273645}
    .fill{position:relative;width:0%;height:100%;border:0;border-radius:6px;background:linear-gradient(180deg,#d6f88a 0%,#a8e757 23%,#74c72b 69%,#54a51b 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -2px 0 rgba(45,115,18,.22);transition:width .35s ease}
    .fill::after{content:"";position:absolute;inset:0 0 auto;height:65%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.24),transparent 70%)}
    .bar-foot{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-top:9px;color:#597186;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
    .bar-foot span:last-child{text-align:right}
    body.theme-dark .bar-foot{color:#c1cede}
    .hud-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid #c2d9e9}
    body.theme-dark .hud-metrics{border-color:#34485c}
    .hud-metric{display:flex;flex-direction:column;justify-content:space-between;min-width:0;gap:9px;padding:9px 7px;border:1px solid #c2d9e9;border-radius:9px;background:#f2f9fe}
    body.theme-dark .hud-metric{background:#1b2938;border-color:#344757}
    .hud-metric .mini-label{min-height:27px;color:#5d7c91;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:.005em}
    body.theme-dark .hud-metric .mini-label{color:#c4d1e0}
    .hud-metric strong{font-size:clamp(14px,4.45vw,18px);color:#243d53;font-weight:900;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:-.02em}
    body.theme-dark .hud-metric strong{color:#f6f8fb}
    .mesos-content{padding-top:9px}
    .meso-amount{font-size:25px;line-height:1.12;font-weight:900;color:#243d53;letter-spacing:-.035em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    body.theme-dark .meso-amount{color:#f6f8fb}
    .meso-amount.positive{color:#258352}
    .meso-amount.negative{color:#bb4b58}
    body.theme-dark .meso-amount.positive{color:#7fd7a4}
    body.theme-dark .meso-amount.negative{color:#ff909a}
    .primary-caption{margin-top:5px;font-size:10px;color:#657e90;font-weight:700}
    body.theme-dark .primary-caption{color:#9eb4c8}
    .mesos-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;color:#657e90;font-size:10px;font-weight:700}
    body.theme-dark .mesos-footer{color:#9eb4c8}
    .pill{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border-radius:999px;border:1px solid #bcd6e9;background:#eaf5fc;color:#5d7c91;font-size:10px;font-weight:900;max-width:170px;text-align:center}
    body.theme-dark .pill{border-color:#34485c;background:#1c2a38;color:#bccbdd}
    .pill.positive{color:#268553}
    .pill.negative{color:#b44b58}
    body.theme-dark .pill.positive{color:#7fd7a4}
    body.theme-dark .pill.negative{color:#ff909a}
    .hud-chart-toggle{min-height:33px;width:100%;border:1px solid #b8d3e7;border-radius:9px;background:#eaf5fc;color:#315e7e;font:800 11px Verdana,Tahoma,sans-serif;cursor:pointer}
    body.theme-dark .hud-chart-toggle{border-color:#34485c;background:#1b2938;color:#c3ddf3}
    .hud-chart-toggle[aria-expanded="true"]{background:#d9effc}
    body.theme-dark .hud-chart-toggle[aria-expanded="true"]{background:#223e57}
    .hud-chart-panel{padding:12px 13px}
    .hud-chart-panel[hidden]{display:none}
    .hud-chart-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#243d53}
    body.theme-dark .hud-chart-title{color:#f6f8fb}
    .hud-chart-title small{color:#657e90;font-size:9px;font-weight:700;text-align:right}
    body.theme-dark .hud-chart-title small{color:#a7bbce}
    #hudGraph{display:block;width:100%;height:152px;margin-top:7px}
    .hud-chart-note{margin-top:3px;color:#657e90;font-size:10px}
    body.theme-dark .hud-chart-note{color:#a7bbce}
    @media(max-width:350px){.hud-metrics{gap:5px}.hud-metric{padding:9px 5px}.hud-metric strong{font-size:14px}.hud-content{padding:10px}.hud-level-title{font-size:19px}}
    @media(prefers-reduced-motion:reduce){.fill{transition:none}}
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
      const percent = Number.isFinite(w) ? Math.min(100, Math.max(0, w)) : 0;
      fill.style.width = percent + '%';
      fill.parentElement?.setAttribute('aria-valuenow', String(percent));
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