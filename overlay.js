'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Document Picture-in-Picture is NOT a transparent or click-through desktop overlay.
(() => {
  const button=document.getElementById('overlayBtn');
  if(!button)return;
  let miniWindow=null,timer=null,compact=false;
  const sourceValue=id=>document.getElementById(id)?.textContent?.trim()||'—';
  const html=`
    <div class="hud">
      <div class="hud-head"><div class="logo"><span class="star">✦</span><div class="brand">MAPLE EXP <span>· ALPHA 0.2.14</span></div></div><button id="hudCompact" class="hud-btn" title="Toggle condensed layout">Compact</button></div>
      <div class="primary">
        <div class="label">EXP PER HOUR</div>
        <div class="big" id="hudPerHour">0</div>
      </div>
      <div class="statline"><div><div class="label">TIME TO LEVEL</div><div class="figure" id="hudEta">—</div></div><div class="align-right"><div class="label">LEVEL</div><div class="figure">Lv. <span id="hudLevel">—</span></div></div></div>
      <div class="level-header"><span>LEVEL PROGRESS</span><strong id="hudPct">—</strong></div>
      <div class="track"><div id="hudBar" class="fill"></div></div>
      <div class="level-numbers"><span id="hudExp">— / — EXP</span><span id="hudRemain">—</span></div>
      <div class="mesos"><div><div class="label">NET MESOS CHANGE</div><div class="meso-amount" id="hudMesos">—</div></div><span id="hudMesoBadge" class="pill">Awaiting inventory</span></div>
      <div class="bottom"><span id="hudStatus">Waiting for tracker</span><button id="hudClose" class="hud-btn close" title="Close overlay">Close ×</button></div>
    </div>`;
  const css=`
    :root{color-scheme:dark;font-family:Inter,'Segoe UI',Arial,sans-serif}
    *{box-sizing:border-box}html,body{margin:0;height:100%;width:100%;overflow:auto;background:#101820;color:#f1f6f7}
    .hud{min-width:240px;min-height:240px;padding:14px 17px 11px;background:linear-gradient(160deg,#16242d,#101820 80%);height:100%;display:flex;flex-direction:column;gap:9px}
    .hud-head,.logo,.statline,.level-header,.level-numbers,.mesos,.bottom{display:flex;align-items:center;justify-content:space-between;gap:7px}
    .logo{justify-content:start;gap:6px}.star{color:#f6c34a;font-size:20px}.brand{font-size:11px;font-weight:850;letter-spacing:.075em}.brand span{color:#7a919c;font-size:9px}
    .hud-btn{background:#22323c;color:#b9ccd4;border:1px solid #3a505c;border-radius:7px;padding:6px 9px;font:600 10px inherit;cursor:pointer;font-size:10px}
    .hud-btn:hover{background:#2e4250}.label,.level-header,.level-numbers,.bottom{font-size:10px;color:#93aab7;font-weight:650;letter-spacing:.03em}
    .primary .big{font-size:clamp(34px,10vw,49px);font-weight:850;letter-spacing:-.055em;line-height:1.05;color:#f3f7f5;font-variant-numeric:tabular-nums}
    .statline{padding:4px 0 6px;border-bottom:1px solid #2b3e48}.figure{font-size:18px;font-weight:800;color:#f3d88a;font-variant-numeric:tabular-nums}.align-right{text-align:right}
    .level-header{margin-top:1px}.level-header strong{color:#f3d88a;font-variant-numeric:tabular-nums}
    .track{height:10px;background:#39434b;border-radius:100px;overflow:hidden;box-shadow:inset 0 1px 3px #0a0f12}.fill{height:100%;width:0%;background:linear-gradient(90deg,#ffb523,#f9d663);border-radius:inherit;transition:width .5s ease}
    .level-numbers{letter-spacing:0;font-variant-numeric:tabular-nums;font-weight:500}
    .mesos{border-top:1px solid #2b3e48;padding:10px 0 1px;align-items:center}.meso-amount{font-size:26px;font-weight:850;font-variant-numeric:tabular-nums;letter-spacing:-.03em;color:#c9d9de}.meso-amount.positive{color:#80e2a6}.meso-amount.negative{color:#ffa096}
    .pill{font-size:9px;color:#9fb0b9;background:#1b2a35;border:1px solid #344958;padding:5px 7px;border-radius:30px;white-space:nowrap}
    .pill.positive{color:#80e2a6;border-color:#315d43}.pill.negative{color:#ffa096;border-color:#74413a}
    .bottom{margin-top:auto;border-top:1px solid #253843;padding-top:9px;text-transform:none;font-weight:400}.close{padding:4px 7px}
    body.compact .hud{padding:10px 14px;gap:6px}body.compact .statline{padding:1px 0 3px}body.compact .primary .big{font-size:31px}body.compact .mesos{padding-top:6px}body.compact .meso-amount{font-size:22px}body.compact .level-numbers,body.compact .bottom{display:none}
    @media(prefers-reduced-motion:reduce){.fill{transition:none}}
  `;
  function update(){
    if(!miniWindow||miniWindow.closed)return;
    const doc=miniWindow.document,at=id=>doc.getElementById(id);
    const mapped={hudPerHour:'perHour',hudEta:'eta',hudLevel:'characterLevel',hudPct:'progressLabel',hudExp:'expFraction',hudRemain:'expRemaining',hudMesos:'netProfit'};
    for(const [to,from] of Object.entries(mapped)){const node=at(to);if(node)node.textContent=sourceValue(from);}
    const fill=at('hudBar');if(fill){const original=document.getElementById('progressBar');const w=parseFloat(original?.style?.width||'');fill.style.width=Number.isFinite(w)?Math.min(100,Math.max(0,w))+'%':'0%';}
    const meso=document.getElementById('netProfit'),cl=meso?.className||'',val=at('hudMesos'),badge=at('hudMesoBadge');
    const kind=cl.includes('profit-positive')?'positive':cl.includes('profit-negative')?'negative':'';
    if(val)val.className='meso-amount '+kind;
    if(badge){badge.className='pill '+kind;badge.textContent=sourceValue('profitBadge');}
    const status=at('hudStatus');if(status)status.textContent=sourceValue('readingBadge')+' · '+(sourceValue('sharePill')||'');
  }
  function closed(){
    if(timer!==null){clearInterval(timer);timer=null;}
    miniWindow=null;button.textContent='↗ Open mini overlay';button.setAttribute('aria-pressed','false');
  }
  button.addEventListener('click',async()=>{
    if(miniWindow&&!miniWindow.closed){miniWindow.close();closed();return;}
    if(!('documentPictureInPicture' in window)){
      setStatus('Mini overlay requires a desktop Chrome/Edge browser that supports Document Picture-in-Picture.','warn');return;
    }
    try{
      // Must be invoked directly from the click handler to retain user activation.
      const pip=await window.documentPictureInPicture.requestWindow({width:355,height:355});
      miniWindow=pip;
      pip.document.title='Maple EXP · Mini overlay';
      const style=pip.document.createElement('style');style.textContent=css;
      pip.document.head.appendChild(style);
      pip.document.body.innerHTML=html;
      pip.document.getElementById('hudClose').addEventListener('click',()=>pip.close());
      pip.document.getElementById('hudCompact').addEventListener('click',()=>{
        compact=!compact;pip.document.body.classList.toggle('compact',compact);
        pip.document.getElementById('hudCompact').textContent=compact?'Expand':'Compact';
      });
      pip.addEventListener('pagehide',closed,{once:true});
      button.textContent='× Close mini overlay';button.setAttribute('aria-pressed','true');
      update();timer=setInterval(update,700);
    }catch(error){
      closed();setStatus('Could not open mini overlay: '+(error?.message||String(error)),'warn');
    }
  });
})();