// The frozen Discover taxonomy. Every model is prompted with these enums and every score is computed
// against them, so changing a value here changes what "correct" means: bump TAXONOMY_VERSION when you do.
export const TAXONOMY_VERSION='2026-10-01';

export const CATEGORY_GROUPS={
 topwear:['shirt','t-shirt','polo','top','blouse','crop top','sweater','sweatshirt','hoodie'],
 outerwear:['jacket','blazer','coat','waistcoat'],
 ethnic:['kurta','kurti','tunic','saree','lehenga','salwar suit','sherwani','dupatta'],
 onepiece:['dress','jumpsuit','co-ord set'],
 bottomwear:['jeans','trousers','chinos','shorts','skirt','leggings','palazzo','dhoti pants'],
 footwear:['sneakers','loafers','formal shoes','heels','sandals','flats','juttis','kolhapuris','boots'],
 accessories:['bag','belt','watch','sunglasses','hat','jewellery','tie','scarf'],
 other:['other']
};
export const CATEGORIES=Object.values(CATEGORY_GROUPS).flat();
export const groupOf=c=>Object.entries(CATEGORY_GROUPS).find(([,v])=>v.includes(c))?.[0]||'other';

// Free-form words models (and labellers) use, mapped onto the enums above.
const CATEGORY_SYNONYMS={
 tee:'t-shirt',tshirt:'t-shirt','t shirt':'t-shirt','polo shirt':'polo',pants:'trousers',trouser:'trousers',slacks:'trousers','formal trousers':'trousers',denim:'jeans','denim jeans':'jeans',chino:'chinos',
 'suit jacket':'blazer','sport coat':'blazer',gilet:'waistcoat',vest:'waistcoat',nehru:'waistcoat','nehru jacket':'waistcoat',bandhgala:'blazer',overcoat:'coat',trench:'coat','trench coat':'coat',
 cardigan:'sweater',pullover:'sweater',jumper:'sweater',hoodie:'hoodie',tunic:'tunic',anarkali:'kurta','kurta set':'kurta','kurta pyjama':'kurta',kurtis:'kurti',sari:'saree','lehenga choli':'lehenga',ghagra:'lehenga',
 'salwar kameez':'salwar suit','churidar suit':'salwar suit',achkan:'sherwani',stole:'dupatta',gown:'dress',sundress:'dress','maxi dress':'dress','mini dress':'dress',romper:'jumpsuit',playsuit:'jumpsuit','co ord':'co-ord set','coord set':'co-ord set',
 trainers:'sneakers',sneaker:'sneakers','running shoes':'sneakers','sports shoes':'sneakers',loafer:'loafers',moccasins:'loafers','penny loafers':'loafers',oxfords:'formal shoes',derby:'formal shoes',brogues:'formal shoes','dress shoes':'formal shoes',
 stilettos:'heels',pumps:'heels','block heels':'heels','heeled sandals':'heels',wedges:'heels',slides:'sandals',flipflops:'sandals','flip flops':'sandals',ballerinas:'flats','ballet flats':'flats',mojari:'juttis',mojaris:'juttis',jutti:'juttis',kolhapuri:'kolhapuris',
 handbag:'bag',tote:'bag',clutch:'bag',backpack:'bag',purse:'bag','sling bag':'bag','straw bag':'bag',sunglass:'sunglasses',shades:'sunglasses',eyewear:'sunglasses',cap:'hat',fedora:'hat','sun hat':'hat',beanie:'hat',
 necklace:'jewellery',earrings:'jewellery',bracelet:'jewellery',ring:'jewellery',bangles:'jewellery',jewelry:'jewellery',necktie:'tie','bow tie':'tie',muffler:'scarf',shawl:'scarf',crop:'crop top'
};
export function canonicalCategory(v){const t=String(v??'').toLowerCase().trim().replace(/[_]+/g,' ').replace(/\s+/g,' ');if(!t)return '';if(CATEGORIES.includes(t))return t;if(CATEGORY_SYNONYMS[t])return CATEGORY_SYNONYMS[t];const singular=t.replace(/s$/,'');if(CATEGORIES.includes(singular))return singular;if(CATEGORY_SYNONYMS[singular])return CATEGORY_SYNONYMS[singular];const word=Object.keys(CATEGORY_SYNONYMS).sort((a,b)=>b.length-a.length).find(k=>new RegExp(`\\b${k}\\b`).test(t));if(word)return CATEGORY_SYNONYMS[word];const direct=[...CATEGORIES].sort((a,b)=>b.length-a.length).find(c=>new RegExp(`\\b${c.replace('-','.?')}s?\\b`).test(t));return direct||'other';}
// 1 for the same category, 0.5 for a sibling in the same group (loafers vs formal shoes), else 0.
export function categoryCredit(gold,pred){const g=canonicalCategory(gold),p=canonicalCategory(pred);if(!g||!p)return 0;if(g===p)return 1;return groupOf(g)===groupOf(p)&&g!=='other'?0.5:0;}

export const DEPARTMENTS=['menswear','womenswear','unisex','unknown'];
export const COLOURS=['white','cream','beige','brown','black','grey','silver','navy','blue','teal','green','olive','yellow','gold','orange','red','maroon','pink','purple','multicolour','unknown'];
const COLOUR_SYNONYMS={'off-white':'cream','off white':'cream',ivory:'cream',ecru:'cream',tan:'beige',khaki:'beige',camel:'beige',nude:'beige',sand:'beige',chocolate:'brown',coffee:'brown',cognac:'brown',rust:'orange',charcoal:'grey',gray:'grey',ash:'grey',
 'navy blue':'navy',indigo:'navy','denim blue':'blue','light blue':'blue','sky blue':'blue','royal blue':'blue',turquoise:'teal',aqua:'teal',mint:'green','bottle green':'green','emerald':'green','sage':'olive',mustard:'yellow',lemon:'yellow',golden:'gold',peach:'orange',coral:'orange',
 burgundy:'maroon',wine:'maroon',crimson:'red',scarlet:'red',magenta:'pink','hot pink':'pink',blush:'pink',rose:'pink',lavender:'purple',lilac:'purple',violet:'purple',mauve:'purple','multi':'multicolour',multicolor:'multicolour','multi-colour':'multicolour'};
// Pairs that a careful human would call "close": half credit instead of zero.
const COLOUR_NEIGHBOURS=[['white','cream'],['cream','beige'],['beige','brown'],['black','grey'],['grey','silver'],['navy','blue'],['navy','black'],['blue','teal'],['teal','green'],['green','olive'],['olive','brown'],['yellow','gold'],['gold','beige'],['orange','red'],['red','maroon'],['red','pink'],['pink','purple'],['maroon','purple'],['maroon','brown']];
export function canonicalColour(v){const t=String(v??'').toLowerCase().trim();if(!t)return '';if(COLOURS.includes(t))return t;if(COLOUR_SYNONYMS[t])return COLOUR_SYNONYMS[t];const hit=Object.keys(COLOUR_SYNONYMS).sort((a,b)=>b.length-a.length).find(k=>t.includes(k));if(hit)return COLOUR_SYNONYMS[hit];return COLOURS.find(c=>t.includes(c))||'unknown';}
export function colourCredit(gold,pred){const g=canonicalColour(gold),p=canonicalColour(pred);if(!g||!p)return 0;if(g===p)return 1;return COLOUR_NEIGHBOURS.some(([a,b])=>(a===g&&b===p)||(a===p&&b===g))?0.5:0;}

export const PATTERNS=['solid','striped','checked','floral','printed','embroidered','polka dot','geometric','animal print','textured','colour block','unknown'];
export const SLEEVES=['sleeveless','short','three-quarter','long','not applicable','unknown'];
export const FITS=['slim','regular','relaxed','oversized','flared','not applicable','unknown'];
export const LENGTHS=['cropped','regular','knee','midi','maxi','ankle','full','not applicable','unknown'];
export const NECKLINES=['crew','v-neck','shirt collar','camp collar','mandarin collar','polo collar','off-shoulder','sweetheart','halter','square','boat','hooded','lapel','not applicable','unknown'];
export const FABRICS=['cotton','linen','denim','silk','satin','wool','leather','suede','polyester','chiffon','georgette','knit','velvet','straw','metal','plastic','unknown'];
export const OCCASIONS=['casual','work','formal','party','festive','wedding','sports','vacation','unknown'];
export const SCENES=['product shot','flat lay','on person','social screenshot','store screenshot','other'];
export const LANGUAGES=['english','hinglish','hindi','other'];

const SIMPLE_SYNONYMS={
 pattern:{plain:'solid','self design':'textured',stripes:'striped',stripe:'striped',checks:'checked',checkered:'checked',plaid:'checked',tartan:'checked',flower:'floral',print:'printed',graphic:'printed',dots:'polka dot','polka dots':'polka dot',leopard:'animal print',zebra:'animal print',chikankari:'embroidered',embellished:'embroidered',sequinned:'embroidered',woven:'textured',ribbed:'textured'},
 sleeve:{'half sleeve':'short','half':'short','full sleeve':'long','full':'long','3/4':'three-quarter',none:'sleeveless',cap:'short','n/a':'not applicable'},
 fit:{skinny:'slim',fitted:'slim',straight:'regular',loose:'relaxed',baggy:'oversized',wide:'relaxed','wide leg':'relaxed','a-line':'flared','n/a':'not applicable'},
 length:{crop:'cropped',mini:'regular','above knee':'regular','knee length':'knee','floor length':'maxi',long:'maxi','full length':'full','n/a':'not applicable'},
 neckline:{round:'crew','round neck':'crew','crew neck':'crew',vneck:'v-neck',collared:'shirt collar','spread collar':'shirt collar','cuban collar':'camp collar','resort collar':'camp collar','revere collar':'camp collar',band:'mandarin collar','band collar':'mandarin collar',chinese:'mandarin collar',bardot:'off-shoulder',hood:'hooded',notch:'lapel','notch lapel':'lapel','n/a':'not applicable'},
 fabric:{canvas:'cotton',chambray:'denim',rayon:'polyester',viscose:'polyester',nylon:'polyester',crepe:'georgette',wool:'wool',woollen:'wool',tweed:'wool',jersey:'knit',knitted:'knit',patent:'leather','faux leather':'leather',rattan:'straw',wicker:'straw',jute:'straw',acetate:'plastic'},
 occasion:{everyday:'casual',daily:'casual',office:'work',business:'work','business casual':'work',evening:'party',club:'party','festive wear':'festive',diwali:'festive',haldi:'festive',mehendi:'festive',sangeet:'festive',shaadi:'wedding',gym:'sports',athleisure:'sports',beach:'vacation',resort:'vacation',travel:'vacation'},
 department:{men:'menswear',mens:'menswear',male:'menswear',women:'womenswear',womens:'womenswear',female:'womenswear',ladies:'womenswear'}
};
const ENUMS={department:DEPARTMENTS,pattern:PATTERNS,sleeve:SLEEVES,fit:FITS,length:LENGTHS,neckline:NECKLINES,fabric:FABRICS,occasion:OCCASIONS,scene:SCENES,language:LANGUAGES};
export function canonicalEnum(field,v){const list=ENUMS[field];const t=String(v??'').toLowerCase().trim().replace(/[’']/g,'');if(!t)return '';if(list.includes(t))return t;const syn=SIMPLE_SYNONYMS[field]||{};if(syn[t])return syn[t];const key=Object.keys(syn).sort((a,b)=>b.length-a.length).find(k=>t.includes(k));if(key)return syn[key];return list.find(x=>t.includes(x))||'unknown';}

// Gold values that mean "do not score this field".
export const isUnscored=v=>v===undefined||v===null||v===''||v==='unknown'||(Array.isArray(v)&&!v.length);
