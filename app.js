'use strict';
// All capture and OCR happen in the visitor's browser. No upload endpoints are used.
const $ = id => document.getElementById(id);
const video = $('video');
const state = {
  stream: null, regions: {exp:null,level:null},
  autoAnchor:null, autoScore:null, autoBusy:false, detectorNote:'', frameDims:null,
  running: false, busy: false, cycle: 0,
  interval: null, worker: null, workerPromise: null,
  levelTimer: null, levelBusy: false, levelWorker: null, levelWorkerPromise: null,
  sessionStart:null, lastExp:null, currentExp:null, currentPct:null,
  expGained:0, pctGained:0, levelUps:0, gains:[], elapsedCache:0,
  scanStarted:0, currentLevel:null, identityChecked:0, identityLockLevel:false, accountedLevel:null, pendingLevel:null,
  levelCandidate:null, levelReads:0, lastOCRNote:''
};
const fmt = n => Number.isSafeInteger(n) ? n.toLocaleString('en-US') : '—';
const fmtPct = n => Number.isFinite(n) ? n.toFixed(2)+'%' : '—';
function setStatus(msg,kind='neutral'){
  $('statusText').textContent = msg;
  $('statusDot').className = kind === 'good' ? 'good' : kind === 'warn' ? 'warn' : '';
}
function badge(msg){ $('readingBadge').textContent=msg; }
function refreshButtons(){
  const sharing=!!state.stream;
  $('shareBtn').disabled=sharing;
  $('stopShareBtn').disabled=!sharing;
  $('autoDetectBtn').disabled=!sharing||state.autoBusy;
  $('startBtn').disabled=!sharing||!state.regions.exp||state.running;
  $('pauseBtn').disabled=!state.running;
  $('sharePill').textContent=sharing?'● Sharing window':'Not sharing';
}
function pause(){state.running=false;state.cycle++;clearInterval(state.interval);state.interval=null;
  clearInterval(state.levelTimer);state.levelTimer=null;
  if(typeof stopMesosWatch==='function')stopMesosWatch();refreshButtons();}
function reset(){
  state.sessionStart=null;state.lastExp=null;state.currentExp=null;state.currentPct=null;
  state.currentLevel=null;state.identityChecked=0;state.identityLockLevel=false;state.accountedLevel=null;state.pendingLevel=null;
  state.levelCandidate=null;state.levelReads=0;state.lastOCRNote='';
  state.expGained=0;state.pctGained=0;state.levelUps=0;state.gains=[];
  if(typeof resetExtras==='function')resetExtras();
  $('currentExp').textContent='—';$('currentPct').textContent='—';$('perHour').textContent='0';
  $('gained').textContent='0';$('rolling').textContent='0';$('pctGained').textContent='0.00%';
  $('pctHour').textContent='—';$('eta').textContent='—';$('elapsed').textContent='00:00';
  $('levelUps').textContent='0';$('progressBar').style.width='0%';$('progressLabel').textContent='—';
  $('lastScan').textContent='—';$('expStatus').textContent='Waiting';$('levelStatus').textContent='Waiting';
  $('scanDuration').textContent='—';$('ocrDetails').textContent='OCR has not started.';badge('Idle');
  $('characterLevel').textContent='—';$('levelSource').textContent='Level needed to calculate %';
  $('expFraction').textContent='— / — EXP';$('expRemaining').textContent='— remaining';$('requiredExp').textContent='—';$('levelStatus').textContent='Waiting';$('quickLevel').value='';
}
function stopSharing(){
  pause();if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  state.stream=null;video.srcObject=null;
  state.regions={exp:null,level:null};state.autoAnchor=null;state.frameDims=null;
  if(typeof resetExtras==='function')resetExtras();
  refreshButtons();setStatus('Sharing stopped.');
}
$('shareBtn').addEventListener('click',async()=>{
  if(!navigator.mediaDevices?.getDisplayMedia){setStatus('Screen sharing requires HTTPS and Chrome/Edge.','warn');return;}
  let stream=null;
  try{
    stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:2},audio:false});
    if(state.stream)stopSharing();
    state.stream=stream;video.srcObject=stream;await video.play();
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(state.stream===stream)stopSharing();},{once:true});
    state.regions={exp:null,level:null};pause();reset();
    refreshButtons();setStatus('Connected. Locating the EXP HUD…');
    await autoDetectAndStart();
  }catch(e){if(stream)stream.getTracks().forEach(t=>t.stop());setStatus('Could not share: '+(e.message||e.name),'warn');}
});
$('stopShareBtn').addEventListener('click',stopSharing);
$('pauseBtn').addEventListener('click',()=>{pause();setStatus('Paused. Click Resume to continue.');badge('Paused');});
$('resetBtn').addEventListener('click',()=>{pause();reset();setStatus('Session reset. Your game connection is kept.');});
// Static EXP logo sample taken from the user's supplied MapleStory screenshot.
// Only the 43x20-pixel letters and their border are retained; no game data is embedded.
let templatePromise=null;
function loadAnchorTemplate(){
  if(templatePromise)return templatePromise;
  templatePromise=new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>{
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,c.width,c.height).data;
      const lum=[];for(let i=0;i<data.length;i+=4)lum.push((data[i]*77+data[i+1]*150+data[i+2]*29)/256);
      resolve({width:c.width,height:c.height,lum});
    };img.onerror=()=>reject(new Error('EXP logo reference image failed to load.'));
    img.src='data:image/png;base64,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';
  });return templatePromise;
}
const frameBuffer=document.createElement('canvas');
const frameCtx=frameBuffer.getContext('2d',{willReadFrequently:true});
function framePixels(){
  const w=video.videoWidth,h=video.videoHeight;
  if(video.readyState<2||!w||!h)throw Error('No video frame available. Make sure MapleStory is visible.');
  if(frameBuffer.width!==w||frameBuffer.height!==h){frameBuffer.width=w;frameBuffer.height=h;}
  frameCtx.drawImage(video,0,0,w,h);
  return {width:w,height:h,data:frameCtx.getImageData(0,0,w,h).data};
}
function makeMatcher(template,scale){
  const p=[];
  for(let ty=2;ty<template.height-1;ty+=3)for(let tx=2;tx<template.width-1;tx+=3){
    p.push({dx:Math.round(tx*scale),dy:Math.round(ty*scale),v:template.lum[ty*template.width+tx]});
  }
  const mean=p.reduce((sum,q)=>sum+q.v,0)/p.length;
  let varT=0;for(const q of p){q.v-=mean;varT+=q.v*q.v;}
  return {p,varT,width:Math.round(template.width*scale),height:Math.round(template.height*scale),scale};
}
function patchScore(frame,m,x,y){
  const pix=frame.data,W=frame.width,p=m.p,n=p.length;
  let a=0,aa=0,ab=0;
  for(let i=0;i<n;i++){
    const q=p[i],j=((y+q.dy)*W+(x+q.dx))*4;
    const v=(pix[j]*77+pix[j+1]*150+pix[j+2]*29)/256;
    a+=v;aa+=v*v;ab+=v*q.v;
  }
  const variance=aa-a*a/n;
  return variance>1?ab/Math.sqrt(variance*m.varT):0;
}
// Prefer the bottom-center expected location, then fall back to the rest of
// the lower HUD strip for unusual resolutions / window sizes.
function locateLogo(frame,template){
  const W=frame.width,H=frame.height;
  // MapleStory may render the HUD at a fixed pixel size or scale it.
  const scales=[1,.8,1.25,.65,1.5,2];
  let best=null;
  function scan(x0,x1,y0,y1,step){
    for(const scale of scales){
      const m=makeMatcher(template,scale);
      const minX=Math.max(0,Math.floor(x0)),maxX=Math.min(W-m.width,Math.ceil(x1));
      const minY=Math.max(0,Math.floor(y0)),maxY=Math.min(H-m.height,Math.ceil(y1));
      for(let y=minY;y<=maxY;y+=step)for(let x=minX;x<=maxX;x+=step){
        const score=patchScore(frame,m,x,y);
        if(!best||score>best.score)best={x,y,score,scale};
      }
      if(best&&best.score>.9)break;
    }
  }
  scan(W/2-95,W/2+190,H-120,H-24,1);
  if(!best||best.score<.74){scan(W*.12,W*.85,H-205,H-18,2);}
  if(!best||best.score<.72)return null;
  // Refine candidate to single pixel in order not to cut off the 1-pixel glyph strokes.
  const m=makeMatcher(template,best.scale),old=best;
  for(let y=Math.max(0,old.y-3);y<=Math.min(H-m.height,old.y+3);y++)
    for(let x=Math.max(0,old.x-3);x<=Math.min(W-m.width,old.x+3);x++){
      const score=patchScore(frame,m,x,y);
      if(score>best.score)best={x,y,score,scale:old.scale};
    }
  return best;
}
function greenGroups(frame,anchor){
  const {width:W,height:H,data:p}=frame;
  const {x,y,scale:s}=anchor,groups=[];
  let open=null;
  const left=Math.round(x+52*s),right=Math.min(W-1,Math.round(x+350*s));
  for(let xx=left;xx<=right+1;xx++){
    let hits=0;
    if(xx<=right)for(let yy=Math.max(0,Math.round(y+5*s));yy<=Math.min(H-1,Math.round(y+18*s));yy++){
      const i=(yy*W+xx)*4,r=p[i],g=p[i+1],b=p[i+2];
      if(g>112&&g>r*1.13&&g>b*1.25&&g-r>20)hits++;
    }
    const colored=hits>=Math.max(2,Math.round(4*s));
    if(colored&&!open)open={start:xx,last:xx};
    else if(colored&&open)open.last=xx;
    else if(!colored&&open){
      const mid=(open.start+open.last)/2;
      if(open.last-open.start<=Math.round(10*s))groups.push(mid);
      open=null;
    }
  }
  // The left and right lime-green brackets must be nearby and in order.
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j],width=b-a;
    if(a-x<65*s||a-x>270*s||width<25*s||width>115*s)continue;
    return [a,b];
  }
  return null;
}
function areasFromAnchor(frame,anchor){
  const bars=greenGroups(frame,anchor);
  if(!bars)return null;
  const [a,b]=bars,s=anchor.scale;
  const yy=Math.max(0,Math.round(anchor.y)),hh=Math.round(21*s);
  const expx=Math.round(anchor.x+41*s),expend=Math.round(a-3.5*s);
  const pctx=Math.round(a+1.5*s),pctend=Math.round(b-1*s);
  const exp={x:expx,y:yy,w:expend-expx,h:Math.min(hh,frame.height-yy)};
  const pct={x:pctx,y:yy,w:pctend-pctx,h:Math.min(hh,frame.height-yy)};
  if(exp.w<15||pct.w<15||exp.h<8||expx<0||pctend>frame.width)return null;
  return {exp,pct,bars};
}
async function detectHUD(){
  const template=await loadAnchorTemplate();
  const frame=framePixels();
  const anchor=locateLogo(frame,template);
  if(!anchor)throw Error('Could not confidently find the MapleStory EXP label. Check that your EXP bar is visible in the shared window.');
  const areas=areasFromAnchor(frame,anchor);
  if(!areas)throw Error(`Found the EXP label (${Math.round(anchor.score*100)}% match), but not the two green percentage brackets. Try Find EXP again or manual selection.`);
  state.autoAnchor=anchor;state.autoScore=anchor.score;state.frameDims={w:frame.width,h:frame.height};
  const s=anchor.scale;
  // The bottom HUD displays: "LV. 34 | Page / Vanrion | HP ... MP ... EXP ...".
  // Distances are measured relative to the EXP logo from the user's reference screenshot.
  const rect=(dx,dy,w,h)=>({x:Math.round(anchor.x+dx*s),y:Math.round(anchor.y+dy*s),w:Math.round(w*s),h:Math.round(h*s)});
  const valid=r=>r.x>=0&&r.y>=0&&r.x+r.w<=frame.width&&r.y+r.h<=frame.height;
  // In the reference screenshot the LV. orange badge starts about 611 pixels
  // LEFT of the EXP logo (the old -494 box missed it completely).
  const level=rect(-630,4,80,39);
  state.regions={exp:areas.exp,level:valid(level)?level:null};
  state.detectorNote=`EXP label matched (${Math.round(anchor.score*100)}%), green brackets found. Capture ${frame.width}×${frame.height}.`;
  refreshButtons();
  return state.detectorNote;
}
async function autoDetectAndStart(){
  if(!state.stream)return;
  state.autoBusy=true;refreshButtons();pause();
  try{
    let msg,lastError;
    for(let tries=0;tries<4;tries++){
      try{msg=await detectHUD();break;}catch(e){lastError=e;if(tries<3)await new Promise(resolve=>setTimeout(resolve,450));}
    }
    if(!msg)throw lastError;
    setStatus(msg+' Tracking will begin automatically.','good');
    startTracking();
  }catch(err){
    setStatus((err.message||String(err))+' Make sure the EXP HUD is visible, then retry.','warn');
    badge('HUD not found');
  }finally{state.autoBusy=false;refreshButtons();}
}
$('autoDetectBtn').addEventListener('click',async()=>{
  pause();state.regions={exp:null,level:null};refreshButtons();
  setStatus('Searching for MapleStory EXP bar…');
  await autoDetectAndStart();
});
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
const cropBuffer=document.createElement('canvas'),cropContext=cropBuffer.getContext('2d',{willReadFrequently:true});
function prepareCrop(key,nearest=false){
  const r=state.regions[key];if(!r)throw Error('Select an area first.');
  if(video.readyState<2||!video.videoWidth)throw Error('The shared game window is not providing video frames.');
  const configuredZoom=Number($('zoom').value);
  const z=Math.min(configuredZoom,Math.max(2,Math.floor(1800/(r.w+4))));
  const sw=r.w*z,sh=r.h*z;
  const c=document.createElement('canvas');c.width=sw;c.height=sh;
  const cctx=c.getContext('2d',{willReadFrequently:true});
  cctx.imageSmoothingEnabled=!nearest;cctx.imageSmoothingQuality='high';
  cctx.drawImage(video,r.x,r.y,r.w,r.h,0,0,sw,sh);
  return c;
}
function otsu(hist,total){
  let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let weightBg=0,sumBg=0,best=0,threshold=128;
  for(let i=0;i<256;i++){
    weightBg+=hist[i];if(!weightBg)continue;
    const weightFg=total-weightBg;if(!weightFg)break;
    sumBg+=i*hist[i];const meanBg=sumBg/weightBg,meanFg=(sum-sumBg)/weightFg;
    const between=weightBg*weightFg*(meanBg-meanFg)**2;
    if(between>best){best=between;threshold=i;}
  }
  return threshold;
}
function enhance(canvas,method){
  const result=document.createElement('canvas');result.width=canvas.width;result.height=canvas.height;
  const rc=result.getContext('2d',{willReadFrequently:true});rc.drawImage(canvas,0,0);
  const im=rc.getImageData(0,0,result.width,result.height),data=im.data,n=data.length/4;
  const gray=new Uint8Array(n),hist=new Uint32Array(256);
  for(let i=0,j=0;i<data.length;i+=4,j++){
    const v=Math.round(data[i]*0.2126+data[i+1]*0.7152+data[i+2]*0.0722);
    gray[j]=v;hist[v]++;
  }
  // Source game UI often has pale text on a dark status bar.
  const corner=[gray[0],gray[result.width-1],gray[(result.height-1)*result.width],gray[n-1]];
  const cornerMean=corner.reduce((a,b)=>a+b,0)/4;
  const inkMode=$('inkMode').value;
  const light=inkMode==='light'||(inkMode==='auto'&&cornerMean<125);
  const threshold=clamp(otsu(hist,n)+Number($('threshold').value)+(method==='alternate'?-23:0),15,245);
  // For grayscale, stretch contrast after first inverting the text color if necessary.
  let low=0,high=255,count=0;
  for(let i=0;i<256;i++){count+=hist[i];if(count>=n*.01){low=i;break;}}
  count=0;for(let i=255;i>=0;i--){count+=hist[i];if(count>=n*.01){high=i;break;}}
  for(let i=0,j=0;i<data.length;i+=4,j++){
    let v;
    if(method==='binary'||method==='alternate'){
      v=light?(gray[j]>threshold?0:255):(gray[j]<threshold?0:255);
    }else{
      v=clamp(Math.round((gray[j]-low)*255/Math.max(1,high-low)),0,255);
      if(light)v=255-v;
    }
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  rc.putImageData(im,0,0);
  // White margins are added only AFTER auto-detecting the actual game background.
  // Adding them earlier would make a dark UI look like light-background text.
  const pad=14,withMargin=document.createElement('canvas');
  withMargin.width=result.width+pad*2;withMargin.height=result.height+pad*2;
  const mx=withMargin.getContext('2d');mx.fillStyle='#fff';
  mx.fillRect(0,0,withMargin.width,withMargin.height);
  mx.drawImage(result,pad,pad);
  return withMargin;
}
function readCandidates(raw){
  const text=String(raw||'').replace(/[OoОо]/g,'0').replace(/[Il|]/g,'1').replace(/\u00a0/g,' ');
  const candidates=[...text.matchAll(/\d(?:[\d,\.\s]*\d)?/g)]
    .map(m=>m[0].replace(/\D/g,''))
    .filter(v=>v.length>=1&&v.length<=15)
    .sort((a,b)=>b.length-a.length);
  if(!candidates.length)return null;
  const n=Number(candidates[0]);return Number.isSafeInteger(n)?n:null;
}
function showSample(key,canvas){
  const dest=$(key+'Crop');const x=dest.getContext('2d');
  dest.width=canvas.width;dest.height=canvas.height;
  x.clearRect(0,0,dest.width,dest.height);x.drawImage(canvas,0,0);
  $(key+'PreviewLabel').textContent=`${canvas.width} × ${canvas.height}`;
}
async function getWorker(){
  if(state.worker)return state.worker;
  if(state.workerPromise)return state.workerPromise;
  if(!window.Tesseract)throw Error('OCR library failed to load. Allow the Tesseract.js script and reload.');
  setStatus('Loading OCR engine; the first scan may take longer...');
  state.workerPromise=(async()=>{
    const worker=await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist:'0123456789,.',
      tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,
      preserve_interword_spaces:'1'
    });
    state.worker=worker;return worker;
  })();
  try{return await state.workerPromise;}finally{state.workerPromise=null;}
}
async function recognizeArea(key,worker){
  if(!state.regions[key])return {value:null,status:'No box selected',details:[]};
  const template=key==='exp'&&typeof expTemplateRead==='function'?expTemplateRead():null;
  const source=prepareCrop(key,false);
  const variants=[['High contrast',()=>enhance(source,'binary')],['Grayscale',()=>enhance(source,'gray')],['Adjusted threshold',()=>enhance(source,'alternate')],['Pixel-sharp',()=>enhance(prepareCrop(key,true),'gray')]];
  const max=$('ocrMode').value==='accuracy'?4:3;
  const tries=[],votes=new Map();
  for(let i=0;i<max;i++){
    const [name,fn]=variants[i],image=fn();
    if(i===0&&document.querySelector('.settings-panel').open)showSample(key,image);
    const result=await worker.recognize(image);
    const raw=(result.data.text||'').trim();
    const candidate=readCandidates(raw);
    const confidence=Math.round(Number(result.data.confidence)||0);
    tries.push({name,raw,candidate,confidence});
    if(candidate!==null){
      const voteKey=String(candidate);
      const item=votes.get(voteKey)||{value:candidate,count:0};item.count++;
      votes.set(voteKey,item);
      if(item.count>=2){
        // A strong template match must agree with OCR; conflicts get withheld.
        if(template?.value!==null&&template?.value!==undefined&&template.confidence>=86&&template.value!==item.value)
          return {value:null,status:'Pixel templates and OCR disagree; rejected',details:[...tries,{name:'Pixel templates',raw:template.text||template.reason,candidate:template.value,confidence:template.confidence}]};
        return {value:item.value,status:template?.value===item.value?'OCR + pixel templates agree':`Confirmed (${item.count} OCR passes; templates incomplete)`,details:[...tries,{name:'Pixel templates',raw:template?.text||template?.reason||'Unavailable',candidate:template?.value??null,confidence:template?.confidence||0}]};
      }
    }
  }
  return {value:null,status:'Uncertain — conflicting or missing readings',details:[...tries,{name:'Pixel templates',raw:template?.text||template?.reason||'Unavailable',candidate:template?.value??null,confidence:template?.confidence||0}]};
}
// The level characters are white glyphs INSIDE an orange rectangle.
// Previous code masked the orange background instead of these glyphs.
// Separate the badge from the dark HUD and threshold white ink only.
function prepareIdentitySource(key){
  const r=state.regions[key];if(!r||video.readyState<2)throw Error('Character HUD not visible');
  const canvas=document.createElement('canvas'),z=2;
  canvas.width=r.w*z;canvas.height=r.h*z;
  const cx=canvas.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=false;
  cx.drawImage(video,r.x,r.y,r.w,r.h,0,0,canvas.width,canvas.height);
  return canvas;
}
function orangeBadgeBounds(source){
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const w=source.width,h=source.height,d=ctx.getImageData(0,0,w,h).data;
  const xs=[],ys=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=4*(y*w+x),r=d[i],g=d[i+1],b=d[i+2];
    if(r>145 && r>g*1.3 && g>55 && g<195 && b<125 && g>b*1.28){xs.push(x);ys.push(y);}
  }
  if(xs.length<Math.max(35,w*h*0.035))return null;
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  // Ignore unrelated orange UI details; badge must have substantial area.
  // The badge occupies a small fraction of the level crop at many UI scales.
  // The old 35%-width/30%-height cutoffs rejected valid badges, meaning
  // the fallback OCR could never see an otherwise detectable orange label.
  if(right-left<Math.max(12,w*.16)||bottom-top<Math.max(8,h*.14)||
     right-left>w*.92||bottom-top>h*.92)return null;
  return {x:Math.max(0,left-1),y:Math.max(0,top-2),
    w:Math.min(w-1,right+1)-Math.max(0,left-1)+1,
    h:Math.min(h-1,bottom+2)-Math.max(0,top-2)+1};
}
function levelInk(source,cutoff=190){
  const bounds=orangeBadgeBounds(source);
  if(!bounds)return null;
  const result=document.createElement('canvas');
  const scale=5,pad=22;
  result.width=bounds.w*scale+pad*2;result.height=bounds.h*scale+pad*2;
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const src=ctx.getImageData(bounds.x,bounds.y,bounds.w,bounds.h).data;
  const mask=document.createElement('canvas');mask.width=bounds.w;mask.height=bounds.h;
  const dst=mask.getContext('2d'),im=dst.createImageData(bounds.w,bounds.h);
  for(let i=0;i<src.length;i+=4){
    const r=src[i],g=src[i+1],b=src[i+2];
    // White digits: high, near-neutral RGB. Background: saturated orange.
    const neutral=Math.max(r,g,b)-Math.min(r,g,b)<67;
    const ink=r>=cutoff&&g>=cutoff-12&&b>=cutoff-18&&neutral;
    im.data[i]=im.data[i+1]=im.data[i+2]=ink?0:255;im.data[i+3]=255;
  }
  dst.putImageData(im,0,0);
  const out=result.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,result.width,result.height);
  out.imageSmoothingEnabled=false;
  out.drawImage(mask,pad,pad,mask.width*scale,mask.height*scale);
  return result;
}
let levelWorkerUsed=false;
async function getLevelWorker(){
  if(state.levelWorker)return state.levelWorker;
  if(state.levelWorkerPromise)return state.levelWorkerPromise;
  if(!window.Tesseract)throw Error('OCR library unavailable');
  state.levelWorkerPromise=(async()=>{
    const w=await Tesseract.createWorker('eng');
    await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_WORD});
    state.levelWorker=w;return w;
  })();
  try{return await state.levelWorkerPromise;}finally{state.levelWorkerPromise=null;}
}
// Draw a single segmented level digit at OCR-friendly size. It uses only
// already shared screen pixels, and never reads MapleStory files or processes.
function singleLevelGlyphImage(glyph,invert=false){
  const source=document.createElement('canvas');source.width=10;source.height=16;
  const cx=source.getContext('2d'),data=cx.createImageData(10,16);
  for(let i=0;i<160;i++){
    const fg=glyph.bits[i]==='1';const v=fg?(invert?255:0):(invert?0:255);
    const k=i*4;data.data[k]=data.data[k+1]=data.data[k+2]=v;data.data[k+3]=255;
  }
  cx.putImageData(data,0,0);
  const out=document.createElement('canvas'),scale=14,pad=26;
  out.width=10*scale+2*pad;out.height=16*scale+2*pad;
  const ctx=out.getContext('2d');ctx.fillStyle=invert?'#000':'#fff';ctx.fillRect(0,0,out.width,out.height);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(source,pad,pad,10*scale,16*scale);
  return out;
}
function plausibleLevel(n){
  if(!Number.isInteger(n)||n<1||n>100)return false;
  // Once a level is confirmed, a passive screen read may only repeat that
  // level or report the very next level; anything else requires manual review.
  if(state.currentLevel!==null && n!==state.currentLevel && n!==state.currentLevel+1)return false;
  // The next-level EXP requirement is an independent sanity check for initial
  // detection (a stale EXP value should not silently select a wrong level).
  const requirement=expRequirement(n);
  if(state.currentLevel===null&&state.currentExp!==null&&requirement!==null&&state.currentExp>=requirement)return false;
  return true;
}
async function recognizeLevel(){
  if(!state.regions.level)return {value:null,status:'Level badge not located',details:['Try Find HUD again.']};
  const base=prepareIdentitySource('level');
  const template=mapleLevelPixelMatch(base);
  if(template.value!==null){
    // Known shapes are fast: no OCR is initialized or run for this level.
    if(!plausibleLevel(template.value))return {value:null,status:'Unexpected level; not accepted',details:[`Pixel match ${template.value} conflicts with current level or EXP` ]};
    return {value:template.value,method:'templates',status:`Pixel template match (${template.confidence}%)`,details:[template.reason+' => '+template.value]};
  }
  const segmented=mapleLevelGlyphs(base);
  const details=[`Pixel templates: ${template.reason}`];
  if(!segmented.glyphs)return {value:null,status:'Could not segment orange level digits',details:[...details,segmented.reason]};
  const w=await getLevelWorker();
  const votes=new Map();
  // Whole-number OCR is inexpensive, and often reads a new level even when
  // the per-digit template set is incomplete. Multiple preprocessing passes
  // must agree rather than trusting the first recognizable number.
  await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_WORD});
  for(const [label,cutoff] of [['White',170],['Bright',200],['Very bright',220]]){
    const crop=levelInk(base,cutoff);
    if(!crop){details.push(`${label}: orange badge not found`);continue;}
    const result=await w.recognize(crop);
    const raw=String(result.data.text||'').trim(),digits=raw.replace(/\D/g,'');
    const candidate=/^\d{1,3}$/.test(digits)?Number(digits):null;
    const conf=Math.round(Number(result.data.confidence)||0);
    details.push(`${label}: ${JSON.stringify(raw)} => ${candidate===null?'?':candidate} (${conf}%)`);
    if(candidate!==null&&String(candidate).length===segmented.glyphs.length&&plausibleLevel(candidate)){
      const v=votes.get(candidate)||{n:0,confidence:0};v.n++;v.confidence+=conf;votes.set(candidate,v);
    }
  }
  const whole=[...votes.entries()].sort((a,b)=>b[1].n-a[1].n);
  const full=whole[0]&&whole[0][1].n>=2&&(!whole[1]||whole[0][1].n>whole[1][1].n)?whole[0][0]:null;
  // A successful whole-number consensus can initialize any level (1..100).
  // OCR text is NOT written directly into the digit-template library.
  if(full!==null){
    return {value:full,method:'ocr-consensus',status:`Level ${full}: OCR agreement (${whole[0][1].n}/3)`,details};
  }
  // If text OCR struggled, isolate each glyph and recognize one digit at a
  // time. This is also important for narrow '1' glyphs and three-digit 100.
  const chars=[];
  await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_CHAR});
  try{
    for(let i=0;i<segmented.glyphs.length;i++){
      const known=mapleLevelMatchSingle(segmented.glyphs[i]);
      if(known.digit!==null){chars.push(known.digit);details.push(`Digit ${i+1}: ${known.digit} (pixel template)`);continue;}
      const seen=[];
      for(const invert of [false,true]){
        const output=await w.recognize(singleLevelGlyphImage(segmented.glyphs[i],invert));
        const raw=String(output.data.text||'').replace(/\D/g,'');
        seen.push(raw.length===1?raw:null);
      }
      details.push(`Digit ${i+1} (isolated): ${seen.map(c=>c??'?').join(' / ')}`);
      if(!seen[0]||seen[0]!==seen[1])return {value:null,status:'Unfamiliar level digit; retrying',details};
      chars.push(seen[0]);
    }
  }finally{
    await w.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_WORD});
  }
  const result=Number(chars.join(''));
  if(!plausibleLevel(result))return {value:null,status:'Unverified level; retrying',details};
  return {value:result,method:'per-digit-consensus',status:'Isolated glyph recognition',details};
}
async function updateLevel(){
  if(state.identityLockLevel){$('levelStatus').textContent='Manual override';return;}
  let result;
  const cycle=state.cycle;
  try{result=await recognizeLevel();}
  catch(err){result={value:null,status:'Level OCR error',details:[String(err.message||err)]};}
  if(!state.running||cycle!==state.cycle)return;
  state.identityChecked=Date.now();state.levelReads++;
  state.lastOCRNote=result.details.join('\n');
  $('levelStatus').textContent=result.status;
  if(result.value===null){state.levelCandidate=null;renderStats();return;}
  const previous=state.levelCandidate;
  const count=previous?.value===result.value?previous.count+1:1;
  state.levelCandidate={value:result.value,count};
  if(count<2){$('levelStatus').textContent=`Rechecking level ${result.value}…`;return;}
  // Never train on one lucky OCR guess. After THREE independent matching
  // screen captures, cache each new level glyph for subsequent visits.
  // A manually entered level is intentionally exempt from automatic training.
  if(count===3 && !state.identityLockLevel && result.method!=='templates' &&
     typeof saveVerifiedLevelTemplate==='function'){
    const learned=saveVerifiedLevelTemplate(prepareIdentitySource('level'),result.value);
    if(learned.ok)state.lastOCRNote+='\n'+learned.reason;
  }
  if(state.currentLevel===null){
    state.currentLevel=result.value;state.accountedLevel=result.value;
    const requirement=expRequirement(state.currentLevel);
    state.currentPct=requirement!==null && state.currentExp!==null && state.currentExp<requirement?100*state.currentExp/requirement:null;
    if(state.levelUps===0 && requirement!==null)state.pctGained=100*state.expGained/requirement;
    $('levelStatus').textContent=`Level ${result.value} confirmed`;
  }else if(result.value===state.currentLevel+1){
    state.pendingLevel=result.value;
    $('levelStatus').textContent=`Level ${result.value} detected; waiting for EXP reset`;
  }else if(result.value!==state.currentLevel){
    $('levelStatus').textContent='Level disagrees with current; use manual override';
  }else{$('levelStatus').textContent=`Level ${result.value} confirmed`;}
  renderStats();
}
function duration(sec){const s=Math.max(0,Math.floor(sec));const h=Math.floor(s/3600);return h?`${h}h ${String(Math.floor(s%3600/60)).padStart(2,'0')}m`:`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function renderStats(){
  $('currentExp').textContent=state.currentExp===null?'—':fmt(state.currentExp);
  $('currentPct').textContent=fmtPct(state.currentPct);
  $('gained').textContent=fmt(state.expGained);
  $('pctGained').textContent=fmtPct(state.pctGained);
  $('levelUps').textContent=String(state.levelUps);
  $('levelSource').textContent=state.currentLevel===null?'Select your level if auto-detection fails':state.identityLockLevel?'Manual level · saved':'Level detected from game HUD';
  $('characterLevel').textContent=state.currentLevel===null?'—':String(state.currentLevel);
  const needed=expRequirement(state.currentLevel);
  $('requiredExp').textContent=needed===null?'—':fmt(needed);
  $('expFraction').textContent=state.currentExp===null||needed===null?'— / — EXP':`${fmt(state.currentExp)} / ${fmt(needed)} EXP`;
  $('expRemaining').textContent=state.currentExp===null||needed===null?'— remaining':`${fmt(Math.max(0,needed-state.currentExp))} remaining`;

  const inferredPct=needed!==null&&state.currentExp!==null?100*state.currentExp/needed:null;
  if(inferredPct!==null){$('progressBar').style.width=clamp(inferredPct,0,100)+'%';$('progressLabel').textContent=fmtPct(inferredPct);$('progressBar').parentElement.setAttribute('aria-valuenow',String(clamp(inferredPct,0,100)));}else{$('progressBar').style.width='0%';$('progressLabel').textContent='Unverified';$('progressBar').parentElement.setAttribute('aria-valuenow','0');}
  if(state.sessionStart!==null){
    const seconds=Math.max(1,(Date.now()-state.sessionStart)/1000);
    const hours=seconds/3600;
    $('perHour').textContent=fmt(Math.round(state.expGained/hours));
    $('pctHour').textContent=fmtPct(state.pctGained/hours);
    const percentRate=state.pctGained/hours;
    $('eta').textContent=state.currentPct!==null&&percentRate>0.0001?duration((100-state.currentPct)/percentRate*3600):'—';
    $('elapsed').textContent=duration(seconds);
    const cut=Date.now()-300000;
    state.gains=state.gains.filter(x=>x.ts>=cut);
    $('rolling').textContent=fmt(state.gains.reduce((a,g)=>a+g.amount,0));
  }
}
function record(expReading){
  const exp=expReading.value;
  // Confirm an OCR-detected new level only after the EXP counter resets.
  // Prevents a misread level from changing the EXP requirement prematurely.
  const proposedLevel=(Number.isSafeInteger(exp)&&state.pendingLevel===state.currentLevel+1&&
     state.lastExp!==null&&exp<state.lastExp)?state.pendingLevel:state.currentLevel;
  const needed=expRequirement(proposedLevel);
  const prevExp=state.lastExp,now=Date.now();
  const oldLevel=state.accountedLevel;
  const levelChanged=oldLevel!==null&&proposedLevel!==null&&proposedLevel===oldLevel+1;
  const levelCap=needed===null||state.currentLevel===100;
  const note=[];
  // Never display the OCR percent as the progress bar's source of truth.
  // No confirmed level or no confirmed EXP => don't invent percentages.
  if(exp===null){badge('Unverified');setStatus('EXP OCR could not be verified; last confirmed value kept.','warn');return;}
  if(needed!==null && (exp<0 || exp>=needed)){
    badge('Read rejected');setStatus('EXP exceeds the requirement for confirmed level '+state.currentLevel+'; reading rejected.','warn');return;
  }
  if(exp<0||!Number.isSafeInteger(exp)){
    badge('Read rejected');setStatus('EXP OCR produced an invalid number; reading rejected.','warn');return;
  }
  let gain=0,levelUp=false;
  if(prevExp!==null){
    if(exp<prevExp){
      if(levelChanged){
        const oldRequired=expRequirement(oldLevel);
        if(oldRequired===null||prevExp>=oldRequired){badge('Unverified');setStatus('Level-up EXP not verifiable. Paused counting; correct values if needed.','warn');return;}
        gain=(oldRequired-prevExp)+exp;
        levelUp=true;
      }else{
        badge('Read rejected');setStatus('EXP decreased without a confirmed level-up. Keeping last confirmed EXP.','warn');return;
      }
    }else if(levelChanged){
      badge('Unverified');setStatus('Level changed but EXP did not reset. Waiting for a consistent scan.','warn');return;
    }else gain=exp-prevExp;
    // Extremely large instant jumps may be a misrecognized digit, not an EXP gain.
    if(gain>Math.max(50000,Math.round((expRequirement(oldLevel??state.currentLevel)||0)*0.35))){
      badge('Unverified');setStatus('Unusually large EXP jump; ignored until corrected.','warn');return;
    }
  }
  const computed=needed===null?null:100*exp/needed;

  if(needed===null)note.push(levelCap?'Level requirement unavailable; % not calculated.':'Waiting for confirmed level; % not calculated.');
  if(levelUp){state.levelUps++;state.identityChecked=0;}
  if(proposedLevel!==state.currentLevel){state.currentLevel=proposedLevel;state.pendingLevel=null;}
  if(prevExp!==null){
    state.expGained+=gain;
    if(gain)state.gains.push({ts:now,amount:gain});
    const requiredOld=expRequirement(oldLevel??state.currentLevel);
    const gainPercent=levelUp
      ?((requiredOld-prevExp)/requiredOld)*100+(needed!==null?100*exp/needed:0)
      :(needed!==null?100*gain/needed:0);
    if(Number.isFinite(gainPercent))state.pctGained+=gainPercent;
  }
  state.lastExp=exp;state.currentExp=exp;
  state.currentPct=computed;
  if(state.currentLevel!==null)state.accountedLevel=state.currentLevel;
  if(state.sessionStart===null)state.sessionStart=now;

  badge(needed===null?'EXP read · set level':'EXP accepted');
  setStatus(needed===null?'EXP read. Set or confirm level to calculate percentage.':'EXP updated. Progress is calculated from the level EXP requirement.','good');
  renderStats();
}
async function scan(){
  if(!state.running||state.busy||!state.stream||!state.regions.exp)return;
  const myCycle=state.cycle;
  state.busy=true;const began=performance.now();badge('Reading EXP…');
  try{
    if(state.autoAnchor&&state.frameDims&&
       (state.frameDims.w!==video.videoWidth||state.frameDims.h!==video.videoHeight)){
      await detectHUD();setStatus('Window size changed; EXP HUD located again.');
    }
    const worker=await getWorker();
    if(!state.running||myCycle!==state.cycle)return;
    // EXP is the priority. Do not wait for level OCR before updating session gains.
    const exp=await recognizeArea('exp',worker);
    if(!state.running||myCycle!==state.cycle)return;
    $('expStatus').textContent=exp.status;
    $('lastScan').textContent=new Date().toLocaleTimeString();
    $('scanDuration').textContent=((performance.now()-began)/1000).toFixed(1)+'s';
    record(exp);
    $('ocrDetails').textContent=[
      'EXP:',...exp.details.map(t=>`${t.name}: ${JSON.stringify(t.raw)} => ${t.candidate===null?'?':fmt(t.candidate)} (${t.confidence}% confidence)`),
      '', 'LEVEL:',state.lastOCRNote||'Level OCR has not run yet.'];
    if(typeof scanExtras==='function') {
      try{await scanExtras(worker);}catch(error){$('mesoDebug').textContent='Additional tracking error: '+(error.message||error);}
    }
    $('scanDuration').textContent=((performance.now()-began)/1000).toFixed(1)+'s';
  }catch(e){
    $('expStatus').textContent='OCR error';$('ocrDetails').textContent=String(e?.stack||e);
    badge('OCR error');setStatus('Could not read EXP: '+(e.message||String(e)),'warn');
  }finally{state.busy=false;}
}
async function scanLevelIndependently(){
  if(!state.running||state.identityLockLevel||state.levelBusy||!state.regions.level)return;
  if(state.identityChecked&&Date.now()-state.identityChecked<
     (state.levelCandidate?.count===1?2000:state.currentLevel===null?8000:15000))return;
  state.levelBusy=true;
  try{await updateLevel();}catch(e){$('levelStatus').textContent='Level scan error';state.lastOCRNote=String(e.message||e);}
  finally{state.levelBusy=false;}
}
function startTracking(){
  if(!state.stream||!state.regions.exp)return;
  state.running=true;state.cycle++;refreshButtons();badge('Starting…');
  setStatus((state.detectorNote?state.detectorNote+' ':'')+'Reading EXP. The level uses separate pixel matching and OCR; % is calculated from EXP.');
  void scan();state.interval=setInterval(()=>{void scan();},5000);
  void scanLevelIndependently();state.levelTimer=setInterval(()=>{void scanLevelIndependently();},4000);
  if(typeof beginMesosWatch==='function')beginMesosWatch();
}
$('startBtn').addEventListener('click',startTracking);
$('zoom').addEventListener('input',()=>{$('zoomOutput').textContent=$('zoom').value+'×';});
$('threshold').addEventListener('input',()=>{$('thresholdOutput').textContent=$('threshold').value;});
function setManualLevel(raw){
  const value=String(raw||'').trim();
  if(!/^\d{1,3}$/.test(value)||Number(value)<1||Number(value)>99){
    setStatus('Enter a level from 1 to 99 to calculate EXP %.','warn');return false;
  }
  const next=Number(value),old=state.currentLevel;
  // Correcting the level establishes a new safe EXP baseline; it never fakes gains.
  state.currentLevel=next;state.accountedLevel=next;state.pendingLevel=null;
  state.identityLockLevel=true;state.levelCandidate=null;
  // The EXP baseline is still valid when adding the first known level.
  // Only changing an already-known level requires discarding the old delta baseline.
  if(old!==null&&old!==next){state.lastExp=null;state.currentPct=null;}
  const needed=expRequirement(next);
  if(state.currentExp!==null&&state.currentExp>=needed){
    // A larger EXP reading for the previous level is not valid at this level.
    state.currentExp=null;state.lastExp=null;
  }
  state.currentPct=state.currentExp===null?null:state.currentExp/needed*100;
  if(old===null && state.levelUps===0)state.pctGained=100*state.expGained/needed;
  $('quickLevel').value=String(next);
  renderStats();badge('Level set');
  setStatus(`Level ${next} selected. ${old!==null&&old!==next?'EXP gain baseline reset safely; ':''}Progress uses ${fmt(needed)} EXP to next level.`,'good');
  return true;
}
$('setLevelBtn').addEventListener('click',()=>{setManualLevel($('quickLevel').value);});
$('quickLevel').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();setManualLevel($('quickLevel').value);}
});
$('autoLevelBtn').addEventListener('click',()=>{
  state.identityLockLevel=false;state.identityChecked=0;state.levelCandidate=null;
  $('levelStatus').textContent='Auto-detection enabled';
  setStatus('Automatic level detection enabled. Pixel matching runs first, with separate OCR as fallback.','good');
  void scanLevelIndependently();
});
$('teachLevelBtn').addEventListener('click',()=>{
  if(!state.regions.level||video.readyState<2){setStatus('Share MapleStory first and allow automatic HUD detection.','warn');return;}
  const entered=$('quickLevel').value.trim();
  if(!/^\d{1,3}$/.test(entered)||Number(entered)<1||Number(entered)>100){
    setStatus('Enter your exact visible level in the Set level field first.','warn');return;
  }
  const result=saveVerifiedLevelTemplate(prepareIdentitySource('level'),entered);
  setStatus(result.reason,result.ok?'good':'warn');
});
$('applyManual').addEventListener('click',()=>{
  const expRaw=$('manualExp').value.replace(/[\s,]/g,'').trim();
  if(!/^\d+$/.test(expRaw)||!Number.isSafeInteger(Number(expRaw))){
    setStatus('Enter the full current EXP as digits.','warn');return;
  }
  const exp=Number(expRaw),needed=expRequirement(state.currentLevel);
  if(needed!==null&&exp>=needed){
    setStatus(`EXP must be below the level ${state.currentLevel} requirement of ${fmt(needed)}. Check your level.`, 'warn');return;
  }
  // Discard a pending level-up and reset the raw-EXP baseline, avoiding artificial gains.
  state.lastExp=exp;state.currentExp=exp;state.pendingLevel=null;
  state.currentPct=needed===null?null:100*exp/needed;
  if(state.sessionStart===null)state.sessionStart=Date.now();
  $('manualExp').value='';renderStats();badge('EXP corrected');
  setStatus('Current EXP corrected; no artificial gain added.','good');
});
setInterval(()=>{
  if(state.sessionStart!==null)$('elapsed').textContent=duration((Date.now()-state.sessionStart)/1000);
},1000);
window.addEventListener('beforeunload',()=>{
  if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  if(state.worker)void state.worker.terminate();
  if(state.levelWorker)void state.levelWorker.terminate();
  if(typeof disposeMesosWorker==='function')void disposeMesosWorker();
});
refreshButtons();