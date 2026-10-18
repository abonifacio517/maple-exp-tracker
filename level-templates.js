'use strict';
// Dedicated pixel-glyph reader for the white numbers inside MapleStory's
// orange LV. badge. Only samples of digits 3 and 4 are preloaded.
// It never guesses unseen digits. A separate OCR worker handles unknown glyphs.
function mapleLevelGlyphs(canvas) {
  if(!canvas || canvas.width<12 || canvas.height<12) return {glyphs:null,reason:'Level crop is too small'};
  const w=canvas.width,h=canvas.height;
  const raw=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  let xMin=w,yMin=h,xMax=-1,yMax=-1,orangeCount=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=(y*w+x)*4,r=raw[k],g=raw[k+1],b=raw[k+2];
    if(r>145 && r>g*1.3 && g>55 && g<195 && b<125 && g>b*1.28){
      orangeCount++;xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);
      yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);
    }
  }
  if(orangeCount<45 || xMax-xMin<12 || yMax-yMin<9) return {glyphs:null,reason:'Orange level badge not found'};
  if(xMax-xMin>Math.round(w*.83) || yMax-yMin>Math.round(h*.88))
    return {glyphs:null,reason:'Orange level badge bounds uncertain'};
  const aW=xMax-xMin+1,aH=yMax-yMin+1;
  const ink=new Uint8Array(aW*aH),cols=new Uint16Array(aW);
  for(let y=0;y<aH;y++)for(let x=0;x<aW;x++){
    const k=((y+yMin)*w+x+xMin)*4,r=raw[k],g=raw[k+1],b=raw[k+2];
    const white=r>=200&&g>=188&&b>=182&&(Math.max(r,g,b)-Math.min(r,g,b))<67;
    if(white){ink[y*aW+x]=1;cols[x]++;}
  }
  const runs=[];let begin=-1;
  for(let x=0;x<=aW;x++){
    const active=x<aW&&cols[x]>0;
    if(active && begin<0) begin=x;
    if(!active && begin>=0){if(x-begin>=2)runs.push([begin,x]);begin=-1;}
  }
  if(runs.length<1||runs.length>3) return {glyphs:null,reason:`Unexpected level digit segments (${runs.length})`};
  const glyphs=[];
  for(const [x0,x1] of runs){
    let top=aH,bottom=-1,pixels=0;
    for(let y=0;y<aH;y++)for(let x=x0;x<x1;x++)if(ink[y*aW+x]){
      top=Math.min(top,y);bottom=Math.max(bottom,y);pixels++;
    }
    if(pixels<8||bottom-top<4) return {glyphs:null,reason:'Level digit shape incomplete'};
    const rw=x1-x0,rh=bottom-top+1;
    let bits='';
    for(let yy=0;yy<16;yy++)for(let xx=0;xx<10;xx++){
      const sx=x0+Math.min(rw-1,Math.floor((xx+.5)*rw/10));
      const sy=top+Math.min(rh-1,Math.floor((yy+.5)*rh/16));
      bits+=ink[sy*aW+sx]?'1':'0';
    }
    glyphs.push({bits,w:rw,h:rh});
  }
  return {glyphs,reason:'Badge digits segmented'};
}
function mapleLevelMatchSingle(sample){
  const scores=[];
  for(const [digit,variants] of Object.entries(MAPLE_LEVEL_DIGIT_ATLAS)){
    for(const template of variants){
      let overlap=0,union=0,agree=0;
      for(let k=0;k<160;k++){
        const a=sample.bits[k]==='1',b=template.bits[k]==='1';
        if(a&&b)overlap++;if(a||b)union++;if(a===b)agree++;
      }
      const iou=union?overlap/union:0;
      const penalty=Math.min(.24,Math.abs(sample.w/sample.h-template.w/template.h)*.20);
      scores.push({digit,score:iou*.75+agree/160*.25-penalty});
    }
  }
  scores.sort((a,b)=>b.score-a.score);
  const best=scores[0],other=scores.find(s=>s.digit!==best?.digit);
  if(best && best.score>=.87 && (!other||best.score-other.score>=.11))
    return {digit:best.digit,confidence:Math.round(best.score*100)};
  return {digit:null,confidence:Math.round((best?.score||0)*100)};
}
function mapleLevelPixelMatch(source){
  const parsed=mapleLevelGlyphs(source);
  if(!parsed.glyphs) return {value:null,confidence:0,reason:parsed.reason};
  const chars=[],scores=[];
  for(const sample of parsed.glyphs){
    const match=mapleLevelMatchSingle(sample);
    if(match.digit===null)return {value:null,confidence:match.confidence,reason:'Unknown or ambiguous level digit; checking with dedicated OCR'};
    chars.push(match.digit);scores.push(match.confidence/100);
  }
  const value=Number(chars.join(''));
  if(!Number.isInteger(value)||value<1||value>100)
    return {value:null,confidence:0,reason:'Level number out of range'};
  return {value,confidence:Math.round(Math.min(...scores)*100),reason:'Orange-badge pixel templates'};
}
function saveVerifiedLevelTemplate(source,level){
  const text=String(level).trim();
  if(!/^\d{1,3}$/.test(text)||Number(text)<1||Number(text)>100)
    return {ok:false,reason:'Enter the correct visible level first.'};
  const parsed=mapleLevelGlyphs(source);
  if(!parsed.glyphs||parsed.glyphs.length!==text.length)
    return {ok:false,reason:`Could not isolate ${text.length} level digits in orange badge. Nothing saved.`};
  for(let i=0;i<text.length;i++){
    const list=MAPLE_LEVEL_DIGIT_ATLAS[text[i]]??(MAPLE_LEVEL_DIGIT_ATLAS[text[i]]=[]);
    const glyph=parsed.glyphs[i];
    if(!list.some(v=>v.bits===glyph.bits))list.push(glyph);
    if(list.length>8)list.splice(0,list.length-8);
  }
  try{localStorage.setItem('mapleLevelTemplatesV1',JSON.stringify(MAPLE_LEVEL_DIGIT_ATLAS));}catch{}
  return {ok:true,reason:`Saved ${text.length} verified level-digit shapes in this browser.`};
}
try{
  const stored=JSON.parse(localStorage.getItem('mapleLevelTemplatesV1')||'null');
  if(stored&&typeof stored==='object')for(const [digit,list] of Object.entries(stored)){
    if(!/^\d$/.test(digit)||!Array.isArray(list))continue;
    const valid=list.filter(t=>/^[01]{160}$/.test(t.bits)&&Number.isFinite(t.w)&&Number.isFinite(t.h)&&t.w>0&&t.h>0).slice(-8);
    if(valid.length)MAPLE_LEVEL_DIGIT_ATLAS[digit]=[...(MAPLE_LEVEL_DIGIT_ATLAS[digit]||[]),...valid];
  }
}catch{}