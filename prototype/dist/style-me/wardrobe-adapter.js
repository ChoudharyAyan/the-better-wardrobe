/** Read projection of My Wardrobe phase 2 records. No ingestion or inventory mutations. */
const categories = {Shirts:'top',Trousers:'bottom',Footwear:'shoes',Dresses:'onePiece',Suits:'onePiece',Outerwear:'outerwear',Accessories:'accessory',Belts:'accessory',Jewellery:'accessory'};
const fingerprint = value => {
  let hash=2166136261;
  for(const c of JSON.stringify(value)) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return 'projection-'+(hash>>>0).toString(16);
};
export function wardrobeRecords(input, {canonical=false}={}) {
  if(!Array.isArray(input)) throw new Error('Wardrobe adapter must return an array of records.');
  const seen=new Set();
  return input.filter(i=>i && i.source!=='Sample wardrobe' && !i.archived && !i.deleted && i.owned!==false).flatMap(i=>{
    const id=String(i.id||'');
    if(!/^[A-Za-z0-9:._-]{1,100}$/.test(id)||seen.has(id)||!i.name)return [];
    seen.add(id);
    let slot=i.slot||categories[i.category];
    if(i.category==='Ethnic wear'){
      const type=String(i.type||i.name).toLowerCase();
      slot=/saree|sari|lehenga|suit|set/.test(type)?'onePiece':/kurta|blouse|choli/.test(type)?'top':/salwar|churidar|palazzo|dhoti/.test(type)?'bottom':null;
    }
    if(!slot) return []; // Unknown categories need My Wardrobe correction, not silent accessory classification.
    const revision=String(i.revision||i.itemRevision||fingerprint({name:i.name,category:i.category,type:i.type,colour:i.colour,status:i.status,archived:i.archived,imageVersion:i.imageVersion,material:i.material,image:i.image}));
    return [{id,name:String(i.name).slice(0,150),slot,colour:i.colour||'',material:i.material||'',coverage:i.coverage||'',tags:Array.isArray(i.tags)?i.tags:[],
      source:canonical?'wardrobe':'described',ownership:canonical?'confirmed':'user-described',...(canonical?{itemRevision:revision}:{}),
      available:i.available!==false&&(!i.status||i.status==='available'),assetVersion:String(i.imageVersion||revision),image:i.image||''}];
  });
}
