import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/sticker-studio.js',import.meta.url),'utf8');
function studio(){
 const ctx={window:{addEventListener(){}},document:{addEventListener(){},fonts:{ready:{then(){}}}},setInterval(){},setTimeout(){},clearTimeout(){},clearInterval(){}};
 vm.runInNewContext(source,ctx);return {ui:ctx.window.StickerStudio,window:ctx.window};
}
test('Discover sections are independent routes with a single current section',()=>{
 const {ui}=studio();for(const active of ['home','ask','mall','community']){const html=ui.subnav(active);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);for(const hash of ['#discover','#discover/ask','#discover/mall','#discover/community'])assert.ok(html.includes(`href="${hash}"`));}
});
test('welcome uses available account actions and escapes server errors',()=>{
 const {ui}=studio();let html=ui.welcome({google:true,preview:false,busy:false,error:'<script>bad</script>'});assert.ok(html.includes('/api/auth/google'));assert.ok(!html.includes('data-ob="preview"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 html=ui.welcome({google:false,preview:true,busy:true,error:''});assert.match(html,/data-ob="preview" disabled/);assert.ok(!html.includes('/api/auth/google'));
});
test('home escapes profile names and reuses existing saved-chat renderer',()=>{
 const {ui,window}=studio();window.TBWAccount={profile:{name:'<img>'}};window.DiscoverConversation={homeChats:()=>'<nav>Saved search</nav>'};const html=ui.home();assert.match(html,/&lt;img&gt;/);assert.match(html,/<nav>Saved search<\/nav>/);assert.doesNotMatch(html,/<img>/);
});
test('look photo loading never uses an unrelated static placeholder',()=>{
 const {ui}=studio();const html=ui.lookArt({who:'Actor',label:'A gold aviator look'});assert.match(html,/Finding a web photo/);assert.doesNotMatch(html,/assets\/|<img/);
});

test('welcome wordmark reuses the top bar app icon and reads as one word',()=>{
 const {ui,window}=studio();
 let html=ui.welcome({google:false,preview:true,busy:false,error:''});
 assert.match(html,/<span>The Wardrobe<b>OS<\/b><\/span>/);
});

test('Bao\'s friends carry his moving parts, so they blink, follow the pointer and get booped',()=>{
 const {ui}=studio();
 for(const who of ['kitsu','miso','momo']){const html=ui.friend(who,84);
  for(const part of ['class="eye"','class="pupil"','ear ear-l','ear ear-r','eyes-happy','data-studio="boop"'])assert.ok(html.includes(part),who+' '+part);}
 assert.match(ui.guide('Hi',84,'kitsu'),/KITSU SAYS/);assert.match(ui.mallIntro(),/KITSU SAYS/);assert.match(ui.communityIntro(),/MISO SAYS/);assert.match(ui.styleIntro(),/MOMO SAYS/);
 assert.doesNotMatch(ui.friend('miso',56,'span'),/<button|data-studio/,'inside a tile link it is a plain span');
});

test('Mall shoppers dress for their district',()=>{
 const ctx={window:{}};vm.runInNewContext(readFileSync(new URL('../dist/mall-folk.js',import.meta.url),'utf8'),ctx);const F=ctx.window.MallFolk;
 const outfits=html=>[...html.matchAll(/data-outfit="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(outfits(F.district('Ethnic')),['kurta','saree'],'kurta pajama and saree');
 assert.deepEqual(outfits(F.district('Menswear')),['suit','suit']);assert.deepEqual(outfits(F.district('Streetwear')),['hoodie','hoodie']);
 assert.deepEqual(outfits(F.district('Women')),['dress','dress']);assert.deepEqual(outfits(F.lane('Sarees','Ethnic')),['saree','saree']);
 assert.match(F.district('Everyday'),/aria-hidden="true"/);
});
