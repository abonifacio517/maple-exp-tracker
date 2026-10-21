'use strict';
// Alpha 0.2.37: independent mesos-box locator, not an inventory-header finder.
// Finds the black-on-white textbox by its blue border and coin, anywhere in
// the consented video frame (including when the inventory window moves).
async function findInventoryFooter(frame,previous=null,shouldContinue=()=>true){
  // Full-screen discovery is split across browser frames so a large or missing
  // inventory cannot monopolize the UI thread. Recheck the previous anchor
  // synchronously first: stable inventories still complete immediately.
  const yieldToBrowser=()=>new Promise(resolve=>setTimeout(resolve,0));
  let sliceStart=performance.now();
  async function yieldIfBusy(){
    if(performance.now()-sliceStart>=9){
      await yieldToBrowser();
      sliceStart=performance.now();
      return shouldContinue();
    }
    return true;
  }
  if(!frame?.data||!frame.width||!frame.height)return null;
  const W=frame.width,H=frame.height,p=frame.data;
  const rgb=(x,y)=>{
    x=Math.round(x);y=Math.round(y);
    if(x<0||y<0||x>=W||y>=H)return null;
    const i=(y*W+x)*4;return [p[i],p[i+1],p[i+2]];
  };
  const white=(x,y)=>{
    const a=rgb(x,y);return !!a&&a[0]>232&&a[1]>232&&a[2]>232&&Math.max(...a)-Math.min(...a)<23;
  };
  const blueRail=(x,y)=>{
    const a=rgb(x,y);
    // Lightly rescaled game windows may antialias the one-pixel border.
    return !!a&&a[0]<215&&a[1]>a[0]+8&&a[2]>a[1]+8&&a[2]-a[0]>19;
  };
  const nearRail=(x,y,radius=2)=>{
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)
      if(blueRail(x+dx,y+dy))return true;
    return false;
  };
  const gold=(x,y)=>{
    const a=rgb(x,y);return !!a&&a[0]>155&&a[1]>88&&a[0]>a[2]*1.65&&a[1]>a[2]*1.25;
  };
  function verify(x,y,s){
    // x/y are the TOP-LEFT WHITE PIXEL of the 222 x 21 mesos number field.
    const px=(dx,dy)=>[x+dx*s,y+dy*s];
    if(x-3*s<0||y-3*s<0||x+224*s>=W||y+25*s>=H)return null;
    if(![7,28,50,80,114,205].every(dx=>white(...px(dx,2))))return null;
    if(![15,50,100].every(dx=>white(...px(dx,17))))return null;
    // The full white run must be 222 game pixels wide. This prevents
    // falsely accepting a neighboring textbox at a different UI scale.
    let run=0;
    while(run<Math.round(227*s)&&white(x+run,y+2*s))run++;
    if(run<Math.round(211*s)||run>Math.round(226*s))return null;
    if(![4,10,17].some(dy=>nearRail(...px(-2,dy))))return null;
    if(![5,12,17].some(dy=>nearRail(...px(223,dy))))return null;
    if(!nearRail(...px(50,22),3))return null;
    let goldFound=false;
    for(const dx of [-23,-19,-14])for(const dy of [6,10,14])if(gold(...px(dx,dy)))goldFound=true;
    if(!goldFound)return null;
    // Require real dark digits, but NEVER use their detected position to trim the crop.
    let min=Infinity;
    const top=y+Math.round(2*s),bot=y+Math.round(19*s);
    for(let yy=top;yy<bot;yy++)for(let xx=x+Math.round(2*s);xx<x+Math.round(219*s);xx++){
      const a=rgb(xx,yy);if(!a)continue;
      const m=Math.max(...a),n=Math.min(...a);
      if(m<155&&m-n<55)min=Math.min(min,xx);
    }
    if(!Number.isFinite(min))return null;
    // Never derive the crop's LEFT EDGE from the first detected dark pixel.
    // A faint/thin leading 1, 4 or another digit could be overlooked, so
    // anchoring to min would crop it away even when the full text is visible.
    // Instead keep a wide, fixed, right-aligned portion of the verified white
    // field. It fits up to 12 digits and grouping commas, at every UI scale.
    // No pixel enhancement is applied; the AI sees untouched source pixels.
    const right=Math.round(x+220*s);
    const left=Math.max(Math.round(x+2*s),right-Math.round(165*s));
    // Keep the COMPLETE 21px white field, including descenders and comma
    // tails. The old y+2, height=18 crop was then trimmed *again* by the
    // font reader and OCR, discarding the lower 2-4 rows of real glyphs.
    // Include one source pixel above and below to avoid boundary clipping
    // at fractional display scales. Blue rails are masked by the readers.
    const cropTop=Math.max(0,Math.round(y-Math.max(1,s)));
    const cropBottom=Math.min(H,Math.round(y+22*s));
    const rect={x:left,y:cropTop,w:right-left,h:cropBottom-cropTop};
    if(rect.w<8||rect.h<12||rect.x+rect.w>W||rect.y+rect.h>H)return null;
    return {x,y,s,score:.98,footer:true,rect};
  }
  // Alpha 0.2.52: image-template anchor search from the player's actual
  // mesos footer screenshot (329x48). We NEVER template-match changing digits.
  // The gold coin and fixed MESOS lettering are stable at every balance.
  // Field white starts at reference (39,14). Rows sample the word MESOS at
  // x=270..315 with 3px stride; '1' = pale letter, '0' = blue background,
  // 'x' = anti-aliasing uncertainty (excluded from comparison).
  const labelRows=[
    [8,'10xx110110110111'],
    [10,'1x1x000000000x00'],
    [12,'1x1xxx0xx00000xx'],
    [14,'101x110110110110']
  ];
  const coinOn=[[-16,6],[-14,6],[-12,6],[-18,8],[-16,8],[-14,8],
    [-12,8],[-18,12],[-16,12],[-14,12],[-12,12],[-18,14],[-16,14]];
  const coinEdge=[[-8,8],[-8,10],[-8,12],[-8,14]];
  const lightLetter=(x,y)=>{
    const a=rgb(x,y);return !!a&&Math.min(...a)>193&&
      Math.max(...a)-Math.min(...a)<65;
  };
  const darkOutline=(x,y)=>{
    const a=rgb(x,y);return !!a&&Math.max(...a)<130;
  };
  function anchorScore(x,y,s){
    let goldHits=0;
    for(const [dx,dy] of coinOn)if(gold(x+dx*s,y+dy*s))goldHits++;
    if(goldHits<coinOn.length*.69)return null;
    let edgeHits=0;
    for(const [dx,dy] of coinEdge)if(darkOutline(x+dx*s,y+dy*s))edgeHits++;
    if(edgeHits<2)return null;
    let labelHits=0,needed=0;
    for(const [dy,pattern] of labelRows){
      for(let i=0;i<pattern.length;i++){
        const mark=pattern[i];if(mark==='x')continue;
        const px=x+(231+3*i)*s,py=y+dy*s;
        const found=mark==='1'?lightLetter(px,py):blueRail(px,py);
        needed++;if(found)labelHits++;
      }
    }
    const label=labelHits/Math.max(1,needed);
    if(label<.68)return null;
    return .45*(goldHits/coinOn.length)+.15*(edgeHits/coinEdge.length)+.40*label;
  }
  function verifyVisual(x,y,s){
    if(x-24*s<0||y-3*s<0||x+282*s>=W||y+24*s>=H)return null;
    if(![8,35,80,135,205].every(dx=>white(x+dx*s,y+2*s)))return null;
    if(![15,50,100].every(dx=>white(x+dx*s,y+17*s)))return null;
    // Verify both the border geometry AND icon + label; a similarly colored
    // inventory rectangle elsewhere cannot be mistaken for this footer.
    if(!nearRail(x-2*s,y+10*s,3)||!nearRail(x+223*s,y+11*s,3)||
       !nearRail(x+50*s,y+22*s,3))return null;
    const score=anchorScore(x,y,s);
    if(score===null)return null;
    const right=Math.round(x+220*s);
    const left=Math.max(Math.round(x+2*s),right-Math.round(165*s));
    const top=Math.max(0,Math.round(y-Math.max(1,s)));
    const bottom=Math.min(H,Math.round(y+22*s));
    const rect={x:left,y:top,w:right-left,h:bottom-top};
    if(rect.w<8||rect.h<12||rect.x+rect.w>W)return null;
    return {x,y,s,score,footer:true,rect,method:'coin + MESOS visual anchors'};
  }
  // First recheck the old position quickly with both detection methods.
  // A changed layout or scaled capture may fail the legacy pixel verifier.
  if(previous?.footer){
    const direct=verifyVisual(previous.x,previous.y,previous.s);
    if(direct)return direct;
  }
  // The original detector is also allowed to validate a stable previous
  // position BEFORE either full-screen search. This prevents rescanning
  // large displays when a theme/resolution does not match the new template.
  // Revalidate last position first, but immediately search the whole frame if moved.
  if(previous?.footer){
    const last=verify(previous.x,previous.y,previous.s);
    if(last)return last;
    const r=16;
    for(let dy=-r;dy<=r;dy+=3)for(let dx=-r;dx<=r;dx+=3){
      const found=verify(previous.x+dx,previous.y+dy,previous.s);
      if(found)return found;
    }
  }
  // Cheap two-pixel gold gate makes the expensive label template run only
  // near plausible coin icons. The search is time-sliced for large screens.
  for(const scale of [1,.8,1.25,.65,1.5]){
    for(let y=3;y<H-Math.round(29*scale);y+=3){
      if(!(await yieldIfBusy()))return null;
      for(let x=Math.ceil(25*scale);x<W-Math.round(283*scale);x+=3){
        if(!gold(x-16*scale,y+10*scale)||
           !gold(x-12*scale,y+11*scale)||
           !white(x+80*scale,y+2*scale))continue;
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
          const match=verifyVisual(x+dx,y+dy,scale);
          if(match)return match;
        }
      }
    }
  }
  for(const s of [1,.8,1.25,.65,1.5]){
    const width=Math.round(225*s),height=Math.round(25*s);
    for(let y=3;y<H-height;y+=3){
      // Time slicing at row boundaries limits even 4K searches to a few
      // milliseconds at a time, without changing the detector's geometry.
      if(!(await yieldIfBusy()))return null;
      for(let x=3;x<W-width;x+=3){
      if(!white(x,y)||!white(x+Math.round(35*s),y)||!white(x+Math.round(80*s),y))continue;
      // Candidate can start up to 6 px after left edge because of scan stride.
      let left=x;
      for(let k=0;k<=Math.ceil(7*s);k++)if(white(x-k,y))left=x-k;
      // Candidate can be a few pixels below top edge.
      let top=y;
      for(let k=0;k<=Math.ceil(7*s);k++)if(white(left+Math.round(16*s),y-k))top=y-k;
      // Pixel rounding at 65–150% scaling can shift the detected edge 1–2px.
      for(const dx of [-2,-1,0,1,2])for(const dy of [-2,-1,0,1,2]){
        const found=verify(left+dx,top+dy,s);
        if(found)return found;
      }
      }
    }
  }
  return null;
}
