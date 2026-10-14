// My Wardrobe intake helpers (PRD FR#4, FR#8, FR#9, FR#16). Pure functions, no DOM, so the
// rules that decide what reaches the review queue can be tested on their own.
(()=>{
// Runs tasks with at most `limit` in flight and reports each result as it lands. Photos are read
// in parallel (Vastra read them one at a time: ~85 s for three).
async function pool(items,limit,worker,onResult=()=>{}){
 let next=0;const results=new Array(items.length);
 const lane=async()=>{while(next<items.length){const i=next++;try{results[i]={ok:true,value:await worker(items[i],i)};}catch(error){results[i]={ok:false,error};}onResult(results[i],i);}};
 await Promise.all(Array.from({length:Math.min(limit,items.length)},lane));
 return results;
}

// What is kept out of the review queue by default, and why (PRD FR#4). Hidden pieces stay one tap
// away ("Show 12 hidden"); nothing is dropped silently. Non-clothing never gets this far: the
// classifier already returns null for it.
const KIDS=/\b(boys?|girls?|kids?|infants?|baby|toddlers?)\b/i;
function screen(item,profile){
 const gender=String(item.gender||'');
 if(item.innerwear||/innerwear/i.test(item.warning||''))return 'Innerwear';
 if(KIDS.test(gender))return "Kids' sizes";
 if(profile?.gender==='male'&&/\bwomen\b/i.test(gender))return 'Looks like a gift';
 if(profile?.gender==='female'&&/^men$/i.test(gender.trim()))return 'Looks like a gift';
 return '';
}

// Levels follow the design system's gamification model (02-app-shell §5).
const LEVELS=[[100,5,'Tastemaker'],[60,4,'Archivist'],[30,3,'Curator'],[15,2,'Stylist'],[5,1,'Collector'],[0,1,'Collector']];
const day=d=>new Date(d+'T00:00:00Z').getTime()/864e5;
function progress(state,today=new Date().toISOString().slice(0,10)){
 const pieces=state.items.length,wears=state.wears||[];
 const details=state.items.filter(p=>p.brand||p.price!=null).length;
 const xp=pieces*10+wears.length*15+details*5;
 const [,number,title]=LEVELS.find(([n])=>pieces>=n);
 const nextAt=[5,15,30,60,100].find(n=>pieces<n)||null;
 // Streak: consecutive days with a logged wear, ending today or yesterday.
 const days=new Set(wears.map(w=>w.date));let streak=0;
 let cursor=day(today);if(!days.has(today))cursor-=1;
 while(days.has(new Date(cursor*864e5).toISOString().slice(0,10))){streak++;cursor--;}
 return {xp,number,title,nextAt,streak,pieces};
}
function notWornSince(state,days=60,today=new Date().toISOString().slice(0,10)){
 const last=new Map();for(const w of state.wears||[])for(const id of w.items)if(!last.has(id)||last.get(id)<w.date)last.set(id,w.date);
 return state.items.filter(p=>{const l=last.get(p.id)||p.purchased||p.addedAt?.slice(0,10)||'';return !l||day(today)-day(l)>=days;}).length;
}

// "Add your basics" (PRD FR#8): common Indian and western staples added in one tap, with a
// flat drawing in the piece's colour so nothing pretends to be a photo of the user's own item.
const SHAPES={
 tee:'M34 22 48 14q12 9 24 0l14 8 16 22-15 8-3-4v62H36V48l-3 4-15-8Z',
 shirt:'M34 22 48 14l12 10 12-10 14 8 16 22-15 8-3-4v62H36V48l-3 4-15-8Zm26 2v84',
 kurta:'M36 20 50 13l10 9 10-9 14 7 12 30-12 4-2-6v68H76l-4-12h-24l-4 12H38V48l-2 6-12-4Zm24 2v40',
 hoodie:'M38 22q4-12 22-12t22 12l10 8 10 70-14 2-6-52v58H38V50l-6 52-14-2 10-70Z',
 jacket:'M36 20 50 14l10 14 10-14 14 6 12 82-14 2-4-50v54H42V54l-4 50-14-2 12-82Zm24 8v76',
 jeans:'M38 12h44l6 98H66l-6-62-6 62H32Z',
 shorts:'M36 30h48l6 50H66l-6-26-6 26H30Z',
 dress:'M46 12h28l-2 20 22 76H26l22-76Z',
 saree:'M44 12h24l20 96H28Zm24 0 24 30',
 sneaker:'M18 74q2-16 14-18l20-4 10 8h10l30 14q8 6 2 14H20q-4-4-2-14Z',
 formal:'M16 78q4-14 20-14l26-6 30 10q12 4 10 16H18Z',
 sandal:'M28 84q-2-14 14-20l40-4q18 2 16 20Zm20-22 6-10m14 10 4-12',
 belt:'M10 52h100v16H10Zm70-4h18v24H80Z',
 cap:'M24 70q2-34 36-34t36 34Zm72 0h20v6H24'
};
const BASICS=[
 ['White T-shirt','Shirts','tee','#F4F1EA'],['Black T-shirt','Shirts','tee','#26232A'],['White shirt','Shirts','shirt','#FAF8F3'],['Light blue shirt','Shirts','shirt','#B9CFE6'],
 ['Blue jeans','Trousers','jeans','#4A6A92'],['Black jeans','Trousers','jeans','#2F2E33'],['Beige chinos','Trousers','jeans','#D8C3A0'],['Black trousers','Trousers','jeans','#2A2830'],['Shorts','Trousers','shorts','#7C8A6E'],
 ['White kurta','Ethnic wear','kurta','#F6F2E8'],['Black kurta','Ethnic wear','kurta','#2B2630'],['Maroon kurta','Ethnic wear','kurta','#7E1F3A'],['Saree','Ethnic wear','saree','#B23A5A'],
 ['Grey hoodie','Outerwear','hoodie','#9C9AA2'],['Denim jacket','Outerwear','jacket','#5E7FA6'],['Black dress','Dresses','dress','#2A2630'],
 ['White sneakers','Footwear','sneaker','#F3F1EC'],['Black formal shoes','Footwear','formal','#2A2524'],['Kolhapuri chappals','Footwear','sandal','#A06A3B'],
 ['Brown belt','Belts','belt','#7A4F2E'],['Black cap','Accessories','cap','#2B2A2F']
].map(([name,category,shape,colour])=>({id:'basic-'+name.toLowerCase().replace(/[^a-z]+/g,'-'),name,category,shape,colour}));
function basicImage(shape,colour){
 const light=parseInt(colour.slice(1),16)>0xd0d0d0;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="${SHAPES[shape]||SHAPES.tee}" fill="${colour}" stroke="${light?'#B9A991':'rgba(255,255,255,.35)'}" stroke-width="2" stroke-linejoin="round"/></svg>`;
 return 'data:image/svg+xml,'+encodeURIComponent(svg);
}

window.WardrobeIntake={pool,screen,progress,notWornSince,BASICS,basicImage};
})();
