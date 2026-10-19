'use strict';
// Item-independent hotbar font matching. Every known MapleStory glyph can be
// reused regardless of which consumable occupies a slot. This detector is
// deliberately conservative: unfamiliar backgrounds may still be unreadable.
const POTION_FONT_TEMPLATES = (() => {
  const all = [];
  for (const atlas of Object.values(POTION_DIGITS)) {
    for (const spec of Object.values(atlas.places)) {
      for (const [digit, samples] of Object.entries(spec.labels)) {
        for (const sample of samples) {
          const w=spec.w,h=spec.h;
          if(sample.length!==w*h)continue;
          all.push({digit:Number(digit),w,h,signal:potionFontHighPass(sample,w,h)});
        }
      }
    }
  }
  return all;
})();
function potionFontHighPass(values,w,h) {
  const out=new Float32Array(w*h);
  // Subtract the surrounding pixels rather than the absolute brightness. This
  // discounts much of the item's color/brightness underneath the outlined text.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let sum=0,n=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const xx=Math.max(0,Math.min(w-1,x+dx));
      const yy=Math.max(0,Math.min(h-1,y+dy));
      sum+=values[yy*w+xx];n++;
    }
    out[y*w+x]=values[y*w+x]-sum/n;
  }
  return out;
}
function potionFontGlyphCandidates(values,w,h,targetX,targetY) {
  const scores=new Array(10).fill(Infinity);
  const goodPositions=new Array(10).fill(null);
  for(const glyph of POTION_FONT_TEMPLATES){
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=targetX+dx,y=targetY+dy;
      if(x<0||y<0||x+glyph.w>w||y+glyph.h>h)continue;
      const pixels=new Float32Array(glyph.w*glyph.h);
      for(let cy=0;cy<glyph.h;cy++)for(let cx=0;cx<glyph.w;cx++){
        pixels[cy*glyph.w+cx]=values[(y+cy)*w+x+cx];
      }
      const current=potionFontHighPass(pixels,glyph.w,glyph.h);
      let diff=0;
      for(let i=0;i<current.length;i++)diff+=Math.abs(current[i]-glyph.signal[i]);
      const score=diff/current.length;
      if(score<scores[glyph.digit]){scores[glyph.digit]=score;goodPositions[glyph.digit]={x,y};}
    }
  }
  return scores.map((error,digit)=>({digit,error,position:goodPositions[digit]})).sort((a,b)=>a.error-b.error);
}
function potionUniversalFontMatch(kind,raw){
  if(!raw||!POTION_FONT_TEMPLATES.length)return null;
  const w=raw.width,h=raw.height;
  const pixels=raw.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const values=new Float32Array(w*h);
  for(let i=0;i<values.length;i++)values[i]=(pixels[i*4]*77+pixels[i*4+1]*150+pixels[i*4+2]*29)/512;
  // Counts are left-aligned in the bottom-left of the slot. The expected
  // positions do not depend on the color or name of the assigned consumable.
  const slotX = kind==='mp' ? [4,16,27] : [4,14,25];
  const readings=[];
  for(const length of [3,2]){
    // A lone glyph is easy to hallucinate inside the item artwork; use OCR
    // rather than accept one digit without evidence that the count ends there.
    const xs=length===3?slotX:length===2?[4,kind==='mp'?16:14]:[4];
    if(xs[xs.length-1]+9>w)continue;
    const candidates=xs.map(x=>potionFontGlyphCandidates(values,w,h,x,4));
    const best=candidates.map(x=>x[0]);
    if(best.some(x=>!x||x.error>17.5))continue;
    // For three-digit stacks, require a strong prefix to distinguish a true
    // third glyph from artwork accidentally resembling a digit.
    if(length===3&&(best[0].error>13.5||best[1].error>16))continue;
    // Reject ambiguous digits: we prefer no reading to fabricated expenses.
    if(candidates.some(c=>c.length>1&&c[1].error-c[0].error<3.0))continue;
    const value=Number(best.map(x=>x.digit).join(''));
    if(!Number.isSafeInteger(value)||value<0||value>9999)continue;
    const avg=best.reduce((a,b)=>a+b.error,0)/length;
    readings.push({value,error:avg,length});
  }
  if(!readings.length)return null;
  readings.sort((a,b)=>b.length-a.length||a.error-b.error);
  const best=readings[0];
  return {value:best.value,confidence:Math.max(0,Math.min(94,Math.round(100-best.error*3))),source:'font-universal',
    note:`shared hotbar font ${best.value} (shape error ${best.error.toFixed(1)})`};
}