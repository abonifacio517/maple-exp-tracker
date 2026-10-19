'use strict';
// Separate potion reader. Screen pixels only; no game-client hooks, memory reads or input.
// OCR is advisory until verified; users can label exact stack images to calibrate.
const POTION_MS=2000; // Attempt HP/MP scans every 2 seconds; avoid overlapping OCR work.
let potionTimer=null,potionGeneration=0,potionBusy=false;
// Separate HP and MP OCR workers prevent a difficult HP digit from blocking MP.
const potionWorkers={hp:null,mp:null},potionWorkerPromises={hp:null,mp:null};
const potionAlign={hp:null,mp:null};
const potionPatterns={hp:[],mp:[]};
const potionSamples={hp:null,mp:null};
function potionPrice(kind){
  const selected=$(kind+'PotionSelect').value;
  const row=potionCatalogEntry(kind,selected);
  return row?row[2]:null;
}
function recordPotionConsumption(kind,amount){
  if(!Number.isSafeInteger(amount)||amount<=0)return;
  extras[kind+'Used']+=amount;
  const price=potionPrice(kind);
  if(price===null)extras[kind+'Unpriced']+=amount;
  else extras[kind+'Cost']+=price*amount;
}
function getPotionExpenseSummary(){
  const expense=extras.hpCost+extras.mpCost;
  const unpriced=extras.hpUnpriced+extras.mpUnpriced;
  return {expense,unpriced};
}
function renderPotionFinancials(){
  const delta=extras.mesosStart===null||extras.mesosCurrent===null?null:extras.mesosCurrent-extras.mesosStart;
  const {expense,unpriced}=getPotionExpenseSummary();
  const mode=document.querySelector('input[name="potionAccounting"]:checked')?.value||'preowned';
  const configured=['hp','mp'].every(k=>potionPrice(k)!==null);
  const stacksConfirmed=extras.hpCurrent!==null&&extras.mpCurrent!==null;
  const profitReady=mode==='balance'||(configured&&stacksConfirmed&&!unpriced);
  const total=delta===null||!profitReady?null:delta-(mode==='preowned'?expense:0);
  const target=$('netProfit');
  target.textContent=total===null?'—':(total>0?'+':'')+fmt(total);
  target.className=total===null?'profit-unknown':total>0?'profit-positive':total<0?'profit-negative':'profit-zero';
  const badge=$('profitBadge');
  badge.textContent=delta===null?'Waiting for meso snapshots':!profitReady?'Confirm potions to see profit':total>0?'Mesos positive':total<0?'Mesos negative':'Break-even';
  badge.className='profit-badge '+(total>0?'positive':total<0?'negative':'neutral');
  $('profitExplanation').textContent=delta===null?'Open your inventory at the start and again later to measure mesos change.':
    !profitReady?unpriced?`${unpriced} potion uses had no confirmed price. Start a new session to calculate a complete profit.`:'Choose both consumables and confirm their current stack quantities to calculate net profit safely.':
    mode==='preowned'?`Balance change ${fmt(delta)} − ${fmt(expense)} mesos of consumed potions stocked before the session. This is an estimate, not an audited profit.`:
    `Balance change ${fmt(delta)} mesos. Potion costs aren't subtracted a second time because purchases during this session are already included in the balance change.`;
}
const lastPotionSelection={hp:'',mp:''};
function populatePotionMenus(){
  for(const kind of ['hp','mp']){
    const select=$(kind+'PotionSelect');
    for(const [id,name,price,restore] of MAPLE_POTION_CATALOG[kind]){
      const option=document.createElement('option');option.value=id;
      option.textContent=`${name} — ${fmt(price)} mesos`;
      select.appendChild(option);
    }
    const saved=localStorage.getItem(`maple_potion_${kind}`);
    if(saved&&potionCatalogEntry(kind,saved))select.value=saved;
    lastPotionSelection[kind]=select.value;
    select.addEventListener('change',()=>{
      const previous=lastPotionSelection[kind];
      lastPotionSelection[kind]=select.value;
      localStorage.setItem(`maple_potion_${kind}`,select.value);
      // Counts of a new item are NOT comparable with the old item's stack.
      if(previous!==select.value&&extras[kind+'Current']!==null){
        extras[kind+'Current']=null;extras.pending[kind]=null;
        potionSamples[kind]=null;potionAlign[kind]=null;
        extras.potionStatus=`${kind.toUpperCase()} potion changed · confirm its starting stack`;
      }
      // Even if no sample exists, require verification before treating readings as usage.
      extras.pending[kind]=null;
      renderPotionPrices();showExtraStats();
    });
  }
  const savedMode=localStorage.getItem('maple_potion_cost_mode');
  if(savedMode==='balance')document.querySelector('input[name="potionAccounting"][value="balance"]').checked=true;
  for(const radio of document.querySelectorAll('input[name="potionAccounting"]'))radio.addEventListener('change',()=>{
    localStorage.setItem('maple_potion_cost_mode',radio.value);showExtraStats();
  });
  renderPotionPrices();
}
function renderPotionPrices(){
  for(const kind of ['hp','mp']){
    const item=potionCatalogEntry(kind,$(kind+'PotionSelect').value);
    $(kind+'PotionPrice').textContent=item?`${fmt(item[2])} mesos each · restores ${fmt(item[3])} ${kind.toUpperCase()} · NPC price`:
      `Select your ${kind.toUpperCase()} consumable to calculate its value.`;
  }
}
function potionRect(hotbar,kind){
  // Exact 4x3 hotbar sprite coordinates, tied to the located (possibly moving)
  // hotbar rather than screen coordinates. Excludes the top-left hotkey label.
  const ref=POTION_SEQUENCE_REFERENCES[kind];
  const [x,y,w,h]=ref.rect;
  return relativeRect(hotbar,x,y,w,h);
}
// Tiny on-screen digits are very sensitive to the hotbar sprite's detected
// origin. Scan nearby crops on the SAME frame, but only accept a very good,
// unambiguous game-font match. A wrong offset should never manufacture usage.
function potionLocatedDigits(kind,frame,hotbar){
  const base=potionRect(hotbar,kind);
  const preferred=potionAlign[kind];
  const shifts=[...(preferred?[preferred]:[]),
    ...[-3,-2,-1,0,1,2,3,4,5,6,7,8].flatMap(dy=>[0,-1,1,-2,2,-3,3,4,5,6,7].map(dx=>({dx,dy})))];
  let best=null,second=null;
  const seen=new Set();
  for(const {dx,dy} of shifts){
    const key=dx+','+dy;if(seen.has(key))continue;seen.add(key);
    const raw=potionSourceData({...base,x:base.x+dx,y:base.y+dy},frame);
    if(!raw)continue;
    const match=potionDigitMatch(kind,raw);
    if(!match)continue;
    const result={...match,dx,dy,raw};
    // After calibration, matching at the previously confirmed offset is enough.
    // This reduces repeated full offset searches and CPU usage considerably.
    if(preferred&&preferred.dx===dx&&preferred.dy===dy&&result.matchError<1&&result.matchGap>3){
      result.note+=` · aligned (${dx},${dy})`;
      return {reading:result,raw};
    }
    if(!best||result.matchError<best.matchError){
      if(best&&best.value!==result.value&&(!second||best.matchError<second.matchError))second=best;
      best=result;
    }else if(result.value!==best.value&&(!second||result.matchError<second.matchError))second=result;
  }
  if(!best||second&&(second.matchError-best.matchError<2))return null;
  potionAlign[kind]={dx:best.dx,dy:best.dy};
  best.note+=` · aligned (${best.dx},${best.dy})`;
  return {reading:best,raw:best.raw};
}
function potionAlignedCrop(kind,frame,hotbar){
  const base=potionRect(hotbar,kind);
  const {dx=0,dy=0}=potionAlign[kind]||{};
  return potionSourceData({...base,x:base.x+dx,y:base.y+dy},frame);
}
function potionSequenceMatch(kind,raw){
  // A learned *whole-count* reference is never extrapolated to an unseen count.
  // If OCR sees a previously unseen number, it must pass normal confirmation.
  const ref=POTION_SEQUENCE_REFERENCES[kind];
  if(!ref||$(kind+'PotionSelect').value!==ref.item)return null;
  const [w,h]=ref.size;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(raw,0,0,w,h);
  const px=ctx.getImageData(0,0,w,h).data;
  const measured=new Uint8Array(ref.coords.length);
  for(let i=0;i<ref.coords.length;i++){
    const j=ref.coords[i]*4;
    measured[i]=((px[j]*77+px[j+1]*150+px[j+2]*29)/256)>>2;
  }
  const ranked=[];
  for(const sample of ref.samples){
    let difference=0;
    for(let i=0;i<measured.length;i++)difference+=Math.abs(measured[i]-sample.g[i]);
    ranked.push({value:sample.v,score:difference/measured.length*4});
  }
  ranked.sort((a,b)=>a.score-b.score);
  const best=ranked[0],second=ranked[1];
  // Strict distance + separation to avoid assigning an unseen number to the
  // closest reference by force. The raw capture is never upscaled from 0 pixels.
  if(best&&best.score<7.5&&(!second||second.score-best.score>5.5)){
    return {value:best.value,confidence:99,source:'sequence',
      note:`verified reference ${best.value} (difference ${best.score.toFixed(1)})`};
  }
  return null;
}

function potionSourceData(rect,frame){
  if(!rect||rect.x<0||rect.y<0||rect.x+rect.w>frame.width||rect.y+rect.h>frame.height)return null;
  const c=document.createElement('canvas');c.width=rect.w;c.height=rect.h;
  const bytes=new Uint8ClampedArray(rect.w*rect.h*4);
  for(let y=0;y<rect.h;y++){
    const src=((rect.y+y)*frame.width+rect.x)*4;
    bytes.set(frame.data.subarray(src,src+rect.w*4),y*rect.w*4);
  }
  c.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(bytes,rect.w,rect.h),0,0);
  return c;
}
function potionSignature(canvas){
  const cx=canvas.getContext('2d',{willReadFrequently:true});
  const {width:w,height:h}=canvas;
  // Distinctive bottom text occupies y 3..h-2. Normalize the texture, ignoring
  // color hue of the potion artwork. Signature only recognizes *known* counts.
  const pixels=cx.getImageData(0,0,w,h).data,columns=32,rows=12;
  let bits='';
  for(let iy=0;iy<rows;iy++)for(let ix=0;ix<columns;ix++){
    const x=Math.min(w-1,Math.floor((ix+.5)*w/columns));
    const y=Math.min(h-1,Math.floor((iy+.5)*h/rows));
    const k=(y*w+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];
    const bright=(r*0.299+g*0.587+b*0.114)>155;
    bits+=bright?'1':'0';
  }
  return bits;
}
function potionPatternLookup(kind,canvas){
  const sig=potionSignature(canvas),candidates=[];
  for(const entry of potionPatterns[kind]){
    if(entry.item!==$(kind+'PotionSelect').value||entry.width!==canvas.width||entry.height!==canvas.height||!Number.isSafeInteger(entry.amount))continue;
    let same=0;for(let i=0;i<sig.length;i++)if(sig[i]===entry.signature[i])same++;
    const similarity=same/sig.length;
    if(similarity>=.985)candidates.push({amount:entry.amount,similarity});
  }
  candidates.sort((a,b)=>b.similarity-a.similarity);
  if(candidates.length && (!candidates[1]||candidates[0].amount===candidates[1].amount||candidates[0].similarity-candidates[1].similarity>.01))
    return {value:candidates[0].amount,confidence:99,note:`calibrated pixel image ${Math.round(candidates[0].similarity*100)}%`};
  return null;
}
function storePotionSample(kind,amount,canvas=null){
  const source=canvas||potionSamples[kind]?.lastCanvas;
  if(!source||!Number.isSafeInteger(amount)||amount<0)return;
  const signature=potionSignature(source);
  const sample={item:$(kind+'PotionSelect').value,amount,signature,width:source.width,height:source.height};
  const list=potionPatterns[kind];
  if(!list.some(e=>e.item===sample.item&&e.amount===amount&&e.signature===signature))list.push(sample);
  if(list.length>16)list.splice(0,list.length-16);
  potionSamples[kind]={item:sample.item,lastCanvas:source};
  try{localStorage.setItem(`maple_potion_templates_${kind}`,JSON.stringify(list));}catch{}
}
function restorePotionSamples(){
  for(const kind of ['hp','mp']){
    try{
      const parsed=JSON.parse(localStorage.getItem(`maple_potion_templates_${kind}`)||'[]');
      if(Array.isArray(parsed))for(const x of parsed.slice(-16)){
        if(typeof x.signature==='string'&&/^[01]{384}$/.test(x.signature)&&Number.isSafeInteger(x.amount)&&x.amount>=0&&
          Number.isInteger(x.width)&&Number.isInteger(x.height)&&typeof x.item==='string')potionPatterns[kind].push(x);
      }
    }catch{}
  }
}
function potionProcessedImage(raw,mode){
  const factor=9,pad=36,w=raw.width,h=raw.height;
  const canvas=document.createElement('canvas');canvas.width=w*factor+pad*2;canvas.height=h*factor+pad*2;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(mode==='smooth')ctx.imageSmoothingEnabled=true;
  else ctx.imageSmoothingEnabled=false;
  let source=raw;
  if(mode!=='raw'&&mode!=='smooth'){
    source=document.createElement('canvas');source.width=w;source.height=h;
    const sx=source.getContext('2d',{willReadFrequently:true});
    const px=raw.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h);
    for(let i=0;i<px.data.length;i+=4){
      const r=px.data[i],g=px.data[i+1],b=px.data[i+2],v=r*.299+g*.587+b*.114;
      const ink=mode==='contrast'?Math.round(Math.max(0,Math.min(255,(v-110)*2+100))):v>=180?255:0;
      px.data[i]=px.data[i+1]=px.data[i+2]=ink;
    }
    sx.putImageData(px,0,0);
  }
  ctx.drawImage(source,pad,pad,w*factor,h*factor);
  return canvas;
}
async function getPotionWorker(kind){
  if(potionWorkers[kind])return potionWorkers[kind];
  if(potionWorkerPromises[kind])return potionWorkerPromises[kind];
  if(!window.Tesseract)throw Error('Potion OCR library unavailable');
  potionWorkerPromises[kind]=(async()=>{
    const w=await Tesseract.createWorker('eng');
    await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE});
    potionWorkers[kind]=w;return w;
  })();
  try{return await potionWorkerPromises[kind];}
  finally{potionWorkerPromises[kind]=null;}
}
async function readPotionImage(kind,raw){
  const digits=potionDigitMatch(kind,raw);
  if(digits)return digits;
  const known=potionSequenceMatch(kind,raw);
  if(known)return known;
  const remembered=potionPatternLookup(kind,raw);
  if(remembered)return remembered;
  const worker=await getPotionWorker(kind),passes=[];
  for(const mode of ['raw','binary']){
    const out=await worker.recognize(potionProcessedImage(raw,mode));
    const text=String(out.data.text||'').trim().replace(/\s+/g,'');
    const value=/^\d{1,4}$/.test(text)?Number(text):null;
    const confidence=Number(out.data.confidence)||0;
    passes.push({value,confidence,mode,raw:text});
    // Two independent image treatments improve reliability; do not stop on a lucky single read.
  }
  const viable=passes.filter(p=>p.value!==null&&p.confidence>=55);
  const counts=new Map();for(const p of viable){let r=counts.get(p.value)||{votes:0,best:0};r.votes++;r.best=Math.max(r.best,p.confidence);counts.set(p.value,r);}
  const ranking=[...counts].sort((a,b)=>b[1].votes-a[1].votes||b[1].best-a[1].best);
  const best=ranking[0],conflict=ranking[1]&&best[1].votes===ranking[1][1].votes;
  const accepted=best&&!conflict&&(best[1].votes>=2||best[1].best>=90)?best[0]:null;
  return {value:accepted,confidence:best?.[1]?.best||0,agreement:best?.[1]?.votes||0,source:'ocr',
    note:passes.map(p=>`${p.mode}:${p.raw||'?'}(${Math.round(p.confidence)}%)`).join(' / ')+(accepted===null?' · uncertain':'')};
}
function handlePotionReading(kind,result,canvas){
  const current=extras[kind+'Current'];
  const value=result.value;
  if(value===null||value===undefined){extras.pending[kind]=null;return `${kind.toUpperCase()}: ${result.note}`;}
  if(current===null){
    // A strong, game-specific digit/sequence match can establish the first
    // count automatically. Unknown numbers read by generic OCR still require
    // an explicit baseline so a missing hundreds digit cannot become profit.
    const trusted=result.source==='sequence'||result.source==='digit-templates'||
      result.note?.startsWith('calibrated pixel');
    if(!trusted&&!(result.source==='ocr'&&result.confidence>=88&&result.agreement>=2)){
      extras.pending[kind]=null;
      return `${kind.toUpperCase()}: OCR suggests ${fmt(value)} but digit length is unverified; waiting for a strong reading (or set count manually).`;
    }
    const prev=extras.pending[kind];
    extras.pending[kind]=prev?.value===value?{value,count:prev.count+1}:{value,count:1};
    if(extras.pending[kind].count>=(trusted?3:4)){
      extras[kind+'Current']=value;extras.potionWhen=new Date();extras.lastError='';
      extras.pending[kind]=null;storePotionSample(kind,value,canvas);
      return `${kind.toUpperCase()}: starting stack ${fmt(value)} confirmed automatically (${result.note})`;
    }
    return `${kind.toUpperCase()}: verifying starting ${fmt(value)} (${extras.pending[kind].count}/${trusted?3:4} frames)`;
  }
  const change=Math.abs(value-current);
  // At short scan intervals a missing hundreds digit produces enormous false use.
  const maxDifference=Math.max(6,Math.ceil(current*.12));
  if(change>maxDifference){extras.pending[kind]=null;return `${kind.toUpperCase()}: ignored ${fmt(current)} → ${fmt(value)} (implausibly large; confirm manually if real).`;}
  const previous=extras.pending[kind];
  extras.pending[kind]=previous?.value===value?{value,count:previous.count+1}:{value,count:1};
  const confirmations=result.source==='sequence'||/^(calibrated pixel|independent pixel digits|verified reference)/.test(result.note||'')?2:3;
  if(extras.pending[kind].count>=confirmations){
    acceptPotion(kind,value);
    storePotionSample(kind,value,canvas);
    return `${kind.toUpperCase()}: confirmed ${fmt(value)} (${result.note})`;
  }
  return `${kind.toUpperCase()}: verifying ${fmt(value)} on another frame (${result.note})`;
}
async function potionScan(generation){
  if(!state.running||!state.stream||!video.videoWidth||potionBusy||generation!==potionGeneration)return;
  potionBusy=true;
  try{
    const now=Date.now();const frame=framePixels();
    if(extras.hotbar && !activeInventoryAnchor(frame,extras.hotbar)){
      extras.hotbar=null;potionAlign.hp=null;potionAlign.mp=null;
    }
    if(!extras.hotbar && (now-extras.lastHotFind>=5000)){
      extras.lastHotFind=now;extras.hotbar=findVisualAnchor(frame,'hotbar');
    }
    const hotbar=extras.hotbar;
    if(!hotbar){extras.potionStatus='Hotbar not detected · waiting for it to be visible';return;}
    // Use the same frozen frame for both potions. Fast pixel matching searches
    // nearby offsets; an isolated HP and MP OCR worker is used only if needed.
    const jobs=await Promise.all(['hp','mp'].map(async kind=>{
      const located=potionLocatedDigits(kind,frame,hotbar);
      const raw=located?.raw||potionAlignedCrop(kind,frame,hotbar);
      if(!raw)return {kind,raw:null,reading:{value:null,note:'Quantity crop outside capture'}};
      potionSamples[kind]={item:$(kind+'PotionSelect').value,lastCanvas:raw};
      const reading=located?.reading||await readPotionImage(kind,raw);
      return {kind,raw,reading};
    }));
    if(generation!==potionGeneration||!state.running)return;
    const details=document.querySelector('.diagnostics-panel');
    if(details?.open)for(const {kind,raw} of jobs){
      const preview=$(kind+'PotionCrop');
      if(!preview||!raw)continue;
      if(preview.width!==raw.width||preview.height!==raw.height){preview.width=raw.width;preview.height=raw.height;}
      const cx=preview.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=false;
      cx.clearRect(0,0,preview.width,preview.height);cx.drawImage(raw,0,0);
    }
    const messages=[];
    for(const {kind,raw,reading} of jobs){
      messages.push(raw?handlePotionReading(kind,reading,raw):`${kind.toUpperCase()}: ${reading.note}`);
    }
    extras.lastPotionAttempt=Date.now();
    const unsure=messages.some(m=>/ignored|uncertain|verifying|confirm starting count|not available/.test(m));
    extras.potionStatus=extras.hpCurrent===null||extras.mpCurrent===null?
      'Hotbar found · confirm starting stack counts below':
      unsure?'Hotbar found · checking uncertain digits · last verified counts shown':
      'Hotbar found · verified '+new Date().toLocaleTimeString();
    $('potDebug').textContent=messages.join('\n')+'\nOnly repeated verified values change session totals.';
  }catch(e){extras.potionStatus='Potion recognition uncertain · keeping last confirmed counts';$('potDebug').textContent='Potion scan: '+String(e?.message||e);}
  finally{potionBusy=false;showExtraStats();}
}
function beginPotionWatch(){
  if(potionTimer!==null)return;
  const generation=++potionGeneration;
  extras.lastHotFind=0;potionAlign.hp=null;potionAlign.mp=null;
  void potionScan(generation);
  potionTimer=setInterval(()=>void potionScan(generation),POTION_MS);
}
function stopPotionWatch(){
  if(potionTimer!==null){clearInterval(potionTimer);potionTimer=null;}
  ++potionGeneration;
}
restorePotionSamples();populatePotionMenus();showExtraStats();