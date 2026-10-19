'use strict';
// Item-independent hotbar font matching. Every known MapleStory glyph can be
// reused regardless of which consumable occupies a slot. This detector is
// deliberately conservative: unfamiliar backgrounds may still be unreadable.
const POTION_73_88_GLYPHS = [{"digit":8,"w":10,"h":18,"values":[2,41,73,59,91,127,127,127,127,127,2,41,73,63,82,106,112,114,113,108,2,42,76,71,29,0,0,0,0,0,2,45,71,25,40,68,64,64,64,63,5,41,56,0,61,127,127,127,127,127,9,3,17,111,72,0,0,0,0,0,12,0,2,127,77,0,32,49,49,0,13,0,1,127,77,0,127,127,127,34,12,0,2,127,77,0,9,19,20,0,9,11,25,90,69,27,27,24,25,27,6,52,67,0,55,127,127,127,127,127,9,14,28,75,65,39,40,39,39,40,11,0,2,126,70,0,0,0,0,0,13,0,0,120,67,0,63,86,86,11,13,0,2,116,63,0,18,28,29,0,12,0,8,93,57,0,0,0,0,0,10,17,18,5,51,109,108,108,108,108,10,16,18,3,30,65,61,61,61,63]},{"digit":8,"w":10,"h":18,"values":[127,127,127,127,121,76,52,39,75,53,108,112,127,127,127,127,58,0,89,70,0,22,127,127,127,127,56,0,0,0,63,58,46,102,127,127,56,0,58,73,127,98,0,65,127,127,58,8,123,127,0,38,125,55,4,3,68,113,25,0,0,20,127,52,0,0,73,127,0,2,34,21,127,54,0,0,75,127,0,60,0,20,127,51,0,0,73,127,0,0,27,48,99,59,32,31,66,92,42,28,127,107,0,80,127,127,59,0,125,127,40,51,81,58,42,41,62,77,48,40,0,19,127,45,0,0,65,127,0,0,11,20,126,45,0,0,63,122,2,19,0,18,124,44,0,0,61,119,1,0,0,27,106,40,0,0,52,97,15,0,108,76,1,22,39,31,13,13,87,108,63,48,13,35,49,42,24,13,53,63]},{"digit":7,"w":10,"h":18,"values":[3,44,78,64,94,127,127,127,127,127,6,38,64,54,79,110,112,114,113,113,10,2,0,0,0,0,0,0,0,0,12,0,0,63,71,65,64,64,64,63,13,0,15,127,127,127,127,127,127,127,11,0,0,5,1,0,0,0,3,0,8,17,23,12,22,36,43,18,0,23,4,47,83,70,105,127,127,93,0,114,2,42,74,60,85,119,127,83,0,107,2,41,73,60,79,102,92,66,26,76,2,41,73,62,74,82,0,36,127,22,2,41,73,64,73,75,0,36,127,21,2,41,73,68,60,46,20,47,114,27,2,43,75,73,30,0,97,76,0,40,4,34,62,76,28,0,103,78,0,40,6,27,48,61,33,3,82,65,0,42,8,21,26,0,51,105,27,20,57,60,9,16,16,0,25,66,0,14,77,63]},{"digit":3,"w":10,"h":18,"values":[127,127,127,127,127,80,53,39,75,53,113,113,114,111,118,127,61,0,89,70,0,0,0,0,12,127,63,0,0,0,63,62,68,4,0,127,64,0,58,73,127,127,127,50,2,127,64,8,123,127,0,39,127,46,0,7,78,122,31,1,23,56,79,64,35,0,35,86,0,7,114,116,0,82,127,0,0,0,0,67,107,113,0,71,127,94,100,94,0,0,76,79,17,89,127,127,127,127,4,0,22,11,127,127,127,124,127,126,0,59,21,11,127,127,127,127,127,127,1,2,27,28,125,121,116,103,108,100,18,0,40,66,70,65,47,0,0,0,46,68,40,69,59,59,43,0,21,61,25,18,42,64,55,55,43,0,56,102,16,0,60,57,48,46,43,28,12,13,87,108,63,55,49,47,44,41,23,13,53,63]}];
const POTION_FONT_TEMPLATES = (() => {
  const all = [];
  for (const atlas of Object.values(POTION_DIGITS)) {
    for (const spec of Object.values(atlas.places)) {
      for (const [digit, samples] of Object.entries(spec.labels)) {
        for (const sample of samples) {
          const w=spec.w,h=spec.h;
          if(sample.length!==w*h)continue;
          all.push({digit:Number(digit),w,h,signal:potionFontHighPass(sample,w,h),brightMask:potionFontBrightMask(sample)});
        }
      }
    }
  }
  for(const ref of POTION_73_88_GLYPHS) all.push({digit:ref.digit,w:ref.w,h:ref.h,signal:potionFontHighPass(ref.values,ref.w,ref.h),brightMask:potionFontBrightMask(ref.values)});
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
// Independent intensity-based check. High-pass shape matching can make the
// same 3/8 error repeatedly when background icon pixels resemble digit strokes.
// The secondary channel compares the *bright centers* of the printed glyphs.
// This is a rejection signal, never a guarantee or a second independent frame.
function potionFontBrightMask(values){
  return Uint8Array.from(values, v=>v>=103?1:0);
}
function potionFontBrightError(observed,reference){
  let mismatched=0,active=0;
  for(let i=0;i<observed.length;i++){
    mismatched+=observed[i]!==reference[i]?1:0;
    active+=(observed[i]||reference[i])?1:0;
  }
  return active?mismatched/active:1;
}
function potionFontGlyphCandidates(values,w,h,targetX,targetY,cache) {
  const scores=new Array(10).fill(Infinity);
  const goodPositions=new Array(10).fill(null);
  const brightScores=new Array(10).fill(Infinity);
  for(const glyph of POTION_FONT_TEMPLATES){
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=targetX+dx,y=targetY+dy;
      if(x<0||y<0||x+glyph.w>w||y+glyph.h>h)continue;
      const key=`${x},${y},${glyph.w},${glyph.h}`;
      let cached=cache.get(key);
      if(!cached){
        const pixels=new Float32Array(glyph.w*glyph.h);
        for(let cy=0;cy<glyph.h;cy++)for(let cx=0;cx<glyph.w;cx++)
          pixels[cy*glyph.w+cx]=values[(y+cy)*w+x+cx];
        cached={signal:potionFontHighPass(pixels,glyph.w,glyph.h),bright:potionFontBrightMask(pixels)};
        cache.set(key,cached);
      }
      let diff=0;
      const current=cached.signal;
      for(let i=0;i<current.length;i++)diff+=Math.abs(current[i]-glyph.signal[i]);
      const score=diff/current.length;
      // The bright-center mask intentionally excludes shadows. Keep the
      // best result for each glyph under both comparisons independently.
      const bright=potionFontBrightError(cached.bright,glyph.brightMask);
      if(bright<brightScores[glyph.digit])brightScores[glyph.digit]=bright;
      if(score<scores[glyph.digit]){scores[glyph.digit]=score;goodPositions[glyph.digit]={x,y,bright};}
    }
  }
  return scores.map((error,digit)=>({digit,error,position:goodPositions[digit],brightError:brightScores[digit]}))
    .sort((a,b)=>a.error-b.error);
}
const potionFontLastIssue={hp:'',mp:''};
function potionUniversalFontMatch(kind,raw){
  potionFontLastIssue[kind]='No confident font match';
  if(!raw||!POTION_FONT_TEMPLATES.length)return null;
  const w=raw.width,h=raw.height;
  const pixels=raw.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const values=new Float32Array(w*h);
  for(let i=0;i<values.length;i++)values[i]=(pixels[i*4]*77+pixels[i*4+1]*150+pixels[i*4+2]*29)/512;
  // Counts are left-aligned in the bottom-left of the slot. The expected
  // positions do not depend on the color or name of the assigned consumable.
  const slotX = kind==='mp' ? [4,16,27] : [4,14,25];
  const readings=[],cropCache=new Map();
  let sawShapeDisagreement=false;
  for(const length of [3,2]){
    // A lone glyph is easy to hallucinate inside the item artwork; use OCR
    // rather than accept one digit without evidence that the count ends there.
    const xs=length===3?slotX:length===2?[4,kind==='mp'?16:14]:[4];
    if(xs[xs.length-1]+9>w)continue;
    const candidates=xs.map(x=>potionFontGlyphCandidates(values,w,h,x,4,cropCache));
    const best=candidates.map(x=>x[0]);
    if(best.some(x=>!x||x.error>17.5))continue;
    // For three-digit stacks, require a strong prefix to distinguish a true
    // third glyph from artwork accidentally resembling a digit.
    if(length===3&&(best[0].error>13.5||best[1].error>16||best[2].error>14))continue;
    // Reject ambiguous digits: we prefer no reading to fabricated expenses.
    if(candidates.some(c=>c.length>1&&c[1].error-c[0].error<3.0))continue;
    // Explicitly consider 3, 8 AND 7: a crop may hallucinate a 7 even if
    // 3/8 aren't among the two closest high-pass candidates. If any of these
    // are plausible, require the second bright-core comparison to agree.
    const disputed=[];
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i],winner=c[0];
      const confusables=c.filter(x=>[3,7,8].includes(x.digit));
      const risk=[3,7,8].includes(winner.digit)||confusables.some(x=>x.error-winner.error<6);
      if(!risk)continue;
      // Bright-core distance is a separate, background-sensitive check. If
      // artwork hides the glyph, the correct response is UNKNOWN, not a guess.
      const brightRank=c.slice().sort((a,b)=>a.brightError-b.brightError);
      const brightBest=brightRank[0],secondBright=brightRank[1];
      const gap=secondBright?secondBright.brightError-brightBest.brightError:0;
      if(!brightBest||brightBest.digit!==winner.digit||
         winner.brightError>.36||gap<.035){
        disputed.push({position:i,shape:winner.digit,brightness:brightBest?.digit??null,
          difference:Number(gap.toFixed(3))});
      }
    }
    if(disputed.length){
      sawShapeDisagreement=true;
      continue;
    }
    const value=Number(best.map(x=>x.digit).join(''));
    if(!Number.isSafeInteger(value)||value<0||value>9999)continue;
    const avg=best.reduce((a,b)=>a+b.error,0)/length;
    readings.push({value,error:avg,length,shapeCrossChecked:true});
  }
  if(!readings.length){
    potionFontLastIssue[kind]=sawShapeDisagreement?
      'Pixel shape and bright digit centers disagree (possible 3/7/8 confusion)':'Digit pattern was too weak or incomplete';
    return null;
  }
  readings.sort((a,b)=>b.length-a.length||a.error-b.error);
  const best=readings[0];
  potionFontLastIssue[kind]='';
  return {value:best.value,confidence:Math.max(0,Math.min(94,Math.round(100-best.error*3))),source:'font-universal',
    shapeCrossChecked:true,
    note:`shared hotbar font ${best.value} (shape error ${best.error.toFixed(1)}; bright-core check passed)`};
}