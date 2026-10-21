'use strict';
// Optional net-mesos measurements. Works only with browser-provided
// video frames; never accesses MapleStory processes, memory, files, or controls.
const extras={inventory:null,lastFind:0,inventoryOpen:false,
  mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,mesoBusy:false,mesoStatus:'',
  lastMesoAttempt:0,lastInvFind:0,mesoSnapshots:[],mesoGained:0,mesoRawNote:'',
  mesoReadings:[],mesoPendingChange:null,
  mesoGuess:null,mesoGuessAt:0,mesoGuessConfidence:0,
  mesoGuessSource:'raw',mesoLastCrop:null,mesoLastCropAt:0,
  potionSpendBaseline:null};
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
// cannot safely be treated as the same OCR problem.
function snapshotImage(rect,style,sourceFrame=null){
  const fw=sourceFrame?.width??video.videoWidth,fh=sourceFrame?.height??video.videoHeight;
  if(!rect || rect.x<0 || rect.y<0 || rect.x+rect.w>fw || rect.y+rect.h>fh)return null;
  const factor=7,pad=24;
  const raw=document.createElement('canvas');raw.width=rect.w;raw.height=rect.h;
  const cx=raw.getContext('2d',{willReadFrequently:true});
  if(sourceFrame){
    const bytes=new Uint8ClampedArray(rect.w*rect.h*4);
    for(let y=0;y<rect.h;y++){
      const begin=((rect.y+y)*sourceFrame.width+rect.x)*4;
      bytes.set(sourceFrame.data.subarray(begin,begin+rect.w*4),y*rect.w*4);
    }
    cx.putImageData(new ImageData(bytes,rect.w,rect.h),0,0);
  }else cx.drawImage(video,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
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
    tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE
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
// Net session gain is based on POSITIVE confirmed balance deltas, not the
// end-to-start balance change. This avoids counting inventory purchases as an
// additional loss while session potion usage is priced separately.
function sessionPotionCost(){
  return Math.max(0,potionSpent()-(extras.potionSpendBaseline??potionSpent()));
}
function sessionNetMesos(){
  return extras.mesosStart===null?null:extras.mesoGained-sessionPotionCost();
}
function showExtraStats(){
  const confirmed=extras.mesosCurrent,guess=extras.mesoGuess;
  const unverified=Number.isSafeInteger(guess)&&guess!==confirmed;
  const balance=unverified?guess:confirmed;
  const known=balance!==null;
  const net=sessionNetMesos();
  const expense=sessionPotionCost();
  const netType=net===null?'unknown':net>0?'positive':net<0?'negative':'neutral';
  const signed=n=>n>0?'+'+fmt(n):n<0?'−'+fmt(Math.abs(n)):'0';
  const sessionMs=typeof sessionElapsedMs==='function'?sessionElapsedMs():0;
  const firstSnapshot=extras.mesoSnapshots[0];
  const observedHours=firstSnapshot?Math.max(0,sessionMs-firstSnapshot.elapsed)/3600000:0;

  // Prominent signed profit/loss, independent of provisional OCR guesses.
  $('netProfit').textContent=net===null?'—':signed(net);
  $('netProfit').className=netType==='unknown'?'profit-unknown':
    netType==='positive'?'profit-positive':netType==='negative'?'profit-negative':'profit-zero';
  $('netMesoPanel').dataset.status=netType;
  const badge=$('profitBadge');
  badge.textContent=net===null?'Waiting for mesos':
    net>0?'Mesos Positive':net<0?'Mesos Negative':'Mesos Neutral';
  badge.className='profit-badge '+(netType==='unknown'?'neutral':netType);
  $('netMesoFormula').textContent=net===null?
    'Confirm an initial mesos snapshot to start net tracking. Potion usage will be included.':
    `${fmt(extras.mesoGained)} recorded gross gains − ${fmt(expense)} estimated potion usage = ${signed(net)} net mesos`;

  // Keep visible balance as a distinct, SECONDARY value. Never count an
  // unverified OCR or local AI guess toward session earnings.
  $('mesoBalance').textContent=known?fmt(balance):'—';
  $('mesoBalance').className=unverified?'profit-estimate':'';
  $('mesoBalanceLabel').textContent='Current balance';
  $('mesoReadingStatus').textContent=unverified?'Estimate':
    confirmed!==null?'Tracked':'—';

  $('mesoDelta').textContent=net===null?'—':signed(net);
  $('mesoGained').textContent=extras.mesoSnapshots.length?fmt(extras.mesoGained):'—';
  $('mesoPerHour').textContent=extras.mesoSnapshots.length>1&&observedHours>1/3600?
    fmt(Math.round(extras.mesoGained/observedHours)):'—';
  $('potionSpend').textContent=fmt(expense);
  $('profitExplanation').textContent=
    'Net = positive changes from recorded balance scans − estimated potion usage. Other expenses are excluded; unusual jumps require repeat verification.';
  $('mesoScanStatus').textContent=
    (extras.mesoStatus||(extras.inventoryOpen?'Inventory visible':'Waiting for inventory'))+
    ` · ${extras.mesoReadings.length} reads · ${extras.mesoSnapshots.length} saved snapshots`;
  const history=$('mesoSnapshotHistory');
  if(history){
    const recent=extras.mesoReadings.slice(-12);
    history.textContent=
      `${extras.mesoReadings.length} readable scans · ${extras.mesoSnapshots.length} recorded snapshots\n`+
      (recent.length?recent.map(item=>
        `${new Date(item.at).toLocaleTimeString()}  ${fmt(item.value)}  [${item.source}]  ${item.status||'observed'}`).join('\n'):
        'No readings recorded yet.');
  }
}
// Keep EVERY readable balance observation in the live session history,
// including repeated identical balances. Only accepted changes add to gross
// positive gains. Manual confirmations bypass the unusual-jump safeguard.
function saveMesosSnapshot(value,source='manual'){
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return false;
  const old=extras.mesosCurrent,elapsed=typeof sessionElapsedMs==='function'?sessionElapsedMs():0;
  const time=Date.now();
  extras.mesoSnapshots.push({value,elapsed,time,source});
  if(old!==null&&old!==value)extras.mesoGained+=Math.max(0,value-old);
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date(time);}
  extras.mesosCurrent=value;extras.mesoWhen=new Date(time);
  extras.mesoGuess=null;extras.mesoGuessAt=0;
  extras.mesoPendingChange=null;extras.mesoPending=null;extras.mesoVotes=[];
  return true;
}
function recordMesosObservation(value,source,confidence=0){
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return null;
  const now=Date.now();
  const entry={value,source,confidence,at:now,
    elapsed:typeof sessionElapsedMs==='function'?sessionElapsedMs():0};
  extras.mesoReadings.push(entry);
  return entry;
}
function trackMesosCandidate(value,source,confidence=0){
  const entry=recordMesosObservation(value,source,confidence);
  if(!entry)return {saved:false,reason:'invalid'};
  const previous=extras.mesosCurrent;
  if(missingLeadingMesosDigit(value,previous)){
    extras.mesoPendingChange=null;entry.status='possible missing first digit';
    return {saved:false,reason:'likely missing first digit'};
  }
  // Large unexpected changes are kept in the observation log immediately
  // but require a second matching screen read before changing earnings.
  if(previous!==null&&previous!==value){
    const jump=Math.abs(value-previous)>Math.max(80000,previous*.30);
    if(jump){
      const pending=extras.mesoPendingChange;
      const repeated=pending?.value===value&&entry.at-pending.at<=16000;
      const count=repeated?pending.count+1:1;
      extras.mesoPendingChange={value,count,at:entry.at};
      if(count<2){
        entry.status='large change · waiting for repeat';
        return {saved:false,reason:'large change awaiting second scan'};
      }
    }
  }
  saveMesosSnapshot(value,source);
  entry.status=previous!==value?'change saved':'same balance saved';
  return {saved:true,changed:previous!==value,reason:'recorded'};
}
function resetExtras(){
  if(typeof stopMesosWatch==='function')stopMesosWatch();
  Object.assign(extras,{inventory:null,lastFind:0,inventoryOpen:false,
    mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,
    mesoBusy:false,mesoStatus:'',lastMesoAttempt:0,lastInvFind:0,
    mesoSnapshots:[],mesoReadings:[],mesoPendingChange:null,
    mesoGained:0,mesoRawNote:'',
    mesoGuess:null,mesoGuessAt:0,mesoGuessConfidence:0,
    mesoGuessSource:'raw',mesoLastCrop:null,mesoLastCropAt:0,
    potionSpendBaseline:potionSpent()});
  // Resetting the mesos session does not erase manual potion spending.
  if(state.running&&state.stream)beginMesosWatch();
  showExtraStats();
}
// Dedicated mesos capture loop. An independent OCR worker prevents long EXP
// and level-recognition passes from delaying inventory snapshots. Video capture
// is still performed solely through the browser's user-approved screen share.
// Throttle the optional mesos path so EXP tracking and the UI stay responsive.
const MESO_SCAN_MS=2000;
const MESO_REDISCOVERY_MS=5000;
const MESO_OCR_RETRY_MS=5000;
const MESO_PREVIEW_REFRESH_MS=5000;
let mesosTimer=null,mesosGeneration=0,mesosWorker=null,mesosWorkerPromise=null;
let lastMesosSearch=0,lastMesosOCR=0,lastMesosPreview=0;
async function getMesosWorker(){
  if(mesosWorker)return mesosWorker;
  if(mesosWorkerPromise)return mesosWorkerPromise;
  if(!window.Tesseract)throw Error('Text recognition library unavailable.');
  mesosWorkerPromise=(async()=>{
    const worker=await Tesseract.createWorker('eng');
    await worker.setParameters({tessedit_char_whitelist:'0123456789,',
      tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE});
    mesosWorker=worker;return worker;
  })();
  try{return await mesosWorkerPromise;}
  finally{mesosWorkerPromise=null;}
}
async function disposeMesosWorker(){
  const worker=mesosWorker;mesosWorker=null;
  if(worker)await worker.terminate();
}
// Footer detector now returns the verified white textbox directly.
// The inventory heading, border and item-grid coordinates are irrelevant.
function locateMesosField(frame,hit,offsetX=0,offsetY=0){
  if(!hit?.footer||!hit.rect)return {rect:null,note:'White mesos textbox not located.'};
  return {rect:hit.rect,note:`White textbox detected at (${hit.rect.x+offsetX},${hit.rect.y+offsetY}), ${hit.rect.w}×${hit.rect.h} · scale ${hit.s}`};
}
// A separate small canvas prevents unnecessary full-frame copies while the
// inventory stays near its last confirmed position. The EXP buffer is untouched.
const mesosRegionCanvas=document.createElement('canvas');
const mesosRegionContext=mesosRegionCanvas.getContext('2d',{willReadFrequently:true});
function captureNearbyMesos(anchor){
  if(!anchor?.footer||!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))return null;
  const s=anchor.s||1,W=video.videoWidth,H=video.videoHeight;
  const x0=Math.max(0,Math.floor(anchor.x-70*s)),y0=Math.max(0,Math.floor(anchor.y-48*s));
  const x1=Math.min(W,Math.ceil(anchor.x+295*s)),y1=Math.min(H,Math.ceil(anchor.y+75*s));
  const w=x1-x0,h=y1-y0;
  if(w<=0||h<=0)return null;
  if(mesosRegionCanvas.width!==w||mesosRegionCanvas.height!==h){
    mesosRegionCanvas.width=w;mesosRegionCanvas.height=h;
  }
  mesosRegionContext.drawImage(video,x0,y0,w,h,0,0,w,h);
  return {
    frame:{width:w,height:h,data:mesosRegionContext.getImageData(0,0,w,h).data},
    x0,y0,
    previous:{...anchor,x:anchor.x-x0,y:anchor.y-y0}
  };
}
function offsetMesosHit(hit,x,y){
  if(!hit)return null;
  return {...hit,x:hit.x+x,y:hit.y+y,
    rect:{...hit.rect,x:hit.rect.x+x,y:hit.rect.y+y}};
}
// Hold only a tiny, temporary textbox crop in memory so an explicit player
// correction can teach real digit shapes. Never persist captured screenshots.
function rememberMesosCrop(frame,rect){
  if(!frame?.data||!rect)return;
  const w=Math.round(rect.w),h=Math.round(rect.h),x=Math.round(rect.x),y=Math.round(rect.y);
  if(w<8||h<8||w>400||h>100||x<0||y<0||x+w>frame.width||y+h>frame.height)return;
  const bits=new Uint8ClampedArray(w*h*4);
  for(let yy=0;yy<h;yy++){
    const start=((y+yy)*frame.width+x)*4;
    bits.set(frame.data.subarray(start,start+w*4),yy*w*4);
  }
  extras.mesoLastCrop={frame:{width:w,height:h,data:bits},rect:{x:0,y:0,w,h}};
  extras.mesoLastCropAt=Date.now();
}
// A common OCR/segmenter failure is to return all digits except the first.
// Preserve the previous full estimate for an exact leading-digit drop rather
// than letting that visibly incorrect suffix replace the player's balance.
function missingLeadingMesosDigit(value,reference){
  if(!Number.isSafeInteger(value)||!Number.isSafeInteger(reference))return false;
  const short=String(value),full=String(reference);
  return full.length===short.length+1&&full.slice(1)===short;
}
function reportMesoAI(){
  const learner=window.MapleMesosAI;
  if(!learner)return;
  const stat=learner.summary();
  const status=$('mesoAIStatus');
  if(status)status.textContent=
    `Included: ${stat.bundled??0} samples · Yours: ${stat.personal??stat.examples} · ${stat.digits}/10 digits covered · ${stat.enabled?'On':'Off'}`;
}
function drawMesosPreview(rect,frame){
  if(!rect||!frame)return;
  const canvas=$('mesoRawCrop');
  if(!canvas?.closest('details')?.open)return;
  const now=Date.now();
  if(now-lastMesosPreview<MESO_PREVIEW_REFRESH_MS)return;
  lastMesosPreview=now;
  // Display original-color source crop only; no enhancement or thresholds.
  const image=snapshotImage(rect,'raw',frame);
  if(!image)return;
  const width=Math.min(520,image.width);
  const height=Math.max(24,Math.round(image.height*width/image.width));
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,width,height);
  ctx.drawImage(image,0,0,width,height);
}
function parseMesosText(raw){
  const text=String(raw||'').trim().replace(/\s+/g,'').replace(/(?<=\d)\.(?=\d{3}(?:$|[,]))/g,',');
  // Valid groupings like 466,629, 1,234,567, or plain 466629.
  if(!/^(?:\d{1,3}(?:,\d{3})+|\d{1,12})$/.test(text))return null;
  const n=Number(text.replace(/,/g,''));
  return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000?n:null;
}
// One single raw-color OCR pass: no glyph templates, binarization, contrast
// adjustment, enhancement or agreement between different image filters.
async function readMesosFast(worker,rect,sourceFrame){
  if(!rect)return {value:null,source:'none',note:'Mesos textbox not visible.'};
  if(!worker)return {value:null,source:'ocr-unavailable',note:'Raw OCR worker unavailable.'};
  // Pixel colors are unchanged. snapshotImage uses nearest-neighbour display
  // enlargement only, to let OCR see the tiny game font at readable scale.
  const image=snapshotImage(rect,'raw',sourceFrame);
  if(!image)return {value:null,source:'crop-invalid',note:'Raw textbox crop unavailable.'};
  const result=await worker.recognize(image);
  const raw=String(result?.data?.text||'').trim();
  const confidence=Math.max(0,Math.min(100,Math.round(Number(result?.data?.confidence)||0)));
  let value=parseMesosText(raw);
  let strict=value!==null;
  // Best-effort fallback is DISPLAY ONLY: recover plausible digits even when
  // OCR inserts a stray symbol. Such guesses can never become rate snapshots.
  if(value===null){
    const groups=raw.match(/[0-9][0-9,.\s]*[0-9]|[0-9]/g)||[];
    const digits=groups.join('').replace(/\D/g,'');
    if(digits.length>=1&&digits.length<=12){
      const guessed=Number(digits);
      if(Number.isSafeInteger(guessed)&&guessed<=1000000000000)value=guessed;
    }
  }
  return {value,source:'raw-ocr',confidence,quality:confidence/100,strict,
    note:`Raw, unfiltered OCR: ${JSON.stringify(raw)} [${confidence}% confidence] => ${value===null?'no digits':fmt(value)}`+
      (value===null?' · no recognizable number':
        strict?' · shown immediately; confirm across frames for rate calculations':
          ' · recovered digit guess only; not eligible for rate calculations')};
}
async function scanMesos(generation){
  if(!state.running||!state.stream||!video.videoWidth||extras.mesoBusy||generation!==mesosGeneration)return;
  extras.mesoBusy=true;
  try{
    // When the inventory is closed, don't re-capture the entire screen and
    // repeat a five-scale search every two seconds. A bounded, time-sliced
    // rediscovery still finds a moved inventory anywhere on the game screen.
    const now=Date.now();
    if(!extras.inventory&&now-lastMesosSearch<MESO_REDISCOVERY_MS)return;
    if(!extras.inventory)lastMesosSearch=now;
    // Search locally first, without allocating an entire full-screen pixel
    // buffer. A moved/closed inventory triggers a cancellable full search.
    const region=captureNearbyMesos(extras.inventory);
    let frame=region?.frame||framePixels();
    let hit=await findInventoryFooter(frame,region?.previous||extras.inventory,
      ()=>state.running&&generation===mesosGeneration);
    if(!state.running||generation!==mesosGeneration)return;
    let offsetX=region?.x0||0,offsetY=region?.y0||0;
    if(!hit&&region){
      lastMesosSearch=Date.now();
      frame=framePixels();offsetX=0;offsetY=0;
      hit=await findInventoryFooter(frame,extras.inventory,
        ()=>state.running&&generation===mesosGeneration);
    }
    if(!state.running||generation!==mesosGeneration)return;
    // Store world-frame coordinates, but recognize the textbox in the small
    // local frame to avoid the cost of scaling or recapturing it again.
    extras.inventory=hit?offsetMesosHit(hit,offsetX,offsetY):null;
    extras.inventoryOpen=!!hit;
    if(!hit){
      lastMesosSearch=Date.now();
      extras.mesoStatus=extras.mesoWhen?'Textbox not visible · last confirmed '+extras.mesoWhen.toLocaleTimeString():
        'Looking for the white mesos textbox anywhere on screen';
      $('mesoOCRDetails').textContent='Mesos textbox not found in current frame. Move or open your inventory.';
      return;
    }
    const field=locateMesosField(frame,hit,offsetX,offsetY);
    if(!field.rect)return;
    rememberMesosCrop(frame,field.rect);
    drawMesosPreview(field.rect,frame);
    const learner=window.MapleMesosAI;
    const ai=learner?.predict(frame,field.rect)??{value:null,reason:'Local AI not loaded'};
    const training=learner?.summary();
    if($('mesoAIDetails'))$('mesoAIDetails').textContent=
      `Learned digit matcher: ${training?.examples??0} examples / ${training?.digits??0} of 10 digits known\n`+
      (ai.value!==null?`Digit prediction: ${fmt(ai.value)} · visual match ${Math.round(ai.confidence*100)}% (not calibrated probability)\n`:
        `No reliable digit prediction: ${ai.reason||'Needs labeled examples'}\n`)+
      'Learned readings can be saved as snapshots; large changes require another matching scan.';
    const previousBalance=extras.mesosCurrent??extras.mesoGuess;
    const aiValid=ai.value!==null&&ai.confidence>=.65&&
      !missingLeadingMesosDigit(ai.value,previousBalance);
    const aiCandidate=aiValid?{value:ai.value,source:'learned digits',
      confidence:Math.round(ai.confidence*100)}:null;
    const needOCR=Date.now()-lastMesosOCR>=MESO_OCR_RETRY_MS;
    let read=null;
    if(needOCR){
      lastMesosOCR=Date.now();
      try{
        const worker=await getMesosWorker();
        if(generation!==mesosGeneration||!state.running)return;
        read=await readMesosFast(worker,field.rect,frame);
      }catch(err){
        $('mesoOCRDetails').textContent='Raw OCR unavailable: '+String(err?.message||err);
      }
    }
    if(generation!==mesosGeneration||!state.running)return;
    if(read){
      extras.lastMesoAttempt=Date.now();
      extras.mesoRawNote=read.note;
      $('mesoOCRDetails').textContent=
        `${field.note}\n${read.note}\nCandidate: ${read.value===null?'unreadable':fmt(read.value)}`;
    }
    const ocrValid=read&&Number.isSafeInteger(read.value)&&
      !missingLeadingMesosDigit(read.value,previousBalance);
    // The reader chooses one candidate per capture. Learned digits provide
    // inexpensive observations on non-OCR scans; raw OCR can supersede a
    // disagreement only when it is reasonably confident.
    let chosen=aiCandidate;
    if(ocrValid&&(!chosen||read.confidence>=75&&read.strict&&
       read.value!==chosen.value))
      chosen={value:read.value,source:'raw OCR',confidence:read.confidence};
    if(!chosen&&ocrValid)chosen={value:read.value,source:'raw OCR',confidence:read.confidence};
    if(chosen){
      extras.mesoGuess=chosen.value;
      extras.mesoGuessSource=chosen.source==='raw OCR'?'raw':'ai';
      extras.mesoGuessAt=Date.now();
      extras.mesoGuessConfidence=chosen.confidence;
      const logged=trackMesosCandidate(chosen.value,chosen.source,chosen.confidence);
      extras.mesoStatus=logged.saved?
        `Mesos snapshot ${fmt(chosen.value)} recorded (${chosen.source})`:
        `Mesos observed ${fmt(chosen.value)} · ${logged.reason}`;
    }else{
      extras.mesoStatus=ai.value!==null&&
        missingLeadingMesosDigit(ai.value,previousBalance)?
        'Possible missing first digit · previous balance retained':
        read?.value!==null&&read&&missingLeadingMesosDigit(read.value,previousBalance)?
        'Possible missing first digit in OCR · previous balance retained':
        extras.mesosCurrent!==null?'No readable number · last snapshot retained':
        'Waiting for first readable mesos amount';
    }
    $('mesoDebug').textContent=extras.mesoStatus+'\n'+$('mesoOCRDetails').textContent;
  }catch(error){
    extras.mesoStatus='Mesos read issue · last confirmed balance retained';
    $('mesoDebug').textContent='Mesos scan: '+String(error?.message||error);
    $('mesoOCRDetails').textContent=$('mesoDebug').textContent;
  }finally{extras.mesoBusy=false;showExtraStats();}
}
function beginMesosWatch(){
  if(mesosTimer!==null)return;
  const generation=++mesosGeneration;
  extras.lastInvFind=0;extras.mesoStatus='Searching for the white mesos textbox';
  // Delay optional inventory work slightly so starting EXP recognition stays fast.
  lastMesosSearch=0;lastMesosOCR=0;lastMesosPreview=0;
  mesosTimer=setInterval(()=>void scanMesos(generation),MESO_SCAN_MS);
  setTimeout(()=>void scanMesos(generation),800);
}
function stopMesosWatch(){
  if(mesosTimer!==null){clearInterval(mesosTimer);mesosTimer=null;}
  ++mesosGeneration;
}


/* Manual potion inventory: local-only counters; no OCR for HP/MP consumables.
   Inventory purchase and sales already affect your real meso balance, so
   estimated potion usage is reported separately instead of being subtracted. */
// Fixed NPC shop prices, from the linked MeowDB Classic consumables efficiency table.
  // These are NPC purchase prices, not player-market prices or actual purchase history.
const POTION_NPC_PRICES={
  hp:{
    'Red Potion':50,'Orange Potion':150,'White Potion':350,
    'Meat':80,'Fried Chicken':60,'Egg':30,'Apple':20,
    'Hot Dog':180,'Dried Squid':180,'Hamburger':350,'Pizza':252,
    'Hot Dog Supreme':480,'Ice Cream Pop':1500,'Unagi':1000,
    'Fat Sausage':800,'Cake':150,"Mrs. Ming Ming's Stew":480,
    "Andre's Seafood Soup":480,'Watermelon':1920,
    'Ribbon Pig Daydream':500,'Orange Mushroom Daydream':500
  },
  mp:{
    'Blue Potion':220,'Lemon':150,'Orange':50,'Salad':220,
    'Orange Juice':540,'Grape Juice':1260,'Pure Water':1120,
    'Red Bean Sundae':2250,'Cake':150,
    "Mrs. Ming Ming's Stew":480,"Andre's Seafood Soup":480,
    'Watermelon':1920
  }
};
const POTION_STORAGE_KEY='vansMaplePotionSessionV1';
const emptyPotion=()=>({type:'',count:null,price:0,spent:0,used:0});
const potions={hp:emptyPotion(),mp:emptyPotion()};
try{
  const saved=JSON.parse(localStorage.getItem(POTION_STORAGE_KEY)||'null');
  for(const kind of ['hp','mp']){
    const v=saved?.[kind];
    if(v&&typeof v.type==='string'&&(v.count===null||Number.isSafeInteger(v.count))&&
      Number.isSafeInteger(v.price)&&Number.isSafeInteger(v.spent)&&Number.isSafeInteger(v.used)){
      potions[kind]={type:v.type,count:v.count,price:v.price,spent:v.spent,used:v.used};
    }
  }
}catch(_e){/* No storage is required to track locally in this tab. */}
function potionSpent(){return potions.hp.spent+potions.mp.spent;}
// Only potion usage recorded from NOW onward affects this mesos session.
// Restored lifetime localStorage expenses are not retroactively deducted.
if(extras.potionSpendBaseline===null)extras.potionSpendBaseline=potionSpent();
function savePotions(){try{localStorage.setItem(POTION_STORAGE_KEY,JSON.stringify(potions))}catch(_e){}}
function renderPotions(){
  for(const kind of ['hp','mp']){
    const p=potions[kind];
    const label=$(kind+'PotionStatus');
    label.textContent=p.count===null?'No starting count':
      `${fmt(p.count)} left`;
    const select=$(kind+'PotionType');
    if(p.type&&Object.hasOwn(POTION_NPC_PRICES[kind],p.type)&&
      [...select.options].some(o=>o.value===p.type))select.value=p.type;
    if(p.count!==null&&$(kind+'PotionCount').value==='')$(kind+'PotionCount').value=String(p.count);

  }
  $('potionSpend').textContent=fmt(potionSpent());
}

$('updatePotionBtn').addEventListener('click',()=>{
  const changes=[];let any=false;
  for(const kind of ['hp','mp']){
    const type=$(kind+'PotionType').value;
    const countRaw=$(kind+'PotionCount').value;
    if(!type&&countRaw==='')continue;
    if(!type||!Object.hasOwn(POTION_NPC_PRICES[kind],type)){
      $('potionNote').textContent='Choose a priced '+kind.toUpperCase()+' consumable from the dropdown.';return;
    }
    const count=safeAmount(countRaw,9999999);
    if(count===null){
      $('potionNote').textContent='Enter a valid '+kind.toUpperCase()+' consumable count.';return;
    }
    const price=POTION_NPC_PRICES[kind][type];
    changes.push({kind,type,count,price});
  }
  if(!changes.length){$('potionNote').textContent='Choose at least one HP or MP potion to update.';return;}
  const notes=[];
  for(const {kind,type,count,price} of changes){
    const p=potions[kind],isNew=p.type!==type||p.count===null;
    if(isNew)notes.push(kind.toUpperCase()+' baseline set');
    else if(count<p.count){
      const used=p.count-count,expense=used*price;
      if(!Number.isSafeInteger(expense)||!Number.isSafeInteger(p.spent+expense)){
        $('potionNote').textContent='Total potion spending exceeds supported number range.';return;
      }
      p.used+=used;p.spent+=expense;
      notes.push(kind.toUpperCase()+' −'+fmt(used)+' used (−'+fmt(expense)+' mesos)');
    }else if(count>p.count)notes.push(kind.toUpperCase()+' restocked (no usage charged)');
    else notes.push(kind.toUpperCase()+' count unchanged');
    p.type=type;p.count=count;p.price=price;
    any=true;
  }
  if(any){
    savePotions();renderPotions();showExtraStats();
    $('potionNote').textContent=notes.join(' · ');
  }
});
$('resetPotionBtn').addEventListener('click',()=>{
  for(const kind of ['hp','mp']){
    potions[kind].count=null;
    $(kind+'PotionCount').value='';
  }
  savePotions();renderPotions();showExtraStats();
  $('potionNote').textContent='Counts cleared. Enter new starting counts.';
});
renderPotions();

$('resetExtraBtn').addEventListener('click',()=>{
  resetExtras();setStatus('Mesos session reset; EXP session unchanged.','good');
});
showExtraStats();
$('teachDigitsBtn').addEventListener('click',()=>{
  const result=teachEXPFromVisible($('templateExpInput').value);
  $('templateStatus').textContent=result.reason;
  if(result.ok){$('templateExpInput').value='';setStatus('EXP digit calibration saved locally.','good');}
});
function safeAmount(raw,max){
  const text=String(raw||'').trim().replace(/,/g,'');
  if(!/^\d+$/.test(text))return null;
  const number=Number(text);return Number.isSafeInteger(number)&&number<=max?number:null;
}
// The classifier is trained only after the user explicitly verifies an
// exact in-game balance. Teaching never silently harvests screenshots.
const mesosLearner=window.MapleMesosAI;
if(mesosLearner){
  $('mesoAIEnabled').checked=mesosLearner.summary().enabled;
  $('mesoAIEnabled').addEventListener('change',()=>{
    mesosLearner.setEnabled($('mesoAIEnabled').checked);
    reportMesoAI();
  });
  $('teachMesoAIBtn').addEventListener('click',()=>{
    const raw=$('mesoTrainingBalance').value;
    const value=safeAmount(raw,1000000000000);
    if(value===null){
      $('mesoTransferStatus').textContent='Enter the number visible in your inventory.';
      return;
    }
    if(!extras.mesoLastCrop||Date.now()-extras.mesoLastCropAt>90000){
      $('mesoTransferStatus').textContent=
        'Open your inventory before saving a digit example.';
      return;
    }
    const learned=mesosLearner.learn(extras.mesoLastCrop.frame,extras.mesoLastCrop.rect,String(value));
    if(!learned.ok){
      $('mesoTransferStatus').textContent='Could not save: '+learned.reason;
      return;
    }
    // This is an explicitly confirmed reading; it can update session history.
    saveMesosSnapshot(value);
    extras.mesoStatus='Player verified balance '+fmt(value)+' · '+learned.reason;
    $('mesoTrainingBalance').value='';
    showExtraStats();
    reportMesoAI();
    $('mesoAIDetails').textContent=learned.reason+
      '\n'+mesosLearner.summary().digits+' of 10 digits covered.';
    $('mesoTransferStatus').textContent=learned.reason;
    $('mesoDebug').textContent='Digit examples saved from confirmed '+fmt(value);
  });
  $('clearMesosAIBtn').addEventListener('click',()=>{
    if(!window.confirm('Clear all locally learned mesos digit examples? This cannot be undone.'))return;
    mesosLearner.clear();
    if(extras.mesoGuessSource==='ai'){
      extras.mesoGuess=null;extras.mesoGuessAt=0;
    }
    reportMesoAI();
    $('mesoAIDetails').textContent='Examples cleared. Raw OCR remains available.';
    showExtraStats();
  });
  $('exportMesosTrainingBtn').addEventListener('click',()=>{
    try{
      const payload=mesosLearner.exportData();
      const data=new Blob([payload],{type:'application/json'});
      const url=URL.createObjectURL(data);
      const link=document.createElement('a');
      link.href=url;link.download='maple-mesos-digit-examples.json';
      document.body.appendChild(link);link.click();link.remove();
      // Delay revocation until Chrome has started the download.
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('mesoTransferStatus').textContent='Examples exported. Share this file to use them in another browser.';
    }catch(error){
      $('mesoTransferStatus').textContent='Export unavailable: '+(error?.message||error);
    }
  });
  $('importMesosTrainingFile').addEventListener('change',async()=>{
    const input=$('importMesosTrainingFile'),file=input.files?.[0];
    if(!file)return;
    if(file.size>100000){
      $('mesoTransferStatus').textContent='That file is too large.';input.value='';return;
    }
    try{
      const result=mesosLearner.importData(await file.text());
      $('mesoTransferStatus').textContent=result.reason;
      reportMesoAI();
    }catch(_){
      $('mesoTransferStatus').textContent='Could not import that file.';
    }finally{input.value=''}
  });
  reportMesoAI();
}else{
  $('mesoAIEnabled').disabled=true;
  $('teachMesoAIBtn').disabled=true;
  $('clearMesosAIBtn').disabled=true;
  $('exportMesosTrainingBtn').disabled=true;
  $('importMesosTrainingFile').disabled=true;
  $('mesoAIStatus').textContent='Digit learning unavailable; OCR is still active.';
}

$('setMesoSnapshot').addEventListener('click',()=>{
  const value=safeAmount($('manualMesoBalance').value,1000000000000);
  if(value===null){$('mesoDebug').textContent='Enter an exact non-negative meso balance.';return;}
  saveMesosSnapshot(value);
  extras.mesoStatus='Manual mesos balance confirmed: '+fmt(value);
  $('manualMesoBalance').value='';$('mesoDebug').textContent='Manual mesos snapshot saved for the active-session history.';showExtraStats();
});