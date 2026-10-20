'use strict';
// Alpha 0.2.37: independent mesos-box locator, not an inventory-header finder.
// Finds the black-on-white textbox by its blue border and coin, anywhere in
// the consented video frame (including when the inventory window moves).
function findInventoryFooter(frame,previous=null){
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
  const darkBlue=(x,y)=>{
    const a=rgb(x,y);return !!a&&a[0]<115&&a[1]>a[0]+12&&a[2]>a[1]+16;
  };
  const gold=(x,y)=>{
    const a=rgb(x,y);return !!a&&a[0]>155&&a[1]>88&&a[0]>a[2]*1.65&&a[1]>a[2]*1.25;
  };
  function verify(x,y,s){
    // x/y are the TOP-LEFT WHITE PIXEL of the 222 x 21 mesos number field.
    const px=(dx,dy)=>[x+dx*s,y+dy*s];
    if(x-3*s<0||y-3*s<0||x+224*s>=W||y+25*s>=H)return null;
    if(![7,28,50,80,114].every(dx=>white(...px(dx,2))))return null;
    if(![15,50,100].every(dx=>white(...px(dx,17))))return null;
    if(![4,10,17].some(dy=>darkBlue(...px(-2,dy))))return null;
    if(![5,12,17].some(dy=>darkBlue(...px(223,dy))))return null;
    if(!darkBlue(...px(50,22)))return null;
    let goldFound=false;
    for(const dx of [-23,-19,-14])for(const dy of [6,10,14])if(gold(...px(dx,dy)))goldFound=true;
    if(!goldFound)return null;
    // Locate actual dark digits inside the white field (excluding border).
    let min=Infinity;
    const top=y+Math.round(2*s),bot=y+Math.round(19*s);
    for(let yy=top;yy<bot;yy++)for(let xx=x+Math.round(2*s);xx<x+Math.round(219*s);xx++){
      const a=rgb(xx,yy);if(!a)continue;
      const m=Math.max(...a),n=Math.min(...a);
      if(m<155&&m-n<55)min=Math.min(min,xx);
    }
    if(!Number.isFinite(min))return null;
    const left=Math.max(x+Math.round(2*s),min-Math.round(4*s));
    const right=Math.round(x+220*s);
    const rect={x:left,y:top,w:right-left,h:Math.round(18*s)};
    if(rect.w<8||rect.x+rect.w>W||rect.y+rect.h>H)return null;
    return {x,y,s,score:.98,footer:true,rect};
  }
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
  for(const s of [1,.8,1.25,.65,1.5]){
    const width=Math.round(225*s),height=Math.round(25*s);
    for(let y=3;y<H-height;y+=3)for(let x=3;x<W-width;x+=3){
      if(!white(x,y)||!white(x+Math.round(35*s),y)||!white(x+Math.round(80*s),y))continue;
      // Candidate can start up to 6 px after left edge because of scan stride.
      let left=x;
      for(let k=0;k<=Math.ceil(7*s);k++)if(white(x-k,y))left=x-k;
      // Candidate can be a few pixels below top edge.
      let top=y;
      for(let k=0;k<=Math.ceil(7*s);k++)if(white(left+Math.round(16*s),y-k))top=y-k;
      const found=verify(left,top,s);
      if(found)return found;
    }
  }
  return null;
}
