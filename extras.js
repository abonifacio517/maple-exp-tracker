'use strict';
// Optional net-mesos and consumable measurements. Works only with browser-provided
// video frames; never accesses MapleStory processes, memory, files, or controls.
const extras={inventory:null,hotbar:null,lastFind:0,inventoryOpen:false,
  mesosStart:null,mesosCurrent:null,mesoPending:null,mesoWhen:null,mesoStartWhen:null,
  hpCurrent:null,mpCurrent:null,hpUsed:0,mpUsed:0,
  pending:{hp:null,mp:null},potionWhen:null,lastError:'',lastMesoAttempt:0,lastPotionAttempt:0,turn:0,lastInvFind:0,lastHotFind:0};
function anchorMatcher(spec,s,kind){
  const pts=spec.points.filter((p,i)=>i%(kind==='hotbar'?5:2)===0).map(([x,y,v])=>[Math.round(x*s),Math.round(y*s),v]);
  const n=pts.length,mean=pts.reduce((sum,p)=>sum+p[2],0)/n;
  let tt=0;for(const p of pts){p[2]-=mean;tt+=p[2]*p[2];}
  return {pts,n,tt,w:Math.round(spec.w*s),h:Math.round(spec.h*s),scale:s};
}
function anchorScore(frame,m,x,y){
  const W=frame.width,p=frame.data,pts=m.pts,n=m.n;
  let a=0,aa=0,ab=0;
  for(const [dx,dy,t] of pts){
    const j=((y+dy)*W+(x+dx))*4;
    const g=(p[j]*77+p[j+1]*150+p[j+2]*29)/256;
    a+=g;aa+=g*g;ab+=g*t;
  }
  return (aa-a*a/n)>1 ? ab/Math.sqrt((aa-a*a/n)*m.tt) : 0;
}
// Coarse-to-fine search. Do not infer a location unless the structural patch
// matches strongly enough. The whole user-shared frame can be scanned for UI.
function findVisualAnchor(frame,kind){
  const spec=MAPLE_UI_ANCHORS[kind];let best={score:-1};
  const scales=[1,.8,1.25,.65,1.5];
  // Two-stage scan: a small sparse probe for each exact candidate coordinate,
  // followed by a complete structural check only for promising candidates.
  for(const s of scales){
    const full=anchorMatcher(spec,s,kind);
    const fast={...full,pts:full.pts.filter((p,i)=>i%5===0)};
    fast.n=fast.pts.length;
    const mean=fast.pts.reduce((a,p)=>a+p[2],0)/fast.n;
    let variance=0;for(const p of fast.pts){p[2]-=mean;variance+=p[2]*p[2];}
    fast.tt=variance;
    const maxX=frame.width-full.w,maxY=frame.height-full.h;
    if(maxX<0||maxY<0)continue;
    const minY=kind==='hotbar'?Math.floor(frame.height*.35):0;
    for(let y=minY;y<=maxY;y++)for(let x=0;x<=maxX;x++){
      if(kind==='inventory'){
        // Cheap color-gate using the distinctive blue inventory close button
        // and the pale inventory title. This avoids brute-force OCR/scanning.
        const p=frame.data,W=frame.width;
        let j=((y+Math.round(30*s))*W+x+Math.round(306*s))*4;
        if(!(p[j+2]>165&&p[j+1]>105&&p[j+2]>p[j]*1.35))continue;
        j=((y+Math.round(27*s))*W+x+Math.round(150*s))*4;
        if(!(p[j]>195&&p[j+1]>195&&p[j+2]>195))continue;
        j=((y+Math.round(37*s))*W+x+Math.round(10*s))*4;
        if(!(p[j]>90&&p[j]<240&&p[j+2]>p[j]))continue;
      }
      const coarse=anchorScore(frame,fast,x,y);
      if(coarse<.73)continue;
      const score=anchorScore(frame,full,x,y);
      if(score>best.score)best={x,y,score,s,m:full};
      if(score>.985)return best;
    }
  }
  const needed=kind==='hotbar'?.75:.80;
  return best.score>=needed?best:null;
}
function relativeRect(anchor,x,y,w,h){
  return {x:Math.round(anchor.x+x*anchor.s),y:Math.round(anchor.y+y*anchor.s),
    w:Math.max(5,Math.round(w*anchor.s)),h:Math.max(5,Math.round(h*anchor.s))};
}
function customCrop(rect){
  if(!rect || rect.x<0||rect.y<0||rect.x+rect.w>video.videoWidth||rect.y+rect.h>video.videoHeight)return null;
  const w=rect.w*6,h=rect.h*6;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  ctx.drawImage(video,rect.x,rect.y,rect.w,rect.h,0,0,w,h);
  return canvas;
}
// Read a SMALL numeric crop. Inventory text is black on a plain white HUD;
// potion quantity is white-outlined text over item artwork and therefore
// cannot safely be treated as the same OCR problem.
function snapshotImage(rect,style){
  if(!rect || rect.x<0 || rect.y<0 || rect.x+rect.w>video.videoWidth || rect.y+rect.h>video.videoHeight)return null;
  const factor=7,pad=24;
  const raw=document.createElement('canvas');raw.width=rect.w;raw.height=rect.h;
  const cx=raw.getContext('2d',{willReadFrequently:true});cx.drawImage(video,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
  const out=document.createElement('canvas');out.width=raw.width*factor+pad*2;out.height=raw.height*factor+pad*2;
  const ctx=out.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);
  if(style==='raw'){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(raw,pad,pad,raw.width*factor,raw.height*factor);
    return out;
  }
  const pixels=cx.getImageData(0,0,raw.width,raw.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    let v;
    if(style==='gray') v=Math.round(.299*r+.587*g+.114*b);
    else if(style==='dark85')v=Math.max(r,g,b)<92?0:255;
    else if(style==='dark115')v=Math.max(r,g,b)<118?0:255;
    else v=(.299*r+.587*g+.114*b)<160?0:255;
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;
  }
  cx.putImageData(pixels,0,0);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(raw,pad,pad,raw.width*factor,raw.height*factor);
  return out;
}
async function recognizeSnapshot(rect,worker,kind='mesos'){
  const modes=kind==='mesos'?['raw','gray']:['dark85','dark115','raw'];
  const details=[],candidates=[];
  await worker.setParameters({
    tessedit_char_whitelist:'0123456789,',
    tessedit_pageseg_mode:kind==='mesos'?Tesseract.PSM.SINGLE_LINE:Tesseract.PSM.SINGLE_WORD
  });
  for(const mode of modes){
    const image=snapshotImage(rect,mode);
    if(!image)return {value:null,note:'Selected number crop is outside the game window.'};
    const out=await worker.recognize(image);
    const raw=String(out.data.text||'').trim();
    const digits=raw.replace(/\D/g,'');
    const value=/^[\d,\s.]*$/.test(raw)&&digits.length>0&&digits.length<14?Number(digits):null;
    const confidence=Math.round(Number(out.data.confidence)||0);
    details.push(`${mode}: ${JSON.stringify(raw)} => ${value??'?'} (${confidence}% OCR)`);
    if(value!==null&&Number.isSafeInteger(value)&&confidence>=48)candidates.push({value,confidence,mode});
  }
  const frequencies=new Map();
  for(const c of candidates)frequencies.set(c.value,(frequencies.get(c.value)||0)+1);
  const agreement=candidates.find(c=>(frequencies.get(c.value)||0)>=2);
  // The normal (unaltered) inventory crop is the most legible one. It may
  // disagree with thresholding, so accept it as a *candidate* but require
  // independent confirmation from a later video frame before displaying it.
  const rawCandidate=kind==='mesos'?candidates.find(c=>c.mode==='raw'&&c.confidence>=55):null;
  const best=agreement || rawCandidate || null;
  return {value:best?.value??null,
    note:details.join(' | ')+(best?(agreement?' | preprocessing agrees':' | checking again on next frame'):' | no reliable OCR candidate')};
}
function showExtraStats(){
  $('mesoBalance').textContent=extras.mesosCurrent===null?'—':fmt(extras.mesosCurrent);
  $('mesoDelta').textContent=extras.mesosStart===null||extras.mesosCurrent===null?'—':
    `${extras.mesosCurrent-extras.mesosStart>=0?'+':''}${fmt(extras.mesosCurrent-extras.mesosStart)}`;
  const hours=extras.mesoWhen&&extras.mesoStartWhen?(extras.mesoWhen-extras.mesoStartWhen)/3600000:0;
  $('mesoPerHour').textContent=hours>1/3600?fmt(Math.round((extras.mesosCurrent-extras.mesosStart)/hours)):'—';
  $('mesoScanStatus').textContent=extras.inventoryOpen?
    (extras.mesoWhen?'Inventory visible · confirmed '+extras.mesoWhen.toLocaleTimeString():extras.mesoPending?'Inventory found · confirming '+fmt(extras.mesoPending.value)+'…':'Inventory found · unreadable balance (see diagnostics)'):
    (extras.mesoWhen?'Inventory closed · last confirmed '+extras.mesoWhen.toLocaleTimeString():'Waiting for inventory');
  $('hpCount').textContent=extras.hpCurrent===null?'—':fmt(extras.hpCurrent);
  $('mpCount').textContent=extras.mpCurrent===null?'—':fmt(extras.mpCurrent);
  $('hpUsed').textContent=fmt(extras.hpUsed);
  $('mpUsed').textContent=fmt(extras.mpUsed);
  const hpPrice=Number($('hpPrice').value)||0,mpPrice=Number($('mpPrice').value)||0;
  $('potionValue').textContent=fmt(Math.round(extras.hpUsed*hpPrice+extras.mpUsed*mpPrice));
  $('potStatus').textContent=extras.hotbar?
    (extras.potionWhen?'Hotbar found · checked '+extras.potionWhen.toLocaleTimeString():'Hotbar found · set starting counts below for verification'):
    'Searching for hotbar (first two top slots)';
}
function acceptMesos(value){
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return false;
  const prev=extras.mesoPending;
  extras.mesoPending=prev?.value===value?{value,count:prev.count+1}:{value,count:1};
  // Important: agreement in different image filters is NOT independent evidence.
  // Require two separate scans showing the same balance, preventing one mistaken
  // OCR result from being silently treated as a confirmed balance.
  if(extras.mesoPending.count<2)return false;
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=value;extras.mesoWhen=new Date();return true;
}
function acceptPotion(kind,value){
  if(!Number.isSafeInteger(value)||value<0||value>9999)return false;
  const old=extras[kind+'Current'],p=extras.pending[kind];
  // Potion glyphs sit on artwork. Two independent *frames*, not just two
  // image filters of the same frame, must agree before a new count is accepted.
  extras.pending[kind]=p?.value===value?{value,count:p.count+1}:{value,count:1};
  if(extras.pending[kind].count<2)return false;
  // Without a known baseline, OCR can consistently misread part of a stacked
  // multi-digit count (e.g. 123 as 2). Ask for one explicit starting count.
  if(old===null){extras.lastError='Confirm starting potion quantities below before automatic updates can be trusted.';return false;}
  if(value<old){
    const used=old-value;
    if(used>Math.max(15,Math.ceil(old*.20))){
      extras.lastError=`${kind.toUpperCase()}: rejected sudden ${old} → ${value} (${used} items). Use manual correction if this was real.`;
      return false;
    }
    extras[kind+'Used']+=used;
  }
  extras[kind+'Current']=value;extras.potionWhen=new Date();
  extras.lastError='';return true;
}
function resetExtras(){
  Object.assign(extras,{inventory:null,hotbar:null,lastFind:0,inventoryOpen:false,
    mesosStart:null,mesosCurrent:null,mesoPending:null,mesoWhen:null,mesoStartWhen:null,
    hpCurrent:null,mpCurrent:null,hpUsed:0,mpUsed:0,pending:{hp:null,mp:null},
    potionWhen:null,lastError:'',lastMesoAttempt:0,lastPotionAttempt:0,turn:0,lastInvFind:0,lastHotFind:0});
  showExtraStats();
}
async function scanExtras(worker){
  if(!state.running||!state.stream)return;
  const now=Date.now();
  extras.turn++;
  // Only a still frame is examined, not a continuously rendered preview.
  const frame=framePixels();
  function anchorStillVisible(hit){
    return hit && hit.x+hit.m.w<=frame.width && hit.y+hit.m.h<=frame.height
      && anchorScore(frame,hit.m,hit.x,hit.y)>.77;
  }
  if(now-extras.lastInvFind>4500){
    extras.inventory=anchorStillVisible(extras.inventory)?extras.inventory:findVisualAnchor(frame,'inventory');
    extras.lastInvFind=now;
  }
  if(now-extras.lastHotFind>15000){
    extras.hotbar=anchorStillVisible(extras.hotbar)?extras.hotbar:findVisualAnchor(frame,'hotbar');
    extras.lastHotFind=now;
  }
  const inv=extras.inventory;
  extras.inventoryOpen=!!inv;
  if(inv&&now-extras.lastMesoAttempt>4500){
    const crop=relativeRect(inv,196,427,75,27);
    const read=await recognizeSnapshot(crop,worker,'mesos');extras.lastMesoAttempt=Date.now();
    if(read?.value!==null&&read?.value!==undefined)acceptMesos(read.value);
    else extras.mesoPending=null;
    $('mesoDebug').textContent=(read?.note||'No readable mesos detected')+'\n' +(extras.mesoPending?`Independent captures agreeing: ${extras.mesoPending.count}/2`: 'Waiting for a clean candidate');
  }else if(!inv){extras.mesoPending=null;}
  const hb=extras.hotbar;
  if(hb&&(!inv||extras.turn%2===0)&&now-extras.lastPotionAttempt>4500){
    // Tight glyph rows reduce potion artwork getting into the crop.
    const hp=await recognizeSnapshot(relativeRect(hb,10,40,13,14),worker,'potion');
    const mp=await recognizeSnapshot(relativeRect(hb,66,40,34,14),worker,'potion');
    extras.lastPotionAttempt=Date.now();
    if(hp?.value!==null&&hp?.value!==undefined)acceptPotion('hp',hp.value);else extras.pending.hp=null;
    if(mp?.value!==null&&mp?.value!==undefined)acceptPotion('mp',mp.value);else extras.pending.mp=null;
    $('potDebug').textContent=`HP ${hp?.note||'unreadable'}\nMP ${mp?.note||'unreadable'}\nConfirmations: HP ${extras.pending.hp?.count||0}/2 · MP ${extras.pending.mp?.count||0}/2`;
  }
  if(extras.lastError)$('potDebug').textContent+='\n'+extras.lastError;
  showExtraStats();
}
for(const field of ['hpPrice','mpPrice']){
  const saved=localStorage.getItem('mapleAlpha_'+field);
  if(saved!==null&&Number.isFinite(Number(saved)))$(field).value=saved;
  $(field).addEventListener('input',()=>{
    const val=Math.max(0,Math.min(100000000,Math.floor(Number($(field).value)||0)));
    localStorage.setItem('mapleAlpha_'+field,String(val));showExtraStats();
  });
}
$('resetExtraBtn').addEventListener('click',()=>{
  resetExtras();setStatus('Mesos and potion counters reset; EXP session unchanged.','good');
});
showExtraStats();

$('teachDigitsBtn').addEventListener('click',()=>{
  const result=teachEXPFromVisible($('templateExpInput').value);
  $('templateStatus').textContent=result.reason;
  if(result.ok){$('templateExpInput').value='';setStatus('EXP digit calibration saved locally.','good');}
});

// Manual readings provide a transparent fallback when the sprite overlaps the
// quantity text. No missing potion usage is inferred from unobserved snapshots.
function safeAmount(raw,max){
  const text=String(raw||'').trim().replace(/,/g,'');
  if(!/^\d+$/.test(text))return null;
  const number=Number(text);return Number.isSafeInteger(number)&&number<=max?number:null;
}
$('setMesoSnapshot').addEventListener('click',()=>{
  const value=safeAmount($('manualMesoBalance').value,1000000000000);
  if(value===null){$('mesoDebug').textContent='Enter an exact non-negative meso balance.';return;}
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=value;extras.mesoWhen=new Date();extras.mesoPending=null;
  $('manualMesoBalance').value='';$('mesoDebug').textContent='Manual meso snapshot saved. Net change is based on confirmed snapshots.';showExtraStats();
});
$('setPotionSnapshot').addEventListener('click',()=>{
  const hp=safeAmount($('manualHPStack').value,9999),mp=safeAmount($('manualMPStack').value,9999);
  if(hp===null||mp===null){$('potDebug').textContent='Enter both exact HP and MP stack counts.';return;}
  // These are explicitly observed stack snapshots: count decreases between
  // confirmed snapshots contribute to uses. Restocks do not subtract uses.
  // Larger jumps are allowed here because a person typed and verified them.
  if(extras.hpCurrent!==null&&hp<extras.hpCurrent)extras.hpUsed+=extras.hpCurrent-hp;
  if(extras.mpCurrent!==null&&mp<extras.mpCurrent)extras.mpUsed+=extras.mpCurrent-mp;
  extras.hpCurrent=hp;extras.mpCurrent=mp;extras.pending={hp:null,mp:null};
  extras.potionWhen=new Date();extras.lastError='';
  $('manualHPStack').value='';$('manualMPStack').value='';
  $('potDebug').textContent='Manual stacks saved. Observed decreases were counted; increases treated as restocks.';showExtraStats();
});