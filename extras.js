'use strict';
// Optional net-mesos measurements. Works only with browser-provided
// video frames; never accesses MapleStory processes, memory, files, or controls.
const extras={inventory:null,lastFind:0,inventoryOpen:false,
  mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,mesoBusy:false,mesoStatus:'',
  lastMesoAttempt:0,lastInvFind:0};
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
  const known=extras.mesosStart!==null&&extras.mesosCurrent!==null;
  const delta=known?extras.mesosCurrent-extras.mesosStart:null;
  const hours=extras.mesoWhen&&extras.mesoStartWhen?(extras.mesoWhen-extras.mesoStartWhen)/3600000:0;
  $('mesoBalance').textContent=extras.mesosCurrent===null?'—':fmt(extras.mesosCurrent);
  $('mesoDelta').textContent=delta===null?'—':`${delta>0?'+':''}${fmt(delta)}`;
  $('mesoPerHour').textContent=delta!==null&&hours>1/3600?fmt(Math.round(delta/hours)):'—';
  const profit=$('netProfit');
  profit.textContent=delta===null?'—':`${delta>0?'+':''}${fmt(delta)}`;
  profit.className=delta===null?'profit-unknown':delta>0?'profit-positive':delta<0?'profit-negative':'profit-zero';
  const badge=$('profitBadge');
  badge.textContent=delta===null?'Waiting for balance':delta>0?'Mesos positive':delta<0?'Mesos negative':'Break-even';
  badge.className='profit-badge '+(delta>0?'positive':delta<0?'negative':'neutral');
  $('profitExplanation').textContent=delta===null?'Open your inventory to establish a starting balance; reopen it later to calculate net mesos change.':
    'Net balance change since the first snapshot. Includes purchases, sales, and other spending; potion consumption is not separately calculated.';
  $('mesoScanStatus').textContent=extras.mesoStatus || (extras.inventoryOpen?
    (extras.mesoWhen?'Inventory open · last confirmed '+extras.mesoWhen.toLocaleTimeString():extras.mesoPending?'Confirming '+fmt(extras.mesoPending.value)+'…':'Inventory open · reading balance…'):
    (extras.mesoWhen?'Inventory closed · last confirmed '+extras.mesoWhen.toLocaleTimeString():'Waiting for inventory'));
}
// Confirmation is based on SEPARATE captured frames, not on several OCR
// filters of the same image. Keep a rolling record across occasional failures.
function acceptMesos(read){
  const value=read?.value;
  if(!Number.isSafeInteger(value)||value<0||value>1000000000000)return false;
  if(value===extras.mesosCurrent){
    extras.mesoWhen=new Date();extras.mesoVotes=[];extras.mesoPending=null;
    return true;
  }
  const now=Date.now();
  extras.mesoVotes=(extras.mesoVotes||[]).filter(v=>now-v.time<30000).slice(-9);
  extras.mesoVotes.push({value,time:now,source:read.source||'unknown',quality:read.quality||0});
  // The 10-capture rolling history tolerates intermittent unreadable results,
  // but never counts a single OCR pass as multiple independent observations.
  const recent=extras.mesoVotes.slice(-10);
  const groups=new Map();
  for(const vote of recent){
    const g=groups.get(vote.value)||{count:0,strong:0,quality:0};
    g.count++;g.quality+=vote.quality;
    if(vote.source==='font'||vote.source==='ocr-agreement')g.strong++;
    groups.set(vote.value,g);
  }
  const rank=[...groups].sort((a,b)=>b[1].count-a[1].count || b[1].quality-a[1].quality);
  const leader=rank[0],runner=rank[1];
  // Strong independent recognition needs three captures; OCR-only reads
  // need four. Large/suspicious jumps need an additional capture.
  const trusted=leader[1].strong>=2;
  let needed=trusted?3:4;
  const current=extras.mesosCurrent;
  if(current!==null){
    const huge=Math.abs(leader[0]-current)>Math.max(1000000,Math.ceil(current*.35));
    const digits=Math.abs(String(leader[0]).length-String(current).length)>1;
    if(huge||digits)needed++;
  }
  extras.mesoPending={value:leader[0],count:leader[1].count,needed};
  if(leader[1].count<needed || (runner && runner[1].count>=leader[1].count))return false;
  if(extras.mesosStart===null){extras.mesosStart=leader[0];extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=leader[0];extras.mesoWhen=new Date();
  extras.mesoPending=null;extras.mesoVotes=[];
  return true;
}
function resetExtras(){
  if(typeof stopMesosWatch==='function')stopMesosWatch();
  Object.assign(extras,{inventory:null,lastFind:0,inventoryOpen:false,
    mesosStart:null,mesosCurrent:null,mesoPending:null,mesoVotes:[],mesoWhen:null,mesoStartWhen:null,mesoBusy:false,mesoStatus:'',
    lastMesoAttempt:0,lastInvFind:0});
  if(state.running && state.stream)beginMesosWatch();
  showExtraStats();
}
// Dedicated mesos capture loop. An independent OCR worker prevents long EXP
// and level-recognition passes from delaying inventory snapshots. Video capture
// is still performed solely through the browser's user-approved screen share.
const MESO_SCAN_MS=2000;
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
function activeInventoryAnchor(frame,hit){
  if(!hit)return false;
  if(hit.footer){
    // A partially clipped inventory is fine if the meso textbox/footer is
    // still fully visible. Do not require the whole 338x469 inventory sprite.
    const pixel=(dx,dy)=>{
      const x=Math.round(hit.x+dx*hit.s),y=Math.round(hit.y+dy*hit.s);
      if(x<0||y<0||x>=frame.width||y>=frame.height)return null;
      const i=(y*frame.width+x)*4,d=frame.data;return [d[i],d[i+1],d[i+2]];
    };
    const white=(x,y)=>{const v=pixel(x,y);return !!v&&v.every(a=>a>235);};
    const rails=[450,451,452].map(y=>pixel(80,y)),label=pixel(280,446);
    return white(75,440)&&white(170,440)&&rails.some(rail=>rail&&rail[0]<100&&rail[2]>rail[1]+20)&&
      ((label&&label[2]>label[0]+12)||(!label&&hit.x+285*hit.s>=frame.width));
  }
  return !!(hit.x>=0&&hit.y>=0&&hit.x+hit.m.w<=frame.width&&hit.y+hit.m.h<=frame.height&&
    anchorScore(frame,hit.m,hit.x,hit.y)>.77);
}
// The inventory moves freely. Locate the white counter box *inside* the
// recognized inventory on each scan instead of assuming one fixed digit crop.
// Its broad white field has a stable position relative to the inventory sprite;
// the text is right-aligned, so use the inner right edge to get the whole number.
function locateMesosField(frame,inv){
  if(!frame||!inv)return {rect:null,note:'No inventory frame'};
  const W=frame.width,H=frame.height,data=frame.data;
  const s=inv.s;
  const at=(ix,iy)=>{
    const x=Math.round(inv.x+ix*s),y=Math.round(inv.y+iy*s);
    if(x<0||x>=W||y<0||y>=H)return null;
    const j=(y*W+x)*4;
    return [data[j],data[j+1],data[j+2]];
  };
  const white=rgb=>rgb&&rgb[0]>=235&&rgb[1]>=235&&rgb[2]>=235&&
    Math.max(...rgb)-Math.min(...rgb)<22;
  // Search for the bright horizontal white row between the gray footer rails.
  // Multiple x probes avoid matching occasional bright pixels in the item grid.
  let best=null,run=null;
  for(let y=417;y<=465;y++){
    let count=0;
    for(const x of [66,88,119,146,171])if(white(at(x,y)))count++;
    if(count>=4){
      if(!run)run={start:y,end:y};
      else run.end=y;
    }else if(run){
      if(!best||run.end-run.start>best.end-best.start)best=run;
      run=null;
    }
  }
  if(run&&(!best||run.end-run.start>best.end-best.start))best=run;
  if(!best||best.end-best.start<11)return {rect:null,note:'The white mesos-number field is not visible (inventory may be clipped/covered).'};
  const edgeY=best.start+2;
  // The right inside edge of the white textbox is near x=267, but determine
  // it from the actual frame so slight differences in the window don't shift
  // the crop onto MESOS lettering.
  let right=268;
  for(let x=260;x<=281;x++){
    if(!white(at(x,edgeY))){right=x-1;break;}
  }
  if(right<250||right>280)return {rect:null,note:'Could not find the right edge of the mesos textbox.'};
  // Max 14 digits and commas occupy <100 original pixels. Keep all leading
  // figures; the rest of the white field is empty and safe for OCR.
  let leftInk=Infinity;
  for(let y=best.start+4;y<=best.end-2;y++){
    for(let x=54;x<=right-4;x++){
      const rgb=at(x,y);
      if(!rgb)continue;
      const max=Math.max(...rgb),min=Math.min(...rgb);
      if(max<175 && max-min<26)leftInk=Math.min(leftInk,x);
    }
  }
  if(!Number.isFinite(leftInk))return {rect:null,note:'White mesos field found but no readable dark digits inside it.'};
  const x0=Math.max(44,leftInk-6),x1=Math.min(279,right+1);
  const y0=best.start+1,y1=best.end-1;
  const rect=relativeRect(inv,x0,y0,Math.max(10,x1-x0),Math.max(10,y1-y0));
  if(rect.x<0||rect.y<0||rect.x+rect.w>W||rect.y+rect.h>H)
    return {rect:null,note:'Inventory footer extends outside the shared window.'};
  return {rect,note:`Mesos textbox x=${x0}..${x1}, y=${best.start}..${best.end}, capture ${rect.w}×${rect.h}`};
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
  if(!rect)return {value:null,note:'Mesos field not visible.'};
  // First, attempt to recognize individual glyphs from the authentic
  // screenshot-trained mesos font atlas. Missing digits are never guessed.
  const font=typeof readMesosDigits==='function'?readMesosDigits(sourceFrame,rect):{value:null,note:'Font reader unavailable'};
  if(!worker){
    if(font.value!==null&&font.score>=.78)
      return {value:font.value,source:'font',quality:font.score,note:'font: '+font.note+' · OCR unavailable'};
    return {value:null,note:'font: '+font.note+' · OCR unavailable'};
  }
  await worker.setParameters({
    tessedit_char_whitelist:'0123456789,',
    tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE
  });
  const details=[`font: ${font.note}`],ocr=[];
  // OCR remains the fallback for glyphs absent from the verified template
  // library (notably 0, 1, 5 and 8) and a cross-check for known digits.
  for(const mode of ['raw','ink']){
    const canvas=mode==='ink'?inkOnlyMesosImage(rect,sourceFrame):snapshotImage(rect,mode,sourceFrame);
    if(!canvas)break;
    const out=await worker.recognize(canvas);
    const raw=String(out.data.text||'').trim(),conf=Math.round(Number(out.data.confidence)||0);
    const value=parseMesosText(raw);
    details.push(`${mode}: ${JSON.stringify(raw)} (${conf}%)`);
    // Weak OCR can contribute supporting evidence if both independently
    // processed images agree. It can never immediately change mesos totals.
    if(value!==null&&conf>=22)ocr.push({value,conf,mode});
    if(mode==='raw'&&font.value!==null&&font.value===value&&conf>=75)break;
  }
  const ocrCounts=new Map();
  for(const v of ocr){const g=ocrCounts.get(v.value)||{n:0,total:0,max:0};g.n++;g.total+=v.conf;g.max=Math.max(g.max,v.conf);ocrCounts.set(v.value,g);}
  const ranked=[...ocrCounts.entries()].sort((a,b)=>b[1].n-a[1].n||b[1].total-a[1].total);
  const top=ranked[0];
  if(font.value!==null&&font.score>=.72){
    // High-confidence disagreement with an independent engine is an
    // explicit ambiguity rather than permission to overwrite the balance.
    if(top&&top[0]!==font.value&&top[1].max>=72)
      return {value:null,source:'conflict',note:details.join(' | ')+' · font/OCR conflict'};
    return {value:font.value,source:'font',quality:font.score,
      note:details.join(' | ')+(top?.[0]===font.value?' · font and OCR agree':' · font candidate; confirm over time')};
  }
  if(ranked.length>1&&ranked[0][1].n===ranked[1][1].n)
    return {value:null,source:'conflict',note:details.join(' | ')+' · conflicting OCR values'};
  if(top&&top[1].n>=2)
    return {value:top[0],source:'ocr-agreement',quality:Math.min(1,top[1].total/180),
      note:details.join(' | ')+' · OCR preprocessing agrees; verifying across frames'};
  if(top&&top[1].max>=78)
    return {value:top[0],source:'ocr-single',quality:top[1].max/150,
      note:details.join(' | ')+' · high-confidence OCR candidate; needs extra captures'};
  return {value:null,source:'uncertain',note:details.join(' | ')+' · insufficient evidence'};
}
async function scanMesos(generation){
  if(!state.running||!state.stream||!video.videoWidth||extras.mesoBusy||generation!==mesosGeneration)return;
  extras.mesoBusy=true;
  try{
    const now=Date.now();
    const frame=framePixels();
    const previous=extras.inventory;
    if(!activeInventoryAnchor(frame,previous)){extras.inventory=null;extras.lastInvFind=0;}
    if(!extras.inventory && now-extras.lastInvFind>=1800){
      extras.lastInvFind=now;
      extras.inventory=findInventoryFooter(frame)||findVisualAnchor(frame,'inventory');
    }
    const inv=extras.inventory;
    extras.inventoryOpen=!!inv;
    if(!inv){
      extras.mesoPending=null;extras.mesoVotes=[];
      extras.mesoStatus=extras.mesoWhen?'Inventory footer not visible · last confirmed '+extras.mesoWhen.toLocaleTimeString():
        'Waiting for visible inventory footer · checking again shortly';
      return;
    }
    extras.mesoStatus='Inventory found · reading…';
    showExtraStats();
    let worker=null;
    try{worker=await getMesosWorker();}
    catch(error){worker=null;}
    if(generation!==mesosGeneration||!state.running)return;
    // Reacquire from the new frozen frame below. Inventory may have moved
    // while the OCR worker loaded, so don't reject a stale screen coordinate.
    // Locate AND OCR on the SAME captured frame. The player may move the
    // inventory between two live video reads; never use a stale rectangle.
    const frozen=framePixels();
    // Window can move while OCR initializes. Reacquire the footer from this
    // precise frozen frame instead of using the previous window coordinates.
    let freshInv=inv;
    if(!activeInventoryAnchor(frozen,freshInv))freshInv=findInventoryFooter(frozen);
    if(!freshInv){
      extras.inventory=null;extras.inventoryOpen=false;extras.mesoPending=null;extras.mesoVotes=[];
      extras.lastInvFind=0;
      extras.mesoStatus='Inventory moved or footer obscured · searching again';
      return;
    }
    extras.inventory=freshInv;
    const field=locateMesosField(frozen,freshInv);
    const read=field.rect?await readMesosFast(worker,field.rect,frozen):{value:null,note:field.note};
    if(generation!==mesosGeneration||!state.running)return;
    extras.lastMesoAttempt=Date.now();
    if(read.value!==null){
      const accepted=acceptMesos(read);
      extras.mesoStatus=accepted?`Confirmed ${fmt(read.value)} · ${new Date().toLocaleTimeString()}`:
        `Verifying ${fmt(extras.mesoPending?.value??read.value)} · ${extras.mesoPending?.count??1}/${extras.mesoPending?.needed??3} matching scans`;
    }else{
      // Do not wipe valid previous observations because a single capture was blurry.
      extras.mesoVotes=(extras.mesoVotes||[]).filter(v=>Date.now()-v.time<30000);
      extras.mesoStatus=field.rect?(extras.mesoWhen?'OCR uncertain · showing last confirmed balance':'Mesos digits unclear · checking again'):'Inventory found · number field obstructed or unreadable';
    }
    $('mesoDebug').textContent=`Inventory match ${Math.round(freshInv.score*100)}% · Mesos field: ${field.note}\nOCR: ${read.note}\n`+
      (extras.mesoPending?`Matching frames: ${extras.mesoPending.count}/${extras.mesoPending.needed}`:'No confirmed candidate')+
      '\nNext mesos scan: ~2 seconds (EXP scanning independently).';
  }catch(error){
    extras.mesoStatus='Mesos scan issue · keeping last confirmed balance';
    $('mesoDebug').textContent='Mesos scan: '+String(error?.message||error);
  }finally{extras.mesoBusy=false;showExtraStats();}
}
function beginMesosWatch(){
  if(mesosTimer!==null)return;
  const generation=++mesosGeneration;
  extras.lastInvFind=0;extras.mesoStatus='Looking for inventory · 2-second scan interval';
  void scanMesos(generation);
  mesosTimer=setInterval(()=>void scanMesos(generation),MESO_SCAN_MS);
}
function stopMesosWatch(){
  if(mesosTimer!==null){clearInterval(mesosTimer);mesosTimer=null;}
  ++mesosGeneration;
}

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
  if(extras.mesosStart===null){extras.mesosStart=value;extras.mesoStartWhen=new Date();}
  extras.mesosCurrent=value;extras.mesoWhen=new Date();extras.mesoPending=null;extras.mesoVotes=[];
  $('manualMesoBalance').value='';$('mesoDebug').textContent='Manual mesos snapshot saved. Net change uses confirmed balances.';showExtraStats();
});