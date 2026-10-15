import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load(){
 const store=new Map(),listeners={},events=[];
 const context={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
  document:{addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},URL,JSON,Date};
 context.window={dispatchEvent:e=>events.push(e)};
 vm.runInNewContext(readFileSync(new URL('../dist/cart.js',import.meta.url),'utf8'),context);
 return {cart:context.window.TBWCart,store,events,listeners};
}

test('the cart keeps pieces from Discover, newest first, with a total of known prices',()=>{
 const {cart,events}=load();
 assert.equal(cart.add({url:'https://www.myntra.com/a',title:'Linen shirt',priceText:'₹1,575',store:'Myntra',source:'ask'}),true);
 cart.add({url:'https://www.ajio.com/b',title:'Chinos',price:1299,store:'AJIO',source:'mall-offer'});
 assert.equal(cart.add({url:'javascript:alert(1)',title:'x'}),false,'only web links are kept');
 cart.add({url:'https://www.myntra.com/a',title:'Linen shirt',priceText:'₹1,575'});
 assert.deepEqual(cart.list().map(i=>i.title),['Linen shirt','Chinos'],'adding again moves it to the top, no duplicate');
 assert.equal(cart.list()[0].price,1575);
 const html=cart.card();assert.match(html,/My cart <em>2<\/em>/);assert.match(html,/₹2,874/);assert.match(html,/AJIO · Offer/);assert.match(html,/Saved on this device/);
 assert.match(cart.button({url:'https://www.ajio.com/b',title:'Chinos'}),/aria-pressed="true"/);
 cart.remove('https://www.ajio.com/b');assert.equal(cart.count(),1);assert.ok(events.length>=3,'every change is announced');
 assert.match(load().cart.card(),/Tap <b>\+ Cart<\/b>/,'an empty cart explains itself');
});
