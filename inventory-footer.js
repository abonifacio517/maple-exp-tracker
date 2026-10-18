'use strict';
// Seek the visible mesos footer itself, even if some other portion of the
// floating inventory is outside the browser-captured game frame.
// All coordinates below are relative to the inventory screenshot (338x469).
function findInventoryFooter(frame){
  if(!frame || !frame.data)return null;
  const W=frame.width,H=frame.height,p=frame.data;
  const sample=(x,y)=>{
    x=Math.round(x);y=Math.round(y);
    if(x<0||x>=W||y<0||y>=H)return null;
    const i=(y*W+x)*4;return [p[i],p[i+1],p[i+2]];
  };
  const white=(x,y)=>{
    const a=sample(x,y);
    return !!a&&a[0]>=238&&a[1]>=238&&a[2]>=238&&Math.max(...a)-Math.min(...a)<18;
  };
  const gold=(x,y)=>{
    const a=sample(x,y);
    return !!a&&a[0]>165&&a[1]>110&&a[0]>a[2]*1.8&&a[1]>a[2]*1.6;
  };
  const blueRail=(x,y)=>{
    const a=sample(x,y);
    return !!a&&a[0]<100&&a[1]>a[0]+18&&a[2]>a[1]+20;
  };
  // Testing just the white counter, gold coin and blue lower rail is much
  // cheaper and more position-tolerant than matching the entire inventory.
  for(const s of [1,.8,1.25,.65,1.5]){
    const d=Math.max(1,Math.round(2*s));
    const run1=Math.round(30*s),run2=Math.round(90*s);
    for(let y=0;y<H-16*s;y+=4){
      for(let x=3;x<W-run2-4;x+=3){
        if(!white(x,y)||!white(x+Math.round(6*s),y)||!white(x+run1,y)||!white(x+run2,y))continue;
        if(white(x-Math.max(3,Math.round(4*s)),y))continue;
        // The inner field is white from inventory X=44 to X≈266. Locate
        // its left/top edge from the actual pixels instead of guessing.
        let left=x;
        while(left>0 && white(left-1,y))left--;
        let top=y;
        while(top>0 && white(left+Math.round(20*s),top-1))top--;
        if(y-top<1*s || y-top>17*s)continue;
        const ox=Math.round(left-45*s),oy=Math.round(top-430*s);
        if(!white(ox+70*s,oy+440*s)||!white(ox+170*s,oy+440*s))continue;
        if(![450,451,452].some(row=>blueRail(ox+80*s,oy+row*s)))continue;
        let hasGold=false;
        for(const gx of [25,28,31])for(const gy of [436,440,444])
          if(gold(ox+gx*s,oy+gy*s))hasGold=true;
        // If the inventory is dragged partly beyond the left edge, the coin may
        // be clipped even though the complete meso textbox remains visible.
        if(!hasGold && ox+30*s>=0)continue;
        // Confirm the pale blue neighboring MESOS label is distinct from
        // the white numeric textbox, so other white game UI isn't mistaken.
        const label=sample(ox+285*s,oy+446*s);
        // Allow the right-hand MESOS label to be clipped, provided the white
        // numeric field and other identifying footer landmarks are visible.
        if(label && (label[2]<=label[0]+12||label[2]<145))continue;
        if(!label && ox+285*s<W)continue;
        const m=anchorMatcher(MAPLE_UI_ANCHORS.inventory,s,'inventory');
        return {x:ox,y:oy,s,m,score:.98,footer:true};
      }
    }
  }
  return null;
}