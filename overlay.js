'use strict';
// Compact browser-native always-on-top dashboard; keeps game capture and OCR in the opener.
// Document Picture-in-Picture is NOT a transparent or click-through desktop overlay.
(() => {
  const button=document.getElementById('overlayBtn');
  if(!button)return;
  let miniWindow=null,timer=null,compact=false;
  const sourceValue=id=>document.getElementById(id)?.textContent?.trim()||'—';
  const html=`
    <div class="hud-window">
      <div class="hud-titlebar">
        <div class="logo"><span class="leaf">🍁</span><div class="brand">MAPLE EXP <span>ALPHA 0.2.15</span></div></div>
        <div class="title-actions"><button id="hudCompact" class="hud-btn" title="Toggle condensed layout">Compact</button><button id="hudClose" class="hud-btn close" title="Close overlay">Close ×</button></div>
      </div>
      <div class="hud-body">
        <div class="primary">
          <div class="label">EXP PER HOUR</div>
          <div class="big" id="hudPerHour">0</div>
        </div>
        <div class="statline"><div><div class="label">TIME TO LEVEL</div><div class="figure" id="hudEta">—</div></div><div class="align-right"><div class="label">LEVEL</div><div class="figure">Lv. <span id="hudLevel">—</span></div></div></div>
        <div class="level-header"><span>LEVEL PROGRESS</span><strong id="hudPct">—</strong></div>
        <div class="track"><div id="hudBar" class="fill"></div></div>
        <div class="level-numbers"><span id="hudExp">— / — EXP</span><span id="hudRemain">—</span></div>
        <div class="mesos"><div><div class="label">NET MESOS CHANGE</div><div class="meso-amount" id="hudMesos">—</div></div><span id="hudMesoBadge" class="pill">Awaiting inventory</span></div>
        <div class="bottom"><span id="hudStatus">Waiting for tracker</span></div>
      </div>
    </div>`;
  const css=`
    :root{font-family:Verdana,Tahoma,"Trebuchet MS",Arial,sans-serif;color-scheme:light}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:auto}
    body{background:linear-gradient(180deg,#d8e8f3,#f3f8fc);color:#263b4c}
    .hud-window{display:flex;flex-direction:column;min-height:100%;padding:5px;border:3px solid #30465b;border-radius:6px;background:linear-gradient(#fff,#e4eff7);box-shadow:inset 2px 2px 0 #fff,inset -2px -2px 0 #b2c8d9}
    .hud-titlebar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 7px;margin:-2px -2px 0;min-height:41px;background:linear-gradient(#b4cadc 0%,#7395b0 34%,#557793);border-bottom:3px solid #314b62;color:#fff;box-shadow:inset 0 2px 0 #dceefa}
    .logo,.title-actions,.statline,.level-header,.level-numbers,.mesos,.bottom{display:flex;align-items:center;justify-content:space-between;gap:7px}
    .logo{justify-content:flex-start}.leaf{display:grid;place-items:center;width:29px;height:28px;background:linear-gradient(#fff8cf,#f6c254);border:2px solid #865c2a;border-radius:4px;font-size:16px}.brand{font-size:11px;font-weight:900;letter-spacing:.02em;text-shadow:1px 1px 0 #45617b}.brand span{display:block;color:#eaf4fa;font-size:9px}
    .hud-btn{border:2px solid #385974;border-radius:3px;color:#34556d;background:linear-gradient(#fff,#c3d9ea);font:900 10px Verdana,sans-serif;padding:5px 7px;cursor:pointer;box-shadow:inset 1px 1px 0 #fff,inset -1px -1px 0 #8caec6}
    .hud-btn:hover{filter:brightness(.96)}.hud-body{display:flex;flex-direction:column;gap:8px;padding:11px 9px 7px}
    .label,.level-header,.level-numbers,.bottom{font-size:10px;color:#62798a;font-weight:800;letter-spacing:.01em;text-transform:uppercase}
    .primary,.statline,.mesos{border:2px solid #a8bbc9;border-radius:3px;background:linear-gradient(#fff,#f0f6fa);padding:10px 11px;box-shadow:inset 2px 2px 0 #fff,inset -2px -2px 0 #dce6ee}
    .primary .big{font-size:clamp(32px,10vw,47px);font-weight:900;color:#3b78a9;letter-spacing:-.06em;line-height:1.1;text-shadow:1px 2px 0 #deeff8;font-variant-numeric:tabular-nums;margin-top:4px}
    .figure{font-size:20px;font-weight:900;color:#bb7712;font-variant-numeric:tabular-nums}.align-right{text-align:right}.level-header strong{color:#aa6b0c}
    .track{height:17px;border:3px solid #354b5b;border-radius:3px;background:linear-gradient(#536674,#85919a);padding:2px;box-shadow:inset 0 1px 2px #172e40}
    .fill{height:100%;width:0%;border-radius:1px;background:linear-gradient(#fffca0,#d5f17b 30%,#8dcf32);box-shadow:inset 0 1px 0 #fff;transition:width .4s ease}
    .level-numbers{text-transform:none;letter-spacing:0}
    .meso-amount{font-size:26px;color:#526c7e;font-weight:900;font-variant-numeric:tabular-nums;margin-top:3px}.meso-amount.positive{color:#428e58}.meso-amount.negative{color:#c64e52}
    .pill{font-size:9px;font-weight:800;color:#587389;background:linear-gradient(#fff,#ddecf7);border:2px solid #738ea7;border-radius:3px;padding:5px;white-space:nowrap}
    .pill.positive{border-color:#71a47a;background:#e6f7e8;color:#417c4e}.pill.negative{border-color:#c78b8b;background:#ffe8e8;color:#b74f4f}
    .bottom{padding:0 4px 2px;font-size:10px;text-transform:none}
    body.compact .hud-body{gap:5px;padding:8px 7px 5px}body.compact .primary .big{font-size:30px}body.compact .meso-amount{font-size:21px}body.compact .level-numbers,body.compact .bottom{display:none}
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
    miniWindow=null;button.textContent='↗ Open maple HUD';button.setAttribute('aria-pressed','false');
  }
  button.addEventListener('click',async()=>{
    if(miniWindow&&!miniWindow.closed){miniWindow.close();closed();return;}
    if(!('documentPictureInPicture' in window)){
      setStatus('Mini overlay requires a desktop Chrome/Edge browser that supports Document Picture-in-Picture.','warn');return;
    }
    try{
      const pip=await window.documentPictureInPicture.requestWindow({width:360,height:360});
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
      button.textContent='× Close maple HUD';button.setAttribute('aria-pressed','true');
      update();timer=setInterval(update,700);
    }catch(error){
      closed();setStatus('Could not open mini overlay: '+(error?.message||String(error)),'warn');
    }
  });
})();