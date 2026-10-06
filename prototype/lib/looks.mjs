// Trending looks for the Discover starters (design QA #14, 6 Oct 2026): real people and characters, shuffled.
// Each look is researched once and searched from this spec, so a tap never depends on a model remembering
// who wore what. Queries name the garment only, never the person: stores don't index celebrities.
// Sources were checked on 6 Oct 2026 (see `source`).
export const LOOKS=[
 {id:'don-draper-aviators',aliases:/don draper|mad men|jon hamm/i,must:/aviator/i,who:'Don Draper · Mad Men',label:'Don Draper’s gold aviators',department:'menswear',
  attributes:{category:'Sunglasses',subtype:'aviator sunglasses',colour:'gold',fit:'',pattern:'',details:'gold metal frame, grey lenses, bayonet temples',features:'aviator shape, metal frame'},
  query:'gold aviator sunglasses grey lens',source:'Randolph Engineering: Jon Hamm wears Randolph aviators, 23k gold, American Gray lenses'},
 {id:'ananya-filmfare-paithani',aliases:/ananya.*(filmfare|paithani)|(filmfare|paithani).*ananya/i,must:/paithani/i,who:'Ananya Panday · Filmfare Marathi 2026',label:'Ananya Panday’s Filmfare Paithani saree',department:'womenswear',
  attributes:{category:'Saree',subtype:'Paithani silk saree',colour:'royal blue',fit:'',pattern:'woven',details:'silver zari motifs, pink border, floral pallu',features:'pink border, zari'},
  query:'royal blue paithani silk saree pink border',source:'Free Press Journal: royal blue Manish Malhotra Paithani, silver zari, pink border'},
 {id:'virat-airport-cardigan',aliases:/(virat|kohli).*cardigan|cardigan.*(virat|kohli)/i,must:/cardigan/i,who:'Virat Kohli · Mumbai airport',label:'Virat Kohli’s airport cardigan',department:'menswear',
  attributes:{category:'Cardigan',subtype:'knit cardigan',colour:'black',fit:'relaxed',pattern:'',details:'button front, small chest motif',features:'button front'},
  query:'black button cardigan men',source:'Free Press Journal: black AMI Paris cardigan, light-blue jeans, white sneakers'},
 {id:'virat-airport-overshirt',aliases:/(virat|kohli).*(airport|overshirt)|(airport|overshirt).*(virat|kohli)/i,must:/overshirt|shirt jacket|shacket/i,who:'Virat Kohli · airport',label:'Virat Kohli’s blue overshirt airport look',department:'menswear',
  attributes:{category:'Overshirt',subtype:'overshirt',colour:'blue',fit:'relaxed',pattern:'',details:'muted blue, worn open over a white tee',features:''},
  query:'muted blue overshirt men',source:'Airport coverage: white tee layered with a muted blue overshirt, dark trousers'},
 {id:'alia-met-gala-saree',aliases:/alia.*met gala|met gala.*alia/i,must:/saree|sari/i,who:'Alia Bhatt · Met Gala 2024',label:'Alia Bhatt’s mint Met Gala saree',department:'womenswear',
  attributes:{category:'Saree',subtype:'embroidered saree',colour:'mint green',fit:'',pattern:'floral',details:'floral embroidery, beaded fringe',features:'floral embroidery'},
  query:'mint green floral embroidered saree',source:'Harper’s Bazaar Arabia: mint Sabyasachi saree, floral hand embroidery, bead fringe'},
 {id:'srk-met-gala-coat',aliases:/(shah ?rukh|srk).*(met gala|coat)|met gala.*(shah ?rukh|srk)/i,must:/\bcoat|overcoat/i,who:'Shah Rukh Khan · Met Gala 2025',label:'Shah Rukh Khan’s black Met Gala coat',department:'menswear',
  attributes:{category:'Coat',subtype:'long overcoat',colour:'black',fit:'tailored',pattern:'',details:'single-breasted, peak lapels, floor length',features:'peak lapel, long length'},
  query:'black long overcoat men peak lapel',source:'Khaleej Times / Prothom Alo: black floor-length single-breasted Sabyasachi coat, peak lapels'},
 {id:'diljit-coachella-kurta',aliases:/diljit|coachella.*kurta/i,must:/kurta/i,who:'Diljit Dosanjh · Coachella 2023',label:'Diljit Dosanjh’s white Coachella kurta',department:'menswear',
  attributes:{category:'Kurta',subtype:'kurta',colour:'white',fit:'relaxed',pattern:'',details:'traditional Punjabi kurta',features:''},
  query:'white cotton kurta men',source:'The Week / Bollywood Hungama: white kurta, chadra, vest and dastar'},
 {id:'kiara-wedding-lehenga',aliases:/kiara.*(wedding|lehenga|bridal)|(wedding|lehenga|bridal).*kiara/i,must:/lehenga/i,who:'Kiara Advani · her wedding',label:'Kiara Advani’s rose pink wedding lehenga',department:'womenswear',
  attributes:{category:'Lehenga',subtype:'bridal lehenga',colour:'pink',fit:'',pattern:'embroidered',details:'ombre rose pink, crystal embellishment',features:'embellished'},
  query:'pastel pink embellished bridal lehenga',source:'Hello! India: Manish Malhotra lehenga in three shades of Empress Rose, Swarovski crystals'},
 {id:'alia-rocky-rani-chiffon',aliases:/rocky aur rani|rani.*chiffon|alia.*chiffon/i,must:/chiffon/i,who:'Alia Bhatt · Rocky Aur Rani',label:'Alia Bhatt’s Rocky Aur Rani chiffon saree',department:'womenswear',
  attributes:{category:'Saree',subtype:'chiffon saree',colour:'pastel',fit:'',pattern:'ombre',details:'lightweight chiffon, ombre pastels, thin border',features:'chiffon'},
  query:'ombre pastel chiffon saree',source:'Free Press Journal / LBB: Manish Malhotra chiffon sarees, ombre pastels'},
 {id:'ranveer-velvet-tracksuit',aliases:/ranveer.*(velvet|tracksuit|airport)|velvet tracksuit/i,must:/velvet|velour/i,who:'Ranveer Singh · airport',label:'Ranveer Singh’s blue velvet tracksuit',department:'menswear',
  attributes:{category:'Tracksuit',subtype:'velvet tracksuit',colour:'blue',fit:'relaxed',pattern:'',details:'hooded top with matching pants',features:'velvet, hood'},
  query:'velvet tracksuit men',source:'The News: blue velvet tracksuit with a hoodie and white sunglasses'},
 {id:'drive-scorpion-jacket',aliases:/scorpion jacket|(gosling|ryan).*\bdrive\b|\bdrive\b.*(gosling|jacket)/i,must:/scorpion|bomber/i,who:'Ryan Gosling · Drive',label:'Ryan Gosling’s scorpion jacket from Drive',department:'menswear',
  attributes:{category:'Jacket',subtype:'satin bomber jacket',colour:'white',fit:'regular',pattern:'',details:'gold scorpion embroidered on the back',features:'scorpion embroidery'},
  query:'white satin bomber jacket scorpion embroidery',source:'The film’s costume: off-white quilted satin jacket with a gold scorpion'},
 {id:'thomas-shelby-cap',aliases:/thomas shelby|tommy shelby|peaky blinders|shelby.*cap/i,must:/newsboy|flat cap|baker boy|gatsby/i,who:'Thomas Shelby · Peaky Blinders',label:'Thomas Shelby’s newsboy cap',department:'menswear',
  attributes:{category:'Cap',subtype:'newsboy cap',colour:'grey',fit:'',pattern:'herringbone',details:'wool tweed',features:'herringbone tweed'},
  query:'grey herringbone tweed newsboy cap',source:'The series’ costume: herringbone tweed newsboy cap with a wool overcoat'},
 {id:'blade-runner-k-coat',iconic:true,aliases:/blade ?runner|officer k\b/i,must:/shearling|sherpa|fur collar|aviator jacket|b-?3|leather coat|leather jacket/i,who:'Ryan Gosling · Blade Runner 2049',label:'Ryan Gosling’s shearling-collar coat from Blade Runner 2049',department:'menswear',
  note:'In Blade Runner 2049, Ryan Gosling’s signature piece is a dark leather coat with a big shearling collar, not a suit.',
  attributes:{category:'Coat',subtype:'shearling collar leather coat',colour:'',fit:'regular',pattern:'',details:'dark leather, oversized shearling collar, long length',features:'shearling collar, leather'},
  query:'shearling collar leather coat men',source:'Film costume (Renée April): K’s dark leather coat with a shearling collar'},
 {id:'harvey-specter-suit',aliases:/harvey specter|\bsuits\b.*harvey|harvey.*suit/i,must:/3.?piece|three.?piece/i,who:'Harvey Specter · Suits',label:'Harvey Specter’s three-piece suit',department:'menswear',
  attributes:{category:'Suit',subtype:'three-piece suit',colour:'charcoal',fit:'slim',pattern:'',details:'peak lapels, matching waistcoat',features:'peak lapel, waistcoat'},
  query:'charcoal three piece suit men peak lapel',source:'The series’ costume: sharp peak-lapel suits with waistcoats'}
];
export const lookById=id=>LOOKS.find(l=>l.id===id)||null;
// A typed request that names one of these looks ("ryan gosling suit from blade runner") is searched from its spec.
// If the words name a different garment ("Don Draper suit"), the model handles it instead, except for looks
// marked `iconic`, whose one famous piece people often misname (K's coat in Blade Runner is not a suit).
const GARMENTS=/\b(suit|blazer|shirt|t-?shirt|tee|jacket|coat|overcoat|cardigan|sweater|hoodie|kurta|saree|sari|lehenga|dress|gown|trousers|pants|jeans|shoes|sneakers|sunglasses|glasses|cap|hat|tracksuit|overshirt|watch|bag)s?\b/gi;
export const matchLook=text=>{
 const t=String(text||'');if(!t)return null;
 const look=LOOKS.find(l=>l.aliases?.test(t));if(!look||look.iconic)return look||null;
 const named=[...t.matchAll(GARMENTS)].map(m=>m[1].toLowerCase().replace(/-/g,''));
 const piece=(look.attributes.category+' '+look.attributes.subtype+' '+look.label).toLowerCase().replace(/-/g,'');
 return named.every(g=>piece.includes(g))?look:null;
};
// `must`: a word the product title should carry for this look (a cardigan, not a pullover). Results that lack it
// are dropped when at least three remain, otherwise ranked last.
// What the phone needs to show a starter; the search spec stays on the server.
export const lookCards=()=>LOOKS.map(({id,who,label,department})=>({id,who,label,department}));
