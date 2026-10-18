'use strict';
// Specialized *individual digit* templates from real user hotbar screenshots.
// Unknown digits are rejected, never forced into the nearest stored value.
function potionDigitMatch(kind,raw){
  const atlas=POTION_DIGITS[kind];
  if(!atlas||!raw||!$(kind+'PotionSelect')||$(kind+'PotionSelect').value!==atlas.item)return null;
  const [rx,ry,w,h]=atlas.rect;
  const resized=document.createElement('canvas');resized.width=w;resized.height=h;
  const ctx=resized.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  ctx.drawImage(raw,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h).data;
  const byPlace={};
  for(const [place,p] of Object.entries(atlas.places)){
    const observed=[];
    for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
      const j=((y+p.y)*w+x+p.x)*4;
      observed.push(((pixels[j]*77+pixels[j+1]*150+pixels[j+2]*29)/256)>>1);
    }
    const candidates=[];
    for(const [digit,samples] of Object.entries(p.labels)){
      let best=Infinity;
      for(const example of samples){
        let err=0;
        for(let i=0;i<observed.length;i++)err+=Math.abs(observed[i]-example[i]);
        best=Math.min(best,err/observed.length);
      }
      candidates.push({digit:Number(digit),err:best});
    }
    candidates.sort((a,b)=>a.err-b.err);
    const first=candidates[0],second=candidates[1];
    // The atlas stores luma/2; this ~6/127 threshold is stricter than generic
    // OCR and guards against an unseen numeral being mapped to a nearby one.
    if(!first||first.err>6 || (second&&second.err-first.err<3.5))return null;
    byPlace[place]=first;
  }
  const value=(byPlace.hundreds?.digit||0)*100+(byPlace.tens?.digit||0)*10+byPlace.ones.digit;
  const error=Math.max(...Object.values(byPlace).map(x=>x.err));
  return {value,confidence:99,source:'digit-templates',
    note:`independent pixel digits ${value}, max error ${(error*2).toFixed(1)}/255`};
}