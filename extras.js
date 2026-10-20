'use strict';
// Optional net-mesos measurements. Works only with browser-provided
// video frames; never accesses MapleStory processes, memory, files, or controls.
const extras={inventory:null,lastFind:0,inventoryOpen:false,
  mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,mesoBusy:false,mesoStatus:'',
  lastMesoAttempt:0,lastInvFind:0,mesoSnapshots:[],mesoGained:0,mesoRawNote:''};
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
function showExtraStats(){
  const balance=extras.mesosCurrent,known=balance!==null;
  const sessionMs=typeof sessionElapsedMs==='function'?sessionElapsedMs():0;
  const firstSnapshot=extras.mesoSnapshots[0];
  const observedHours=firstSnapshot?Math.max(0,sessionMs-firstSnapshot.elapsed)/3600000:0;
  $('mesoBalance').textContent=known?fmt(balance):'—';
  $('netProfit').textContent=known?fmt(balance):'—';
  $('netProfit').className=known?'profit-zero':'profit-unknown';
  $('mesoDelta').textContent='—'; // legacy hidden value, not displayed or double-counted
  $('mesoGained').textContent=extras.mesoSnapshots.length?fmt(extras.mesoGained):'—';
  $('mesoPerHour').textContent=extras.mesoSnapshots.length>1&&observedHours>1/3600?
    fmt(Math.round(extras.mesoGained/observedHours)):'—';
  $('potionSpend').textContent=fmt(potionSpent());
  const badge=$('profitBadge');
  badge.textContent=known?'Balance confirmed':'Waiting for balance';
  badge.className='profit-badge '+(known?'positive':'neutral');
  $('profitExplanation').textContent=known?
    'Mesos gained/hour sums positive differences between confirmed inventory snapshots and divides by active time since the first mesos snapshot. Spending and potion estimates appear separately; potion costs are not deducted twice.':
    'Open your inventory to establish a mesos snapshot. The reader tracks its white numeric textbox anywhere in the shared game frame.';
  $('mesoScanStatus').textContent=extras.mesoStatus || (extras.inventoryOpen?
    (extras.mesoWhen?'Inventory visible · last confirmed '+extras.mesoWhen.toLocaleTimeString():
      extras.mesoPending?'Checking '+fmt(extras.mesoPending.value)+'…':'Inventory visible · reading…'):
    (extras.mesoWhen?'Inventory closed · last confirmed '+extras.mesoWhen.toLocaleTimeString():'Waiting for inventory'));
}
function saveMesosSnapshot(value){
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return false;
  const old=extras.mesosCurrent,elapsed=typeof sessionElapsedMs==='function'?sessionElapsedMs():0;
  if(old!==value){
    if(old!==null)extras.mesoGained+=Math.max(0,value-old);
    extras.mesoSnapshots.push({value,elapsed});
    if(extras.mesoSnapshots.length>1000)extras.mesoSnapshots.splice(1,1); // retain the initial rate baseline
  }
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=value;extras.mesoWhen=new Date();
  extras.mesoPending=null;extras.mesoVotes=[];
  return true;
}
// Confirmation is based on SEPARATE captured frames, not on several OCR
// filters of the same image. Keep a rolling record across occasional failures.
function acceptMesos(read){
  const value=read?.value;
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return false;
  if(value===extras.mesosCurrent){extras.mesoWhen=new Date();extras.mesoPending=null;extras.mesoVotes=[];return true;}
  const now=Date.now();
  extras.mesoVotes=(extras.mesoVotes||[]).filter(x=>now-x.time<14000);
  extras.mesoVotes.push({value,time:now,source:read.source||'unknown',quality:read.quality||0});
  extras.mesoVotes=extras.mesoVotes.slice(-7);
  const groups=new Map();
  for(const v of extras.mesoVotes){
    const item=groups.get(v.value)||{count:0,strong:0,quality:0};
    item.count++;item.quality+=v.quality;
    if(v.source==='font'||v.source==='ocr-agreement')item.strong++;
    groups.set(v.value,item);
  }
  const ranked=[...groups].sort((a,b)=>b[1].count-a[1].count||b[1].quality-a[1].quality);
  const leader=ranked[0],runner=ranked[1];
  const strong=leader[1].strong>=2;
  // Provisional template + enhanced OCR readings still need at least three
  // different captured frames, never just two filters on the same image.
  let needed=strong?2:3;
  if(extras.mesosCurrent!==null&&Math.abs(leader[0]-extras.mesosCurrent)>Math.max(1000000,extras.mesosCurrent*.35))needed++;
  extras.mesoPending={value:leader[0],count:leader[1].count,needed};
  if(leader[1].count<needed||(runner&&runner[1].count>=leader[1].count))return false;
  return saveMesosSnapshot(leader[0]);
}
function resetExtras(){
  if(typeof stopMesosWatch==='function')stopMesosWatch();
  Object.assign(extras,{inventory:null,lastFind:0,inventoryOpen:false,
    mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,
    mesoBusy:false,mesoStatus:'',lastMesoAttempt:0,lastInvFind:0,
    mesoSnapshots:[],mesoGained:0,mesoRawNote:''});
  // Resetting the mesos session does not erase manual potion spending.
  if(state.running&&state.stream)beginMesosWatch();
  showExtraStats();
}
// Dedicated mesos capture loop. An independent OCR worker prevents long EXP
// and level-recognition passes from delaying inventory snapshots. Video capture
// is still performed solely through the browser's user-approved screen share.
const MESO_SCAN_MS=1300;
let mesosTimer=null,mesosGeneration=0,mesosWorker=null,mesosWorkerPromise=null;
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
function locateMesosField(frame,hit){
  if(!hit?.footer||!hit.rect)return {rect:null,note:'White mesos textbox not located.'};
  return {rect:hit.rect,note:`White textbox detected at (${hit.rect.x},${hit.rect.y}), ${hit.rect.w}×${hit.rect.h} · scale ${hit.s}`};
}
function drawMesosPreview(rect,frame){
  if(!rect||!frame)return;
  const views=[
    ['mesoRawCrop',snapshotImage(rect,'raw',frame)],
    ['mesoEnhancedCrop',inkOnlyMesosImage(rect,frame)]
  ];
  for(const [id,image] of views){
    if(!image)continue;
    const canvas=$(id);if(!canvas)continue;
    const width=Math.min(520,image.width),height=Math.max(24,Math.round(image.height*width/image.width));
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,width,height);
    ctx.drawImage(image,0,0,width,height);
  }
}
function parseMesosText(raw){
  const text=String(raw||'').trim().replace(/\s+/g,'').replace(/(?<=\d)\.(?=\d{3}(?:$|[,]))/g,',');
  // Valid groupings like 466,629, 1,234,567, or plain 466629.
  if(!/^(?:\d{1,3}(?:,\d{3})+|\d{1,12})$/.test(text))return null;
  const n=Number(text.replace(/,/g,''));
  return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000?n:null;
}
// Ink-only preparation on the original pixels before nearest-neighbour
// enlargement. This suppresses colored textbox rails and background noise.
function inkOnlyMesosImage(rect,sourceFrame=null){
  const W=sourceFrame?.width??video.videoWidth,H=sourceFrame?.height??video.videoHeight;
  if(!rect||rect.x<0||rect.y<0||rect.x+rect.w>W||rect.y+rect.h>H)return null;
  const raw=document.createElement('canvas');
  raw.width=rect.w;raw.height=rect.h;
  const ctx=raw.getContext('2d',{willReadFrequently:true});
  if(sourceFrame){
    const bytes=new Uint8ClampedArray(rect.w*rect.h*4);
    for(let y=0;y<rect.h;y++){
      const begin=((rect.y+y)*W+rect.x)*4;
      bytes.set(sourceFrame.data.subarray(begin,begin+rect.w*4),y*rect.w*4);
    }
    ctx.putImageData(new ImageData(bytes,rect.w,rect.h),0,0);
  }else ctx.drawImage(video,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
  const data=ctx.getImageData(0,0,raw.width,raw.height);
  for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++){
    const i=(y*raw.width+x)*4,r=data.data[i],g=data.data[i+1],b=data.data[i+2];
    const ink=Math.max(r,g,b)<183&&Math.max(r,g,b)-Math.min(r,g,b)<45;
    // Rightmost pixels often include a vertical textbox border rather than a
    // number. Remove that edge as well as the top/bottom rail if captured.
    const safe=x>=2&&x<raw.width-2&&y>=1&&y<raw.height-2;
    const v=ink&&safe?0:255;
    data.data[i]=data.data[i+1]=data.data[i+2]=v;
  }
  ctx.putImageData(data,0,0);
  const zoom=8,pad=22;
  const image=document.createElement('canvas');
  image.width=raw.width*zoom+2*pad;image.height=raw.height*zoom+2*pad;
  const c=image.getContext('2d');c.fillStyle='white';c.fillRect(0,0,image.width,image.height);
  c.imageSmoothingEnabled=false;c.drawImage(raw,pad,pad,raw.width*zoom,raw.height*zoom);
  return image;
}
async function readMesosFast(worker,rect,sourceFrame){
  if(!rect)return {value:null,source:'none',note:'Mesos textbox not visible.'};
  const font=typeof readMesosDigits==='function'?
    readMesosDigits(sourceFrame,rect):{value:null,candidate:null,score:0,note:'Digit templates unavailable'};
  const details=[`templates: ${font.note||'—'}`];
  // Trusted digit atlas reading: still confirm on another captured frame.
  if(font.value!==null&&font.score>=.83)
    return {value:font.value,source:'font',quality:font.score,note:details.join(' | ')+' · verified template candidate'};
  if(!worker)return {value:null,source:'templates-uncertain',
    note:details.join(' | ')+' · OCR comparison required'};
  await worker.setParameters({
    tessedit_char_whitelist:'0123456789,',
    tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE
  });
  const rawReads=[];
  // Keep the raw and enhanced candidates even if Tesseract gives the
  // enhanced black-on-white crop 0% confidence: a zero is not proof that the
  // legible digits are wrong. It cannot be the sole acceptance evidence.
  for(const mode of ['raw','enhanced']){
    const image=mode==='enhanced'?inkOnlyMesosImage(rect,sourceFrame):snapshotImage(rect,'raw',sourceFrame);
    if(!image)continue;
    const result=await worker.recognize(image);
    const text=String(result.data.text||'').trim();
    const confidence=Math.round(Number(result.data.confidence)||0);
    const value=parseMesosText(text);
    details.push(`${mode} OCR: ${JSON.stringify(text)} [${confidence}%] => ${value===null?'?':fmt(value)}`);
    rawReads.push({mode,value,confidence});
    if(mode==='raw'&&value!==null&&confidence>=89 && font.candidate==null)break;
  }
  const raw=rawReads.find(v=>v.mode==='raw');
  const enhanced=rawReads.find(v=>v.mode==='enhanced');
  const tentative=Number.isSafeInteger(font.candidate)?font.candidate:null;
  // Agreement between two pixel thresholds AND independently processed OCR,
  // confirmed again over at least three separate screen frames.
  if(tentative!==null && enhanced?.value===tentative){
    const rawMismatch=raw?.value!==null&&raw?.value!==tentative;
    if(rawMismatch&&raw.confidence>=86)
      return {value:null,source:'conflict',note:details.join(' | ')+
        ' · high-confidence raw OCR conflicts with template/enhanced reading; no auto-confirmation'};
    return {value:tentative,source:'visual-consensus',quality:rawMismatch?.55:.67,
      note:details.join(' | ')+(rawMismatch?
        ' · raw OCR disagreement; provisional template/enhanced consensus (requires 3+ frames)':
        ' · template thresholds and enhanced OCR agree (requires 3+ frames)')};
  }
  if(raw?.value!==null&&enhanced?.value!==null &&
      raw.value===enhanced.value&&raw.confidence>=42&&enhanced.confidence>=25 &&
      (tentative===null||tentative===raw.value))
    return {value:raw.value,source:'ocr-agreement',quality:Math.min(1,(raw.confidence+enhanced.confidence)/200),
      note:details.join(' | ')+' · two processed OCR reads agree; confirm across frames'};
  // If the partial atlas disagrees with a decent raw OCR result, withhold rather
  // than rewriting a 3/8/5 as another numeral.
  if(tentative!==null && raw?.value!==null && raw.value!==tentative)
    return {value:null,source:'conflict',note:details.join(' | ')+
      ' · conflicting digits; no verified enhancement agreement; keeping previous balance'};
  if(raw?.value!==null&&raw.confidence>=82&&tentative===null)
    return {value:raw.value,source:'ocr-single',quality:raw.confidence/100,
      note:details.join(' | ')+' · strong raw OCR candidate; requires repeated scans'};
  return {value:null,source:'uncertain',note:details.join(' | ')+
    ' · no trustworthy cross-check; previous balance retained'};
}
async function scanMesos(generation){
  if(!state.running||!state.stream||!video.videoWidth||extras.mesoBusy||generation!==mesosGeneration)return;
  extras.mesoBusy=true;
  try{
    const frame=framePixels();
    const hit=findInventoryFooter(frame,extras.inventory);
    extras.inventory=hit;
    extras.inventoryOpen=!!hit;
    if(!hit){
      extras.mesoStatus=extras.mesoWhen?'Textbox not visible · last confirmed '+extras.mesoWhen.toLocaleTimeString():
        'Looking for the white mesos textbox anywhere on screen';
      $('mesoOCRDetails').textContent='Mesos textbox not found in current frame. Move or open your inventory.';
      return;
    }
    const field=locateMesosField(frame,hit);
    if(!field.rect)return;
    drawMesosPreview(field.rect,frame);
    // Try pixel templates first; delay creating an OCR worker unless needed.
    let read=await readMesosFast(null,field.rect,frame);
    if(read.value===null){
      let worker=null;
      try{worker=await getMesosWorker();}catch(_error){/* report template uncertainty below */}
      if(generation!==mesosGeneration||!state.running)return;
      if(worker)read=await readMesosFast(worker,field.rect,frame);
    }
    if(generation!==mesosGeneration||!state.running)return;
    extras.lastMesoAttempt=Date.now();
    extras.mesoRawNote=read.note;
    $('mesoOCRDetails').textContent=`${field.note}\n${read.note}\nCandidate: ${read.value===null?'unreadable':fmt(read.value)} (${read.source||'unknown'})`;
    if(read.value!==null){
      const accepted=acceptMesos(read);
      extras.mesoStatus=accepted?`Confirmed ${fmt(read.value)} at ${new Date().toLocaleTimeString()}`:
        `Verifying ${fmt(extras.mesoPending?.value??read.value)} · ${extras.mesoPending?.count??1}/${extras.mesoPending?.needed??2} frames`;
    }else{
      extras.mesoVotes=(extras.mesoVotes||[]).filter(v=>Date.now()-v.time<14000);
      extras.mesoStatus='Textbox found · digit recognition uncertain';
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
  void scanMesos(generation);
  mesosTimer=setInterval(()=>void scanMesos(generation),MESO_SCAN_MS);
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
function savePotions(){try{localStorage.setItem(POTION_STORAGE_KEY,JSON.stringify(potions))}catch(_e){}}
function renderPotions(){
  for(const kind of ['hp','mp']){
    const p=potions[kind];
    const label=$(kind+'PotionStatus');
    label.textContent=p.count===null?'No baseline recorded':
      `${fmt(p.count)} in latest update · ${fmt(p.used)} used · ${fmt(p.spent)} mesos estimated`;
    const select=$(kind+'PotionType');
    if(p.type&&Object.hasOwn(POTION_NPC_PRICES[kind],p.type)&&
      [...select.options].some(o=>o.value===p.type))select.value=p.type;
    if(p.count!==null&&$(kind+'PotionCount').value==='')$(kind+'PotionCount').value=String(p.count);
    const selection=select.value;
    const price=Object.hasOwn(POTION_NPC_PRICES[kind],selection)?
      POTION_NPC_PRICES[kind][selection]:null;
    $(kind+'PotionPriceDisplay').textContent=price===null?
      'Choose an item to view NPC price':
      'NPC price: '+fmt(price)+' mesos each';
  }
  $('potionSpend').textContent=fmt(potionSpent());
}
for(const kind of ['hp','mp']){
  $(kind+'PotionType').addEventListener('change',()=>{
    const type=$(kind+'PotionType').value;
    const price=Object.hasOwn(POTION_NPC_PRICES[kind],type)?POTION_NPC_PRICES[kind][type]:null;
    $(kind+'PotionPriceDisplay').textContent=price===null?
      'Choose an item to view NPC price':'NPC price: '+fmt(price)+' mesos each';
  });
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
    $('potionNote').textContent=notes.join(' · ')+'. Potion spending is an estimate, not double-counted in mesos balance.';
  }
});
$('resetPotionBtn').addEventListener('click',()=>{
  for(const kind of ['hp','mp']){
    potions[kind].count=null;
    $(kind+'PotionCount').value='';
  }
  savePotions();renderPotions();showExtraStats();
  $('potionNote').textContent='Potion counts reset. Enter your restocked amount and update to establish a new baseline. Previous estimated spending is retained.';
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
$('setMesoSnapshot').addEventListener('click',()=>{
  const value=safeAmount($('manualMesoBalance').value,1000000000000);
  if(value===null){$('mesoDebug').textContent='Enter an exact non-negative meso balance.';return;}
  saveMesosSnapshot(value);
  $('manualMesoBalance').value='';$('mesoDebug').textContent='Manual mesos snapshot saved for the active-session history.';showExtraStats();
});