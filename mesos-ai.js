'use strict';
// Alpha 0.2.43 — Local, supervised, instance-based digit recognition.
// This is a lightweight k-NN classifier, NOT a pre-trained neural network.
// Only EXPLICITLY confirmed player corrections provide training labels.
// Raw image pixels never leave the browser or enter persistent storage.
window.MapleMesosAI=(()=>{
  const KEY='vansMapleMesosLocalDigitsV1',VERSION=1;
  const GW=12,GH=16,MAX_PER_DIGIT=36,MAX_TOTAL=300;
  let samples=[],enabled=true;
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved?.version===VERSION&&Array.isArray(saved.samples)){
      samples=saved.samples.filter(x=>x&&/^[0-9]$/.test(x.d)&&
        typeof x.bits==='string'&&/^[01]{192}$/.test(x.bits)).slice(-MAX_TOTAL);
    }
  }catch(_){}
  try{enabled=localStorage.getItem(KEY+'Enabled')!=='false';}catch(_){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({version:VERSION,samples}))}catch(_){}};
  const summary=()=>{
    const counts=Array.from({length:10},(_,i)=>samples.filter(x=>x.d===String(i)).length);
    return {examples:samples.length,digits:counts.filter(Boolean).length,counts,enabled};
  };
  const setEnabled=v=>{enabled=!!v;try{localStorage.setItem(KEY+'Enabled',String(enabled))}catch(_){}};
  const clear=()=>{samples=[];save()};
  const median=arr=>{const a=arr.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
  function segment(frame,rect,wanted=null){
    if(!frame?.data||!rect)return {pieces:[],reason:'No inventory crop'};
    const W=frame.width,H=frame.height,p=frame.data;
    const x0=Math.round(rect.x),y0=Math.round(rect.y),w=Math.round(rect.w),h=Math.round(rect.h);
    if(w<8||h<8||x0<0||y0<0||x0+w>W||y0+h>H)
      return {pieces:[],reason:'Crop is out of bounds'};
    const gray=(x,y)=>{const i=((y0+y)*W+x0+x)*4;return [p[i],p[i+1],p[i+2]]};
    const white=(x,y)=>{const [r,g,b]=gray(x,y);
      return Math.min(r,g,b)>=215&&Math.max(r,g,b)-Math.min(r,g,b)<=35};
    const validRows=new Uint8Array(h);
    for(let y=0;y<h;y++)if(white(0,y)&&white(w-1,y))validRows[y]=1;
    if(validRows.reduce((a,b)=>a+b,0)<7)
      return {pieces:[],reason:'Could not isolate white number-box rows'};
    const mask=new Uint8Array(w*h),cols=new Uint16Array(w);
    for(let y=0;y<h;y++){
      if(!validRows[y])continue;
      for(let x=1;x<w-1;x++){
        const [r,g,b]=gray(x,y);
        const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
        if(mx<198&&mx-mn<48){mask[y*w+x]=1;cols[x]++}
      }
    }
    const groups=[];
    let left=-1;
    for(let x=1;x<w;x++){
      const ink=x<w-1&&cols[x]>0;
      if(ink&&left<0)left=x;
      if(!ink&&left>=0){groups.push({left,right:x-1});left=-1}
    }
    const measure=g=>{
      let top=h,bottom=-1,on=0;
      for(let y=0;y<h;y++)for(let x=g.left;x<=g.right;x++)
        if(mask[y*w+x]){top=Math.min(top,y);bottom=Math.max(bottom,y);on++}
      return {...g,top,bottom,width:g.right-g.left+1,height:bottom-top+1,on}
    };
    const first=groups.map(measure).filter(g=>g.on>0);
    const normalHeight=median(first.map(x=>x.height).filter(x=>x>=7))||0;
    const glyphs=first.filter(g=>!(
      g.height<=Math.max(5,normalHeight*.70)&&g.width<=Math.max(4,normalHeight*.45)
      &&g.top>=(h-normalHeight)*.5+normalHeight*.45
    ));
    if(!glyphs.length)return {pieces:[],reason:'No digits isolated'};
    // Real Maple digits sometimes touch (e.g. "58"). Split a merged run
    // near its least-inked middle column. Never call short comma tails digits.
    // Only split when the run is much wider than neighboring digit glyphs.
    const splitBudget=wanted===null?12:Math.max(0,wanted-glyphs.length);
    let splitCount=0;
    while(splitCount<splitBudget){
      const normal=median(glyphs.filter(g=>g.height>=normalHeight*.73&&
        g.width>=3&&g.width<=normalHeight*.95).map(g=>g.width))||
        Math.max(5,Math.round(normalHeight*.63));
      const idx=glyphs.findIndex(g=>g.height>=normalHeight*.73&&
        g.width>=10&&g.width>normal*1.62&&g.width>normalHeight*.95);
      if(idx<0)break;
      const g=glyphs[idx],middle=Math.round((g.left+g.right)/2);
      let cut=middle,lowest=Infinity;
      for(let x=Math.max(g.left+3,middle-2);x<=Math.min(g.right-3,middle+2);x++){
        const density=cols[x];
        if(density<lowest){cut=x;lowest=density}
      }
      const parts=[measure({left:g.left,right:cut}),measure({left:cut+1,right:g.right})];
      if(parts.some(part=>part.height<normalHeight*.70||part.on<5))break;
      glyphs.splice(idx,1,...parts);splitCount++;
    }
    if(wanted!==null&&glyphs.length!==wanted)
      return {pieces:[],reason:`Detected ${glyphs.length} digit groups; ${wanted} were confirmed. No samples saved.`};
    if(wanted!==null&&glyphs.some(g=>g.height<normalHeight*.72||
      g.width>Math.max(18,normalHeight*1.20)))
      return {pieces:[],reason:'Glyph shapes do not align safely with the confirmed number.'};
    if(glyphs.length>12)return {pieces:[],reason:'Too many digit shapes'};
    function normalize(g){
      const bits=new Uint8Array(GW*GH);
      // Preserve relative digit aspect, including thin ones and lower strokes.
      const scale=Math.min((GW-2)/g.width,(GH-2)/g.height);
      const dw=Math.max(1,Math.round(g.width*scale)),dh=Math.max(1,Math.round(g.height*scale));
      const ox=Math.floor((GW-dw)/2),oy=Math.floor((GH-dh)/2);
      for(let yy=0;yy<dh;yy++)for(let xx=0;xx<dw;xx++){
        const sx=g.left+Math.min(g.width-1,Math.floor((xx+.5)*g.width/dw));
        const sy=g.top+Math.min(g.height-1,Math.floor((yy+.5)*g.height/dh));
        bits[(yy+oy)*GW+xx+ox]=mask[sy*w+sx];
      }
      return Array.from(bits).join('');
    }
    return {pieces:glyphs.map(g=>({bits:normalize(g),width:g.width,height:g.height})),
      reason:'Ready',digitGroups:glyphs.length};
  }
  function distance(a,b){
    let intersection=0,union=0;
    for(let i=0;i<a.length;i++){
      const p=a[i]==='1',q=b[i]==='1';
      if(p&&q)intersection++;
      if(p||q)union++;
    }
    return union?1-intersection/union:1;
  }
  function learn(frame,rect,confirmed){
    const str=String(confirmed||'').replace(/,/g,'').trim();
    if(!/^\d{1,12}$/.test(str))return {ok:false,reason:'Enter a confirmed balance first'};
    const found=segment(frame,rect,str.length);
    if(found.pieces.length!==str.length)return {ok:false,reason:found.reason};
    let added=0;
    for(let i=0;i<str.length;i++){
      const d=str[i],bits=found.pieces[i].bits;
      if(samples.some(x=>x.d===d&&x.bits===bits))continue;
      samples.push({d,bits});added++;
    }
    for(const d of '0123456789'){
      const indices=samples.map((x,i)=>x.d===d?i:-1).filter(x=>x>=0);
      if(indices.length>MAX_PER_DIGIT){
        const remove=new Set(indices.slice(0,indices.length-MAX_PER_DIGIT));
        samples=samples.filter((_,i)=>!remove.has(i));
      }
    }
    if(samples.length>MAX_TOTAL)samples=samples.slice(-MAX_TOTAL);
    save();
    return {ok:true,added,reason:added?`Learned ${added} new digit examples locally`:
      'Those exact digit shapes were already learned',summary:summary()};
  }
  function predict(frame,rect){
    if(!enabled)return {value:null,confidence:0,reason:'Local AI disabled'};
    if(!samples.length)return {value:null,confidence:0,reason:'No confirmed training examples yet'};
    const found=segment(frame,rect);
    if(!found.pieces.length)return {value:null,confidence:0,reason:found.reason};
    let chars='',distances=[],margins=[];
    for(const piece of found.pieces){
      const ranks=new Map();
      for(const sample of samples){
        const dis=distance(piece.bits,sample.bits);
        if(!ranks.has(sample.d)||ranks.get(sample.d)>dis)ranks.set(sample.d,dis);
      }
      const ordered=[...ranks].sort((a,b)=>a[1]-b[1]);
      if(!ordered.length)return {value:null,confidence:0,reason:'No trained digits'};
      const [d,best]=ordered[0];
      const second=ordered[1]?.[1]??1;
      chars+=d;distances.push(best);margins.push(second-best);
    }
    const avg=distances.reduce((a,b)=>a+b,0)/distances.length;
    const worst=Math.max(...distances);
    const margin=Math.min(...margins);
    const confidence=Math.max(0,Math.min(1,1-avg/.48));
    // Estimate only when every digit resembles a known player-confirmed shape;
    // do not inflate session totals just because the classifier found a match.
    const reliable=worst<=.30&&avg<=.19&&margin>=.065;
    const value=Number(chars);
    if(!Number.isSafeInteger(value)||value>1e12)
      return {value:null,confidence,reason:'Invalid predicted balance'};
    return {value:reliable?value:null,candidate:value,confidence,reliable,
      digits:chars,reason:reliable?'Local learned digits matched':
        `Needs training (distance ${Math.round(avg*100)}%, margin ${Math.round(margin*100)}%)`};
  }
  return {summary,setEnabled,clear,segment,learn,predict};
})();