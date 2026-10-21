'use strict';
// Conservative per-glyph pixel-template matcher. Templates were hand-labeled
// from the user's screenshots, not from client files or game memory.
// Returns null when an unfamiliar digit/font/resolution makes the result unsafe.
function extractEXPTemplates(canvas){
  const {width:w,height:h}=canvas;
  if(w<8||h<8)return {value:null,reason:'crop too small'};
  const p=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const cols=new Uint16Array(w), rows=[];
  const light=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,r=p[i],g=p[i+1],b=p[i+2];
    const on=Math.min(r,g,b)>170&&Math.max(r,g,b)-Math.min(r,g,b)<64;
    if(on){light[y*w+x]=1;cols[x]++;}
  }
  const runs=[];let start=-1;
  for(let x=0;x<=w;x++){
    const active=x<w&&cols[x]>=2;
    if(active&&start<0)start=x;
    if(!active&&start>=0){runs.push([start,x]);start=-1;}
  }
  const glyphs=[];
  for(const [x0,x1] of runs){
    let y0=h,y1=0,paint=0;
    for(let x=x0;x<x1;x++)for(let y=0;y<h;y++)if(light[y*w+x]){y0=Math.min(y0,y);y1=Math.max(y1,y+1);paint++;}
    const rw=x1-x0,rh=y1-y0;
    if(rh<Math.max(5,Math.round(h*.27))||paint<5)continue; // commas and dots
    // This covers digits; do not silently parse EXP labels or other sprites.
    if(rw>h*1.15)return {value:null,reason:'Unexpected wide glyph'};
    let bits='';
    for(let yy=0;yy<16;yy++)for(let xx=0;xx<10;xx++){
      const sx=x0+Math.min(rw-1,Math.floor((xx+.5)*rw/10));
      const sy=y0+Math.min(rh-1,Math.floor((yy+.5)*rh/16));
      bits+=String(light[sy*w+sx]);
    }
    glyphs.push({bits,w:rw,h:rh});
  }
  return {glyphs};
}
function templateDigitsFromCanvas(canvas,atlas=MAPLE_EXP_DIGIT_ATLAS){
  const result=extractEXPTemplates(canvas);
  if(!result.glyphs)return result;
  const nums=[],scores=[];
  for(const {bits,w:rw,h:rh} of result.glyphs){
    let choices=[];
    for(const [digit,variants] of Object.entries(atlas))for(const t of variants){
      let overlap=0,union=0,agree=0;
      for(let k=0;k<bits.length;k++){
        const a=bits[k]==='1',b=t.bits[k]==='1';
        if(a&&b)overlap++;if(a||b)union++;if(a===b)agree++;
      }
      const shape=union?overlap/union:0;
      const aspect=Math.abs(rw/rh-t.w/t.h);
      choices.push({digit,score:(shape*.72+agree/160*.28)-Math.min(.20,aspect*.20)});
    }
    choices.sort((a,b)=>b.score-a.score);
    const best=choices[0],runner=choices.find(q=>q.digit!==best.digit);
    // Templates do not contain every glyph yet (e.g. '4'). Refuse low-margin guesses.
    if(!best||best.score<.76||(runner&&best.score-runner.score<.055))
      return {value:null,reason:`Uncertain glyph (${best?.digit||'?'} ${Math.round((best?.score||0)*100)}%); OCR fallback`,seen:nums.join('')};
    nums.push(best.digit);scores.push(best.score);
  }
  const value=nums.join('');
  if(!/^\d{1,12}$/.test(value))return {value:null,reason:'No complete EXP digits'};
  const numeric=Number(value);
  if(!Number.isSafeInteger(numeric))return {value:null,reason:'Out of range'};
  return {value:numeric,confidence:Math.round(Math.min(...scores)*100),reason:'Screenshot pixel glyph match',text:value};
}
function expTemplateRead(region=null){
  const r=region||state.regions.exp;
  if(!r||video.readyState<2)return {value:null,reason:'EXP unavailable'};
  const c=document.createElement('canvas');c.width=r.w;c.height=r.h;
  c.getContext('2d',{willReadFrequently:true}).drawImage(video,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  return templateDigitsFromCanvas(c);
}

// Optional user-confirmed one-time calibration. Never train from unverified OCR:
// the user must type the exact number visible in the EXP display.
function teachEXPFromVisible(raw){
  const text=String(raw||'').trim().replace(/[,. ]/g,'');
  if(!/^\d{1,12}$/.test(text))return {ok:false,reason:'Enter the exact EXP digits shown in-game.'};
  const safe=typeof liveEXPRegion==='function'?liveEXPRegion():{region:state.regions.exp};
  const r=safe.region;
  if(!r||video.readyState<2)return {ok:false,reason:safe.reason||'Share your game and wait for EXP detection first.'};
  const crop=document.createElement('canvas');crop.width=r.w;crop.height=r.h;
  crop.getContext('2d',{willReadFrequently:true}).drawImage(video,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  const found=extractEXPTemplates(crop);
  if(!found.glyphs||found.glyphs.length!==text.length)
    return {ok:false,reason:`Found ${found.glyphs?.length??0} glyphs; you entered ${text.length} digits. Calibration not saved. Check the EXP readout is visible.`};
  for(let i=0;i<text.length;i++){
    const list=MAPLE_EXP_DIGIT_ATLAS[text[i]]??(MAPLE_EXP_DIGIT_ATLAS[text[i]]=[]);
    const t=found.glyphs[i];
    if(!list.some(a=>a.bits===t.bits&&a.w===t.w&&a.h===t.h))list.push(t);
    if(list.length>12)list.splice(0,list.length-12);
  }
  try{localStorage.setItem('mapleEXPUserTemplatesV1',JSON.stringify(MAPLE_EXP_DIGIT_ATLAS));}catch{}
  return {ok:true,reason:`Saved templates from ${text.length} verified digits. ${Object.keys(MAPLE_EXP_DIGIT_ATLAS).length}/10 digits have a sample.`};
}
try{
  const saved=JSON.parse(localStorage.getItem('mapleEXPUserTemplatesV1')||'null');
  if(saved&&typeof saved==='object')for(const [key,list] of Object.entries(saved)){
    if(!/^\d$/.test(key)||!Array.isArray(list))continue;
    const safe=list.filter(t=>typeof t.bits==='string'&&/^[01]{160}$/.test(t.bits)&&Number.isInteger(t.w)&&Number.isInteger(t.h)&&t.w>0&&t.h>0).slice(-12);
    if(safe.length)MAPLE_EXP_DIGIT_ATLAS[key]=safe;
  }
}catch{}