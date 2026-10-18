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
async function recognizeSnapshot(rect,worker){
  const crop=customCrop(rect);if(!crop)return null;
  const variants=['gray','binary','alternate'],counts=new Map(),notes=[];
  await worker.setParameters({tessedit_char_whitelist:'0123456789,',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE});
  for(const type of variants){
    const output=await worker.recognize(enhance(crop,type));
    const raw=String(output.data.text||'').trim();
    const value=readCandidates(raw),confidence=Math.round(Number(output.data.confidence)||0);
    notes.push(`${type}: ${raw} → ${value??'?'} (${confidence}%)`);
    if(value!==null&&confidence>=60)counts.set(value,(counts.get(value)||0)+1);
    if([...counts.values()].some(n=>n>=2))break;
  }
  const valid=[...counts.entries()].filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]);
  return valid.length===1?{value:valid[0][0],note:notes.join(' | ')}:{value:null,note:'Uncertain: '+notes.join(' | ')};
}
function showExtraStats(){
  $('mesoBalance').textContent=extras.mesosCurrent===null?'—':fmt(extras.mesosCurrent);
  $('mesoDelta').textContent=extras.mesosStart===null||extras.mesosCurrent===null?'—':
    `${extras.mesosCurrent-extras.mesosStart>=0?'+':''}${fmt(extras.mesosCurrent-extras.mesosStart)}`;
  const hours=extras.mesoWhen&&extras.mesoStartWhen?(extras.mesoWhen-extras.mesoStartWhen)/3600000:0;
  $('mesoPerHour').textContent=hours>1/3600?fmt(Math.round((extras.mesosCurrent-extras.mesosStart)/hours)):'—';
  $('mesoScanStatus').textContent=extras.inventoryOpen?
    (extras.mesoWhen?'Inventory visible · last confirmed '+extras.mesoWhen.toLocaleTimeString():'Inventory found · verifying balance…'):
    (extras.mesoWhen?'Inventory closed · last confirmed '+extras.mesoWhen.toLocaleTimeString():'Waiting for inventory');
  $('hpCount').textContent=extras.hpCurrent===null?'—':fmt(extras.hpCurrent);
  $('mpCount').textContent=extras.mpCurrent===null?'—':fmt(extras.mpCurrent);
  $('hpUsed').textContent=fmt(extras.hpUsed);
  $('mpUsed').textContent=fmt(extras.mpUsed);
  const hpPrice=Number($('hpPrice').value)||0,mpPrice=Number($('mpPrice').value)||0;
  $('potionValue').textContent=fmt(Math.round(extras.hpUsed*hpPrice+extras.mpUsed*mpPrice));
  $('potStatus').textContent=extras.hotbar?
    (extras.potionWhen?'Hotbar found · last confirmed '+extras.potionWhen.toLocaleTimeString():'Hotbar found · verifying stacks…'):
    'Searching for hotbar (first two top slots)';
}
function acceptMesos(value){
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return;
  const p=extras.mesoPending;
  extras.mesoPending=p?.value===value?{value,count:p.count+1}:{value,count:1};
  // Two different preprocessing methods must agree in the current snapshot.
  // No long inventory-open wait is required after that consensus.
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=value;extras.mesoWhen=new Date();
}
function acceptPotion(kind,value){
  if(!Number.isSafeInteger(value)||value<0||value>9999)return;
  const old=extras[kind+'Current'],p=extras.pending[kind];
  extras.pending[kind]=p?.value===value?{value,count:p.count+1}:{value,count:1};
  // The snapshot already required two concordant OCR passes.
  if(old!==null && value<old){
    const spent=old-value;
    // Large gaps may mean a stack replacement, not genuine usage.
    if(spent>Math.max(50,old*.75)){
      extras.lastError=`${kind.toUpperCase()} stack changed sharply (${old} → ${value}); baseline reset, no usage added.`;
    }else extras[kind+'Used']+=spent;
  }
  extras[kind+'Current']=value;
  extras.potionWhen=new Date();
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
    const read=await recognizeSnapshot(crop,worker);extras.lastMesoAttempt=Date.now();
    if(read?.value!==null&&read?.value!==undefined)acceptMesos(read.value);
    else extras.mesoPending=null;
    $('mesoDebug').textContent=read?.note||'No readable mesos detected';
  }else if(!inv){extras.mesoPending=null;}
  const hb=extras.hotbar;
  if(hb&&(!inv||extras.turn%2===0)&&now-extras.lastPotionAttempt>4500){
    const hp=await recognizeSnapshot(relativeRect(hb,8,34,36,24),worker);
    const mp=await recognizeSnapshot(relativeRect(hb,65,34,45,24),worker);
    extras.lastPotionAttempt=Date.now();
    if(hp?.value!==null&&hp?.value!==undefined)acceptPotion('hp',hp.value);else extras.pending.hp=null;
    if(mp?.value!==null&&mp?.value!==undefined)acceptPotion('mp',mp.value);else extras.pending.mp=null;
    $('potDebug').textContent=`HP ${hp?.note||'unreadable'}\nMP ${mp?.note||'unreadable'}`;
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