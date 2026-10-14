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
