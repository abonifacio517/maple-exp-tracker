'use strict';
// All capture and OCR happen in the visitor's browser. No upload endpoints are used.
const $ = id => document.getElementById(id);
const video = $('video');
const state = {
  stream: null, regions: {exp:null, pct:null, level:null, name:null},
  autoAnchor:null, autoScore:null, autoBusy:false, detectorNote:'', frameDims:null,
  running: false, busy: false, cycle: 0,
  interval: null, worker: null, workerPromise: null,
  sessionStart:null, lastExp:null, lastPct:null, currentExp:null, currentPct:null,
  expGained:0, pctGained:0, levelUps:0, gains:[], elapsedCache:0,
  scanStarted:0, currentLevel:null, characterName:null, identityChecked:0, identityLockName:false, identityLockLevel:false, accountedLevel:null, pendingLevel:null,
  identityCandidate:{level:null,name:null}, identityReads:0, lastScreenPct:null, pctCheckAt:0, lastOCRNote:''
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
function pause(){state.running=false;state.cycle++;clearInterval(state.interval);state.interval=null;refreshButtons();}
function reset(){
  state.sessionStart=null;state.lastExp=null;state.lastPct=null;state.currentExp=null;state.currentPct=null;
  state.currentLevel=null;state.characterName=null;state.identityChecked=0;state.identityLockName=false;state.identityLockLevel=false;state.accountedLevel=null;state.pendingLevel=null;
  state.identityCandidate={level:null,name:null};state.identityReads=0;state.lastScreenPct=null;state.pctCheckAt=0;state.lastOCRNote='';
  state.expGained=0;state.pctGained=0;state.levelUps=0;state.gains=[];
  $('currentExp').textContent='—';$('currentPct').textContent='—';$('perHour').textContent='0';
  $('gained').textContent='0';$('rolling').textContent='0';$('pctGained').textContent='0.00%';
  $('pctHour').textContent='—';$('eta').textContent='—';$('elapsed').textContent='00:00';
  $('levelUps').textContent='0';$('progressBar').style.width='0%';$('progressLabel').textContent='—';
  $('lastScan').textContent='—';$('expStatus').textContent='Waiting';$('pctStatus').textContent='Waiting';
  $('scanDuration').textContent='—';$('ocrDetails').textContent='OCR has not started.';badge('Idle');
  $('characterName').textContent='Detecting character…';$('characterLevel').textContent='—';
  $('expFraction').textContent='— / — EXP';$('expRemaining').textContent='— remaining';$('requiredExp').textContent='—';$('identityStatus').textContent='Waiting';
}
function stopSharing(){
  pause();if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  state.stream=null;video.srcObject=null;
  state.regions={exp:null,pct:null,level:null,name:null};state.autoAnchor=null;state.frameDims=null;
  refreshButtons();setStatus('Sharing stopped.');
}
$('shareBtn').addEventListener('click',async()=>{
  if(!navigator.mediaDevices?.getDisplayMedia){setStatus('Screen sharing requires HTTPS and Chrome/Edge.','warn');return;}
  let stream=null;
  try{
    stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});
    if(state.stream)stopSharing();
    state.stream=stream;video.srcObject=stream;await video.play();
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(state.stream===stream)stopSharing();},{once:true});
    state.regions={exp:null,pct:null,level:null,name:null};pause();reset();
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
  const level=rect(-494,4,50,30), name=rect(-455,19,152,16);
  state.regions={exp:areas.exp,pct:areas.pct,level:valid(level)?level:null,name:valid(name)?name:null};
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
    setStatus((err.message||String(err))+' The EXP HUD must be visible. You can still enter your level/name manually under Scan details.','warn');
    badge('HUD not found');
  }finally{state.autoBusy=false;refreshButtons();}
}
$('autoDetectBtn').addEventListener('click',async()=>{
  pause();state.regions={exp:null,pct:null,level:null,name:null};refreshButtons();
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
function readCandidates(raw,key){
  const text=String(raw||'').replace(/[OoОо]/g,'0').replace(/[Il|]/g,'1').replace(/\u00a0/g,' ');
  if(key==='exp'){
    // Prefer the longest contiguous digit group, including normal thousands separators.
    const candidates=[...text.matchAll(/\d(?:[\d,\.\s]*\d)?/g)]
      .map(m=>m[0].replace(/\D/g,''))
      .filter(v=>v.length>=1&&v.length<=15).sort((a,b)=>b.length-a.length);
    if(!candidates.length)return null;
    const n=Number(candidates[0]);return Number.isSafeInteger(n)?n:null;
  }
  const matches=[...text.matchAll(/(\d{1,3})(?:[.,](\d{1,4}))?\s*%?/g)];
  // Prefer decimal percentages and then whole number percentages.
  const sorted=matches.sort((a,b)=>Boolean(b[2])-Boolean(a[2]));
  for(const m of sorted){
    const n=Number(m[1]+(m[2]?'.'+m[2]:''));
    if(Number.isFinite(n)&&n>=0&&n<=100)return Math.round(n*10000)/10000;
  }
  return null;
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
      tessedit_char_whitelist:'0123456789.,()% ',
      tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,
      preserve_interword_spaces:'1'
    });
    state.worker=worker;return worker;
  })();
  try{return await state.workerPromise;}finally{state.workerPromise=null;}
}
async function recognizeArea(key,worker){
  if(!state.regions[key])return {value:null,status:'No box selected',details:[]};
  const source=prepareCrop(key,false);
  const variants=[['High contrast',()=>enhance(source,'binary')],['Grayscale',()=>enhance(source,'gray')],['Adjusted threshold',()=>enhance(source,'alternate')],['Pixel-sharp',()=>enhance(prepareCrop(key,true),'gray')]];
  const max=$('ocrMode').value==='accuracy'?4:3;
  const tries=[],votes=new Map();
  for(let i=0;i<max;i++){
    const [name,fn]=variants[i],image=fn();
    if(i===0&&document.querySelector('.settings-panel').open)showSample(key,image);
    const result=await worker.recognize(image);
    const raw=(result.data.text||'').trim();
    const candidate=readCandidates(raw,key);
    const confidence=Math.round(Number(result.data.confidence)||0);
    tries.push({name,raw,candidate,confidence});
    if(candidate!==null){
      const voteKey=key==='exp'?String(candidate):candidate.toFixed(4);
      const item=votes.get(voteKey)||{value:candidate,count:0};item.count++;
      votes.set(voteKey,item);
      if(item.count>=2){
        return {value:item.value,status:`Confirmed (${item.count} matching OCR passes)`,details:tries};
      }
    }
  }
  return {value:null,status:'Uncertain — conflicting or missing OCR reads',details:tries};
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
  if(right-left<w*.35||bottom-top<h*.3)return null;
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
function nameInk(source,cutoff=150){
  // The region is purposefully only the SECOND text row; class appears above.
  const scale=4,pad=18;
  const out=document.createElement('canvas');out.width=source.width*scale+pad*2;out.height=source.height*scale+pad*2;
  const context=source.getContext('2d',{willReadFrequently:true});
  const d=context.getImageData(0,0,source.width,source.height).data;
  const mask=document.createElement('canvas');mask.width=source.width;mask.height=source.height;
  const cx=mask.getContext('2d'),pixels=cx.createImageData(source.width,source.height);
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const almostGray=Math.max(r,g,b)-Math.min(r,g,b)<54;
    const ink=(r+g+b)/3>cutoff && almostGray;
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink?0:255;pixels.data[i+3]=255;
  }
  cx.putImageData(pixels,0,0);
  const dest=out.getContext('2d');dest.fillStyle='#fff';dest.fillRect(0,0,out.width,out.height);
  dest.imageSmoothingEnabled=false;dest.drawImage(mask,pad,pad,source.width*scale,source.height*scale);
  return out;
}
async function recognizeIdentity(key,worker){
  if(!state.regions[key])return {value:null,status:'HUD region not found',details:[]};
  const nameMode=key==='name';
  await worker.setParameters({
    tessedit_char_whitelist:nameMode?'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_':'0123456789',
    tessedit_pageseg_mode:Tesseract.PSM.SINGLE_WORD
  });
  // Grab the original pixels first, then color-segment BEFORE resizing.
  const base=prepareIdentitySource(key),values=new Map(),details=[];
  const variants=nameMode
    ?[['White letters',()=>nameInk(base,142)],['Bright letters',()=>nameInk(base,172)],['Grayscale',()=>enhance(base,'gray')],['Binary',()=>enhance(base,'binary')]]
    :[['White on orange',()=>levelInk(base,160)],['Bright white on orange',()=>levelInk(base,195)],['Pure white on orange',()=>levelInk(base,225)]];
  for(const [label,make] of variants){
    const image=make();
    if(!image){details.push(label+': no orange badge found');continue;}
    const result=await worker.recognize(image);
    const raw=String(result.data.text||'').trim();
    const conf=Number(result.data.confidence||0);
    let value=null;
    if(nameMode){
      // Never accept a class label as a character name.
      const cleaned=raw.replace(/[^A-Za-z0-9_]/g,'');
      if(cleaned.length>=3&&cleaned.length<=24)value=cleaned;
    }else{
      const cleaned=raw.replace(/[^0-9]/g,'');
      const n=Number(cleaned);
      if(/^\d{1,3}$/.test(cleaned)&&n>=1&&n<=100)value=n;
    }
    details.push(label+': '+JSON.stringify(raw)+(value===null?' (unreadable)':' → '+String(value))+' ('+Math.round(conf)+'%)');
    if(value!==null){
      const k=String(value).toLowerCase();const old=values.get(k)||{value,count:0};old.count++;values.set(k,old);
    }
  }
  const sorted=[...values.values()].sort((a,b)=>b.count-a.count);
  if(sorted[0]&&sorted[0].count>=2&&(!sorted[1]||sorted[0].count>sorted[1].count))
    return {value:sorted[0].value,status:'Multi-pass match',details};
  return {value:null,status:'Unverified: passes disagree',details};
}
function confirmIdentity(key,value){
  const past=state.identityCandidate[key];
  const count=past&&String(past.value).toLowerCase()===String(value).toLowerCase()?past.count+1:1;
  state.identityCandidate[key]={value,count};
  // Two independent video-frame scans must agree before showing identity.
  return count>=2;
}
async function updateIdentity(worker){
  const reports=[],details=[];
  try{
    if(!state.identityLockLevel){
      const level=await recognizeIdentity('level',worker);details.push('LEVEL',...(level.details||[]));
      if(level.value!==null){
        const old=state.currentLevel;
        if(old!==null&&level.value!==old&&level.value!==old+1){reports.push('Level changed unexpectedly; unverified');}
        else if(confirmIdentity('level',level.value)){
          if(old!==null&&level.value===old+1){state.pendingLevel=level.value;reports.push('Level '+level.value+' detected; waiting for EXP reset to confirm');}
          else{state.currentLevel=level.value;state.pendingLevel=null;reports.push('Level '+level.value+' verified across scans');}
        }else reports.push('Checking level '+level.value+' again…');
      }else{state.identityCandidate.level=null;reports.push('Level unverified');}
    }
    if(!state.identityLockName){
      const name=await recognizeIdentity('name',worker);details.push('NAME',...(name.details||[]));
      if(name.value!==null){
        const old=state.characterName;
        if(old!==null&&name.value.toLowerCase()!==old.toLowerCase()){reports.push('Name changed unexpectedly; unverified');}
        else if(confirmIdentity('name',name.value)){
          state.characterName=name.value;reports.push('Name '+name.value+' verified across scans');
        }else reports.push('Checking name '+name.value+' again…');
      }else{state.identityCandidate.name=null;reports.push('Name unverified');}
    }
  }finally{
    await worker.setParameters({tessedit_char_whitelist:'0123456789.,()% ',tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE});
    state.identityChecked=Date.now();state.identityReads++;
  }
  $('identityStatus').textContent=reports.join(' · ')||'Manual values locked';
  state.lastOCRNote=details.join('\n');
  renderStats();
}
function duration(sec){const s=Math.max(0,Math.floor(sec));const h=Math.floor(s/3600);return h?`${h}h ${String(Math.floor(s%3600/60)).padStart(2,'0')}m`:`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function renderStats(){
  $('currentExp').textContent=state.currentExp===null?'—':fmt(state.currentExp);
  $('currentPct').textContent=fmtPct(state.currentPct);
  $('gained').textContent=fmt(state.expGained);
  $('pctGained').textContent=fmtPct(state.pctGained);
  $('levelUps').textContent=String(state.levelUps);
  $('characterName').textContent=state.characterName||'Name not detected';
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
function record(expReading,pctReading){
  const exp=expReading.value;
  const screenPct=pctReading.value;
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
  if(computed!==null && screenPct!==null && Math.abs(computed-screenPct)>0.08){
    note.push('On-screen % OCR ('+fmtPct(screenPct)+') disagrees with EXP-derived '+fmtPct(computed)+'; using calculated %.');
  }
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
  state.currentPct=computed;state.lastPct=computed;
  if(state.currentLevel!==null)state.accountedLevel=state.currentLevel;
  if(state.sessionStart===null)state.sessionStart=now;
  state.lastScreenPct=screenPct;
  badge(note.length?'% OCR mismatch':'EXP accepted');
  setStatus(note.join(' ')||'EXP updated. Progress calculated from the level requirement.',note.length?'warn':'good');
  renderStats();
}
async function scan(){
  if(!state.running||state.busy||!state.stream||!state.regions.exp)return;
  const myCycle=state.cycle;
  state.busy=true;const began=performance.now();
  badge('Reading…');
  try{
    if(state.autoAnchor&&state.frameDims&&
      (state.frameDims.w!==video.videoWidth||state.frameDims.h!==video.videoHeight)){
      await detectHUD();
      setStatus('Window capture size changed. EXP HUD located again.','good');
    }
    const worker=await getWorker();
    if(!state.running||myCycle!==state.cycle)return;
    // Read identity on first scan and then every ~30 seconds, to save CPU.
    if(!state.identityChecked||Date.now()-state.identityChecked>((!state.currentLevel||!state.characterName)?12000:30000)){
      await updateIdentity(worker);
    }
    // Each field uses independently chosen OCR processing and validation.
    const exp=await recognizeArea('exp',worker);
    const pct=(state.identityReads%4===0||Date.now()-state.pctCheckAt>20000)
      ?await recognizeArea('pct',worker)
      :{value:null,status:'Calculated from EXP (OCR cross-check skipped)',details:[]};
    if(pct.details.length)state.pctCheckAt=Date.now();
    if(!state.running||myCycle!==state.cycle)return;
    $('expStatus').textContent=exp.status;
    $('pctStatus').textContent=pct.status;
    $('lastScan').textContent=new Date().toLocaleTimeString();
    $('scanDuration').textContent=((performance.now()-began)/1000).toFixed(1)+'s';
    $('ocrDetails').textContent=['CHARACTER:',state.lastOCRNote,'','EXP:',...exp.details.map(t=>`${t.name}: ${JSON.stringify(t.raw)} → ${t.candidate===null?'?':fmt(t.candidate)} (${t.confidence}% OCR confidence)`),'','ON-SCREEN PERCENT (CROSS-CHECK ONLY):',...pct.details.map(t=>`${t.name}: ${JSON.stringify(t.raw)} → ${t.candidate===null?'?':fmtPct(t.candidate)} (${t.confidence}% OCR confidence)`)].join('\n');
    record(exp,pct);
  }catch(e){
    $('expStatus').textContent='Error';$('ocrDetails').textContent=String(e?.stack||e);
    badge('OCR error');setStatus('Screen reading failed: '+(e.message||String(e)),'warn');
  }finally{state.busy=false;}
}
function startTracking(){
  if(!state.stream||!state.regions.exp)return;
  state.running=true;state.cycle++;refreshButtons();badge('Starting…');
  setStatus((state.detectorNote?state.detectorNote+' ':'')+'Reading EXP and %. First OCR scan may take longer while the OCR engine loads.');
  void scan();state.interval=setInterval(()=>{void scan();},5000);
}
$('startBtn').addEventListener('click',startTracking);
$('zoom').addEventListener('input',()=>{$('zoomOutput').textContent=$('zoom').value+'×';});
$('threshold').addEventListener('input',()=>{$('thresholdOutput').textContent=$('threshold').value;});
$('applyManual').addEventListener('click',()=>{
  const requestedName=$('manualName').value.trim();
  const requestedLevel=$('manualLevel').value.trim();
  if(requestedName&& !/^[A-Za-z0-9_]{3,24}$/.test(requestedName)){setStatus('Enter a 3–24 character name using letters, digits, or underscore.','warn');return;}
  if(requestedLevel && (!/^\d{1,3}$/.test(requestedLevel)||Number(requestedLevel)<1||Number(requestedLevel)>100)){setStatus('Enter a level between 1 and 100.','warn');return;}

  // Stop scans before applying a correction so an in-flight read cannot overwrite it.
  pause();
  const expRaw=$('manualExp').value.replace(/[\s,]/g,'').trim();
  const pctRaw=$('manualPct').value.replace('%','').trim();
  if(!expRaw&&!pctRaw&&!requestedName&&!requestedLevel){setStatus('Enter something to correct.','warn');return;}
  const n=expRaw?Number(expRaw):null,p=pctRaw?Number(pctRaw):null;
  if(expRaw&&(!/^\d+$/.test(expRaw)||!Number.isSafeInteger(n))){setStatus('Enter EXP as whole digits only.','warn');return;}
  if(pctRaw&&(!Number.isFinite(p)||p<0||p>100)){setStatus('Percentage must be between 0 and 100.','warn');return;}
  if(requestedName){state.characterName=requestedName;state.identityLockName=true;state.identityCandidate.name=null;}
  if(requestedLevel){state.currentLevel=Number(requestedLevel);state.accountedLevel=state.currentLevel;state.identityLockLevel=true;state.identityCandidate.level=null;state.pendingLevel=null;}
  if(n!==null){state.lastExp=n;state.currentExp=n;}
  if(p!==null)state.lastScreenPct=p;
  const required=expRequirement(state.currentLevel);
  state.currentPct=required!==null&&state.currentExp!==null?100*state.currentExp/required:null;
  state.lastPct=state.currentPct;
  if(n!==null&&state.currentLevel!==null)state.accountedLevel=state.currentLevel;
  if(state.sessionStart===null)state.sessionStart=Date.now();
  renderStats();setStatus('Manual values saved as the new baseline; no artificial gain added.','good');badge('Manual correction');
  $('manualExp').value='';$('manualPct').value='';$('manualName').value='';$('manualLevel').value='';
});
setInterval(()=>{
  if(state.sessionStart!==null)$('elapsed').textContent=duration((Date.now()-state.sessionStart)/1000);
},1000);
window.addEventListener('beforeunload',()=>{
  if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  if(state.worker)void state.worker.terminate();
});
refreshButtons();