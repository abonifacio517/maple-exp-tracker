// Digit atlas for mesos textbox numerals from user-supplied screenshots.
// Includes a 5 from the confirmed 483,583 screenshot. Unseen digits must not be invented.
'use strict';
const MAPLE_MESO_FONT={"5":[{"w":9,"h":13,"bits":"111111110111111111110000000110000000110000000111111100111111110000000110000000110000000110110000110111111110001111100","source":"image(20261020-204532).png"}],"4":[{"w":8,"h":13,"bits":"00001100000011000001110001111100011011001100110011111111111111110000110000001100000011000000110000001100","source":"image(20261018-175433).png"},{"w":8,"h":13,"bits":"00000110000011100001111000111110011001101100011011111111111111110000011000000110000001100000011000000110","source":"image(20261018-200602).png"},{"w":8,"h":13,"bits":"00001100000111000001110001101100111011001100110011111111111111110000110000001100000011000000110000001100","source":"image(20261019-054711).png"}],"2":[{"w":8,"h":13,"bits":"00111110011111111100001111000011000000110000011000011100000110000011000011100000110000001111111111111111","source":"image(20261018-175433).png"},{"w":8,"h":13,"bits":"01111100111111101100001110000011000000110000111000011100000110000110000011100000110000001111111111111111","source":"image(20261018-200602).png"},{"w":8,"h":13,"bits":"00111110111111111100001100000011000001110000011000011100000110000111000011100000110000001111111111111111","source":"image(20261019-054711).png"}],"7":[{"w":9,"h":13,"bits":"111111111111111111000000011000001110000001100000001100000011100000111000000111000001110000001100000001100000001100000","source":"image(20261018-175433).png"}],"9":[{"w":8,"h":13,"bits":"00111110011111111100001111000011110000111100001111111111001111110000001100000111000001100111110000111000","source":"image(20261018-175433).png"},{"w":9,"h":13,"bits":"001111100011111110110000011110000011110000011110000011011111111001111111000000011000000110000001100001111000001110000","source":"image(20261018-175433).png"},{"w":8,"h":13,"bits":"00111110011111111100001111000011110000111100001111111111001111110000001100000111000001100011110000111000","source":"image(20261018-200602).png"}],"3":[{"w":8,"h":13,"bits":"01111100111111101100001110000011000000110001110000011111000000110000001110000011110000110111111001111100","source":"image(20261018-175433).png"},{"w":8,"h":13,"bits":"01111110111111111100001100000011000010110001111000001111000000110000001111000011110000110111111000111100","source":"image(20261019-054711).png"}],"6":[{"w":9,"h":13,"bits":"000011100000111100001100000111000000111000000111111100111111110110000011110000011110000011110000011001111100001111100","source":"image(20261018-200602).png"},{"w":8,"h":13,"bits":"00011100001111000110000011000000110000001111110011111111110000111100001111000011110000110111111001111100","source":"image(20261018-200602).png"},{"w":9,"h":13,"bits":"000111100000111100001100000111000000110000000111111100111111110110000011110000011110000011110000111011111100001111100","source":"image(20261018-200602).png"}],"8":[{"w":9,"h":13,"bits":"001111100011111110110000011110000011111010110001111100111111110110000011110000011110000011110000111001111100001111100","source":"image(20261019-054711).png"},{"w":9,"h":13,"bits":"001111100011111110110000011110000011111010110001111100111111110110000011110000111110000011110000111001111100001111100","source":"image(20261019-054711).png"}],"1":[{"w":5,"h":13,"bits":"00110011101111001110001100011000110001100011000110001101111111111","source":"image(20261019-054711).png"}]};

// Pure pixel matcher. Works with the frozen frame of the user-shared window;
// no game memory, process data, filesystem or automation is touched.
function readMesosDigits(frame,rect){
  if(!frame||!rect)return {value:null,note:'No mesos crop'};
  const W=frame.width,H=frame.height,d=frame.data;
  const x0=Math.round(rect.x),y0=Math.round(rect.y),w=Math.round(rect.w),h=Math.round(rect.h);
  if(x0<0||y0<0||x0+w>W||y0+h>H||w<12||h<7)return {value:null,note:'Mesos crop outside screenshot'};
  // Account for game-window scaling, but reject columns occupied by the
  // textbox's dark right edge. This is not a generic screen-text recognizer.
  const maxX=w-3,minX=2,minY=1,maxY=h-2;
  const masks=[];
  for(const threshold of [185,150]){
    const active=new Uint8Array(w*h);
    const counts=new Int16Array(w);
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
      const j=((y0+y)*W+x0+x)*4;
      const r=d[j],g=d[j+1],b=d[j+2];
      // Exclude blue rails and coloured HUD borders, which are not dark ink.
      if(Math.max(r,g,b)<threshold && Math.max(r,g,b)-Math.min(r,g,b)<42){active[y*w+x]=1;counts[x]++;}
    }
    const groups=[];let start=-1;
    for(let x=minX;x<=maxX;x++){
      const on=x<maxX&&counts[x]>0;
      if(on&&start===-1)start=x;
      if(!on&&start!==-1){groups.push([start,x-1]);start=-1;}
    }
    if(groups.length<1||groups.length>13){masks.push({threshold,valid:false,why:`${groups.length} segments`});continue;}
    const pieces=[];
    for(const [a,b] of groups){
      let top=maxY,bottom=minY;
      for(let y=minY;y<maxY;y++)for(let x=a;x<=b;x++)if(active[y*w+x]){top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(bottom<top)continue;
      const cols=b-a+1,rows=bottom-top+1;
      const bits=[];
      for(let y=top;y<=bottom;y++)for(let x=a;x<=b;x++)bits.push(active[y*w+x]);
      if(cols>=15 && cols<=36 && rows>=9){
        // Adjacent glyphs occasionally share a pixel column (for example
        // the confirmed "58" in the user's mesos screenshot). Split wide
        // blobs into two individually comparable digit shapes instead of
        // rejecting the whole balance as one unknown oversized glyph.
        const middle=Math.round(cols/2);
        for(const [left,right] of [[a,a+middle-1],[a+middle,b]]){
          let subTop=maxY,subBottom=minY;
          for(let yy=minY;yy<maxY;yy++)for(let xx=left;xx<=right;xx++)
            if(active[yy*w+xx]){subTop=Math.min(subTop,yy);subBottom=Math.max(subBottom,yy);}
          if(subBottom<subTop)continue;
          const subBits=[];
          for(let yy=subTop;yy<=subBottom;yy++)for(let xx=left;xx<=right;xx++)
            subBits.push(active[yy*w+xx]);
          pieces.push({a:left,b:right,top:subTop,bottom:subBottom,w:right-left+1,h:subBottom-subTop+1,bits:subBits});
        }
      }else pieces.push({a,b,top,bottom,w:cols,h:rows,bits});
    }
    masks.push({threshold,valid:pieces.length>0,pieces});
  }
  // Reject weak matches rather than turning 427,993 into 427,998 or losing a
  // digit. Additional templates can be added from user-confirmed screenshots.
  function compare(glyph,sample){
    let errors=0,fg=0;
    const nw=12,nh=16;
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){
      const gx=Math.min(glyph.w-1,Math.floor((x+.5)*glyph.w/nw));
      const gy=Math.min(glyph.h-1,Math.floor((y+.5)*glyph.h/nh));
      const sx=Math.min(sample.w-1,Math.floor((x+.5)*sample.w/nw));
      const sy=Math.min(sample.h-1,Math.floor((y+.5)*sample.h/nh));
      const a=Number(glyph.bits[gy*glyph.w+gx]||0);
      const b=Number(sample.bits[sy*sample.w+sx]||0);
      fg+=a;
      if(a!==b)errors++;
    }
    if(fg<10)return 1;
    return errors/(nw*nh);
  }
  function evaluate(mask){
    if(!mask.valid)return {value:null,note:mask.why||'No pieces'};
    const pieces=mask.pieces;
    let text='',worst=0,minMargin=1,average=0;
    let unknown=false;let parts=[];
    for(const piece of pieces){
      // A comma is narrow and descends lower than the normal character body.
      const comma=piece.w<=Math.max(3,Math.round(h*.2))&&piece.h<=Math.max(6,Math.round(h*.48))&&
        piece.top>h*.43;
      if(comma){text+=',';continue;}
      const all=[];
      for(const [digit,samples] of Object.entries(MAPLE_MESO_FONT)){
        let best=1;
        for(const sample of samples)best=Math.min(best,compare(sample,piece));
        all.push({digit,score:best});
      }
      all.sort((a,b)=>a.score-b.score);
      const first=all[0],second=all[1];
      worst=Math.max(worst,first.score);average+=first.score;
      const margin=second.score-first.score;
      minMargin=Math.min(minMargin,margin);
      // This template atlas is incomplete: 0 remains deliberately absent.
      // Never force the closest *known* glyph onto an unseen digit.
      if(first.score>.145 || margin<.035){unknown=true;}
      text+=first.digit;parts.push(`${first.digit}@${piece.a}-${piece.b}/${piece.top}-${piece.bottom}:${Math.round(first.score*100)}-${Math.round(margin*100)}`);
    }
    // Full plain numerals and correctly grouped comma values only.
    const parsed=typeof parseMesosText==='function'?parseMesosText(text):null;
    if(unknown||parsed===null)return {value:null,note:`${text||'?'} ambiguous (shape ${(worst*100).toFixed(1)}%, margin ${(minMargin*100).toFixed(1)}%) [${parts.join(",")}]`,score:0,parts};
    const score=Math.min(1,Math.max(0,1-average/Math.max(1,text.replace(/,/g,'').length)/.20));
    return {value:parsed,text,score,margin:minMargin,note:`${text} (font ${Math.round(score*100)}%, margin ${Math.round(minMargin*100)}%)`};
  }
  const a=evaluate(masks[0]),b=evaluate(masks[1]);
  if(a.value!==null&&b.value!==null&&a.value===b.value)return {...a,score:Math.min(a.score,b.score),note:`${a.note} · thresholds agree`};
  if(a.value!==null&&a.score>.88)return {...a,note:a.note+' · another threshold uncertain'};
  if(b.value!==null&&b.score>.88)return {...b,note:b.note+' · another threshold uncertain'};
  return {value:null,note:`185: ${a.note}; 150: ${b.note}`};
}