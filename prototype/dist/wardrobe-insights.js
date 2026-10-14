// My Wardrobe "what next" helpers (PRD FR#7, FR#13, FR#15). Pure functions, no DOM, so the
// rules behind the snapshot, gaps, recap and "complete this look" can be tested on their own.
(()=>{
const TOPS=['Shirts','Ethnic wear','Outerwear'],BOTTOMS=['Trousers'],ONE_PIECE=['Dresses','Suits'];
const text=p=>[p.name,p.type,p.brand,p.colour].filter(Boolean).join(' ').toLowerCase();

// Colour names as Indian shops write them, mapped to a swatch. Basics carry their own hex.
const SWATCH={black:'#26232A',white:'#F6F3EC','off white':'#EFE8DA',cream:'#EDE3CC',beige:'#D8C3A0',khaki:'#B9A36F',brown:'#7A4F2E',tan:'#B98654',grey:'#9C9AA2',gray:'#9C9AA2',charcoal:'#45434A',
 navy:'#22304F',blue:'#4A6A92','light blue':'#B9CFE6',teal:'#2E7D7A',green:'#4F7A4A',olive:'#6B6B3A','sea green':'#3E8E7E',mint:'#BFE3CF',yellow:'#E9C443',mustard:'#C99A2E',orange:'#E07B39',
 peach:'#F2B89A',red:'#C23B3B',maroon:'#7E1F3A',burgundy:'#6E1F2E',pink:'#E7A3BE',magenta:'#B0306F',purple:'#6E4A8E',lavender:'#C6B5E0',gold:'#C9A54A',silver:'#C0C0C8',multi:'#B48FB0'};
const NAMES=Object.keys(SWATCH).sort((a,b)=>b.length-a.length);
function colourOf(p){
 if(p.art?.colour)return {name:String(p.name||'').split(' ')[0].toLowerCase(),hex:p.art.colour};
 const t=[p.colour,p.color,p.name].filter(Boolean).join(' ').toLowerCase();
 const name=NAMES.find(n=>new RegExp('\\b'+n+'\\b').test(t));
 return name?{name:name==='gray'?'grey':name,hex:SWATCH[name]}:null;
}
function palette(items,max=6){
 const counts=new Map();
 for(const p of items){const c=colourOf(p);if(!c)continue;const e=counts.get(c.name)||{...c,count:0};e.count++;counts.set(c.name,e);}
 return [...counts.values()].sort((a,b)=>b.count-a.count).slice(0,max);
}
function balance(items,categories){
 const n=items.length||1;
 return categories.map(c=>({category:c,count:items.filter(p=>p.category===c).length})).filter(x=>x.count).map(x=>({...x,share:x.count/n}));
}

// What is missing for common occasions (PRD FR#15). Each gap names what to look for, so the app
// can send it to Discover as a search. Wedding and festive wear follow the profile's gender.
function gaps(items,profile={}){
 const has=re=>items.some(p=>re.test(text(p)));
 const cat=c=>items.some(p=>p.category===c);
 const female=profile?.gender==='female',male=profile?.gender==='male';
 const out=[];
 if(!has(/formal|oxford|derby|loafer|brogue|monk|heel|pump|bellies/)&&cat('Footwear'))out.push({id:'formal-shoes',title:'No formal shoes',why:'For interviews, office days and dinners.',search:female?'formal heels':'formal derby shoes'});
 if(!cat('Footwear'))out.push({id:'shoes',title:'No shoes yet',why:'Every outfit ends at the shoes.',search:'white sneakers'});
 if(!has(/sherwani|bandhgala|lehenga|saree|sari\b|anarkali|kurta set|nehru|achkan|silk kurta/))out.push({id:'wedding',title:'Nothing for a wedding',why:'Shaadi season comes round every year.',search:female?'lehenga':male?'silk kurta set':'festive ethnic wear'});
 if(!cat('Outerwear'))out.push({id:'layer',title:'No layer for cold days',why:'A jacket or sweater for winter and air-conditioned offices.',search:'denim jacket'});
 if(!has(/white (shirt|t-?shirt|tee)/)&&(male||!female))out.push({id:'white-shirt',title:'No white shirt',why:'The piece that goes with everything.',search:'white oxford shirt'});
 if(!cat('Trousers')&&!cat('Dresses'))out.push({id:'bottoms',title:'No trousers or jeans',why:'Your tops need something to go with.',search:'straight fit jeans'});
 if(!cat('Belts')&&cat('Trousers'))out.push({id:'belt',title:'No belt',why:'Finishes trousers and jeans.',search:'brown leather belt'});
 return out;
}

// A light seasonal recap in the spirit of Whering's "Unpacked" (PRD FR#15): most worn, never
// worn, favourite colours, best cost per wear. Only from what was recorded.
function recap(state,{from='',to='9999'}={}){
 const wears=(state.wears||[]).filter(w=>w.date>=from&&w.date<=to);
 const counts=new Map();for(const w of wears)for(const id of w.items)counts.set(id,(counts.get(id)||0)+1);
 const items=state.items.filter(p=>!p.archived);
 const worn=items.filter(p=>counts.get(p.id)).sort((a,b)=>counts.get(b.id)-counts.get(a.id));
 const cpw=items.filter(p=>p.price!=null&&counts.get(p.id)).map(p=>({item:p,cpw:p.price/counts.get(p.id)})).sort((a,b)=>a.cpw-b.cpw);
 return {wears:wears.length,days:new Set(wears.map(w=>w.date)).size,mostWorn:worn.slice(0,3).map(p=>({item:p,wears:counts.get(p.id)})),neverWorn:items.filter(p=>!counts.get(p.id)),
  colours:palette(worn.flatMap(p=>Array(counts.get(p.id)).fill(p)),3),bestValue:cpw[0]||null};
}

// "Complete this look" (PRD FR#13): pieces from the person's own wardrobe that finish an outfit
// around this one, least-worn first so forgotten pieces come back; plus what is missing, for Discover.
function complete(item,state){
 const owned=state.items.filter(p=>p.id!==item.id&&!p.archived&&(p.status||'available')==='available');
 const wears=new Map();for(const w of state.wears||[])for(const id of w.items)wears.set(id,(wears.get(id)||0)+1);
 const need=TOPS.includes(item.category)?[['Trousers'],['Footwear']]:BOTTOMS.includes(item.category)?[TOPS,['Footwear']]:ONE_PIECE.includes(item.category)?[['Footwear'],['Accessories','Jewellery']]:item.category==='Footwear'?[TOPS,BOTTOMS]:[TOPS,BOTTOMS,['Footwear']];
 // Ethnic tops go with ethnic or plain bottoms; skip a second kurta with a kurta.
 const picks=[],missing=[];
 for(const cats of need){
  const pool=owned.filter(p=>cats.includes(p.category)&&!(item.category==='Ethnic wear'&&p.category==='Ethnic wear')).sort((a,b)=>(wears.get(a.id)||0)-(wears.get(b.id)||0));
  if(pool[0])picks.push(pool[0]);else missing.push(cats[0]);
 }
 if(TOPS.includes(item.category)&&!owned.some(p=>p.category==='Belts')&&owned.some(p=>p.category==='Trousers'))missing.push('Belts');
 return {picks,missing};
}

// Same piece from two sources (a Myntra order and its email receipt, or a screenshot)? Names are
// compared by their words; a matching retailer or an order date within a week makes it a match.
const words=s=>new Set(String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!['men','women','with','and','for','the'].includes(w)));
function similar(a,b){
 if(!a||!b)return false;if(a.id&&a.id===b.id)return true;
 if(a.productId&&b.productId&&a.retailer===b.retailer)return String(a.productId)===String(b.productId);
 const x=words(a.name),y=words(b.name);if(!x.size||!y.size)return false;
 let common=0;for(const w of x)if(y.has(w))common++;
 const overlap=common/Math.min(x.size,y.size);
 const near=a.orderedAt&&b.orderedAt?Math.abs(new Date(a.orderedAt)-new Date(b.orderedAt))<=7*864e5:false;
 const sameShop=a.retailer&&b.retailer&&String(a.retailer).toLowerCase()===String(b.retailer).toLowerCase();
 return overlap>=0.75&&(near||sameShop)||overlap===1&&x.size>=3;
}

window.WardrobeInsights={colourOf,palette,balance,gaps,recap,complete,similar,SWATCH};
})();
