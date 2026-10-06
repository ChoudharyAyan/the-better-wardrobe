import sharp from 'sharp';

// A fast colour gate for search results (design QA, 6 Oct: "white shirt" came back blue and pink).
// Two cheap checks, no model call: the title must not name only a different colour, and the product
// photo's centre (where the garment sits on a model or a flat lay) must actually carry the colour asked for.
// Anything that can't be checked in time is kept, so a slow thumbnail never empties the results.

// Each family: words that name it, and a pixel test on 0-255 RGB.
const FAMILIES={
 white:{words:/\b(white|off[- ]?white|ivory|cream|snow)\b/,px:(r,g,b,mx,mn)=>mn>=150&&mx-mn<=14},
 black:{words:/\b(black|jet|charcoal black|onyx)\b/,px:(r,g,b,mx)=>mx<=70},
 grey:{words:/\b(grey|gray|charcoal|ash|silver|slate)\b/,px:(r,g,b,mx,mn)=>mx-mn<=22&&mx>55&&mn<200},
 blue:{words:/\b(blue|navy|denim|indigo|teal|turquoise|aqua|cobalt|sky)\b/,hue:[185,255]},
 green:{words:/\b(green|olive|khaki green|mint|sage|emerald|bottle green)\b/,hue:[70,170]},
 red:{words:/\b(red|maroon|burgundy|wine|crimson|scarlet)\b/,hue:[345,15]},
 pink:{words:/\b(pink|rose|blush|fuchsia|magenta|peach|mauve|lavender|lilac)\b/,hue:[280,350],light:true},
 purple:{words:/\b(purple|violet|plum|aubergine)\b/,hue:[260,310]},
 yellow:{words:/\b(yellow|mustard|lemon|golden)\b/,hue:[42,68]},
 orange:{words:/\b(orange|rust|coral|tangerine)\b/,hue:[12,40]},
 brown:{words:/\b(brown|tan|beige|camel|khaki|coffee|chocolate|cognac|taupe|sand|mocha)\b/,hue:[8,48],dull:true}
};
export function colourFamily(text){
 const t=String(text||'').toLowerCase();
 const hits=Object.entries(FAMILIES).filter(([,f])=>f.words.test(t)).map(([k])=>k);
 // "Off-white", "cream" and "ivory" also contain words of other families in some titles; the first named wins for queries.
 return hits.length===1?hits[0]:hits.length?hits:'';
}
const namesIn=title=>Object.entries(FAMILIES).filter(([,f])=>f.words.test(title)).map(([k])=>k);
// A title that names colours, none of them the one asked for, is the wrong colour. "Blue and white stripe" keeps white.
export function titleColourConflict(title,wanted){
 if(!wanted||Array.isArray(wanted))return false;
 const named=namesIn(String(title||'').toLowerCase());
 return named.length>0&&!named.includes(wanted);
}
const hueOf=(r,g,b,mx,mn)=>{const d=mx-mn;if(!d)return 0;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;return h<0?h+360:h;};
const inHue=(h,[a,b])=>a<=b?h>=a&&h<=b:h>=a||h<=b;
function pixelMatches(family,r,g,b){
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),f=FAMILIES[family];
 if(f.px)return f.px(r,g,b,mx,mn);
 const chroma=mx-mn;if(chroma<(f.light?14:22)||mx<45)return false;
 if(f.dull&&mx>235&&chroma<30)return false;
 return inHue(hueOf(r,g,b,mx,mn),f.hue);
}
// Share of the photo's centre that is the wanted colour. null when the image is too small or unreadable.
export async function colourShare(buffer,family){
 try{
  const img=sharp(buffer).rotate();const {width,height}=await img.metadata();
  if(!width||!height||width<24||height<24)return null;
  // Centre band: skips the background margins and the model's head and legs.
  const left=Math.round(width*.3),top=Math.round(height*.3),w=Math.max(1,Math.round(width*.4)),h=Math.max(1,Math.round(height*.35));
  const {data,info}=await sharp(buffer).rotate().extract({left,top,width:w,height:h}).resize(24,24,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let hit=0;const n=info.width*info.height;
  for(let i=0;i<data.length;i+=3)if(pixelMatches(family,data[i],data[i+1],data[i+2]))hit++;
  return hit/n;
 }catch{return null;}
}
// Drops results whose photo clearly isn't the wanted colour. Runs every thumbnail in parallel inside `budgetMs`.
export async function colourGate(items,colour,fetchImage,{budgetMs=900,minShare=.3}={}){
 const family=colourFamily(colour);
 const report={family:Array.isArray(family)?'':family,checked:0,titleRejected:0,photoRejected:0,ms:0};
 if(!family||Array.isArray(family))return {items,report};
 const started=Date.now();
 const kept=items.filter(p=>{if(titleColourConflict(p.title,family)){report.titleRejected++;return false;}return true;});
 let timer;const deadline=new Promise(resolve=>{timer=setTimeout(resolve,budgetMs,'late');timer.unref?.();});
 const verdicts=await Promise.all(kept.map(async p=>{
  if(!p.image)return true;
  const result=await Promise.race([(async()=>{const asset=await fetchImage(String(p.image).replace(/^http:\/\//,'https://'));return colourShare(Buffer.from(asset.data,'base64'),family);})().catch(()=>null),deadline]);
  if(result==='late'||result===null)return true;
  report.checked++;
  // A title that names the wanted colour is trusted over a dim or busy photo.
  if(result<minShare&&!FAMILIES[family].words.test(String(p.title).toLowerCase())){report.photoRejected++;return false;}
  return true;
 }));
 clearTimeout(timer);report.ms=Date.now()-started;
 return {items:kept.filter((_,i)=>verdicts[i]),report};
}
