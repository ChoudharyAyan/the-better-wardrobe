import test from 'node:test';
import assert from 'node:assert/strict';
import {createLookPhotos,parseLookPhotos} from '../lib/look-photos.mjs';
const html=data=>`<a class="iusc" m='${JSON.stringify(data)}'></a>`;
test('image results reject unsafe links and decode search metadata',()=>{
 assert.deepEqual(parseLookPhotos(html({murl:'javascript:alert(1)',purl:'https://example.org'})),[]);
 assert.deepEqual(parseLookPhotos(html({murl:'https://example.org/a.jpg',purl:'https://example.org/look',t:'Real look'})),[{image:'https://example.org/a.jpg',source:'https://example.org/look',title:'Real look'}]);
});
test('unrelated search results fall back to a labelled real person photo; queries are cached',async()=>{
 let calls=0;const photos=createLookPhotos({fetchImpl:async url=>{calls++;return url.includes('bing.com')?{ok:true,text:async()=>html({murl:'https://example.org/cars.jpg',purl:'https://example.org/cars',t:'Cars'})}:{ok:true,json:async()=>({query:{pages:{1:{index:1,title:'File:Cillian Murphy portrait.jpg',imageinfo:[{thumburl:'https://example.org/murphy.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Murphy.jpg'}]}}}})};}});
 const query='Cillian Murphy · Peaky Blinders newsboy cap';const photo=await photos.search(query);assert.equal(photo.portrait,true);assert.match(photo.image,/murphy/);await photos.search(query);assert.equal(calls,2);
});
test('concurrent requests share lookup and provider failures return no fabricated image',async()=>{
 let calls=0;const photos=createLookPhotos({fetchImpl:async()=>{calls++;throw new Error('offline');}});const [a,b]=await Promise.all([photos.search('Virat Kohli · airport'),photos.search('Virat Kohli · airport')]);assert.deepEqual(a,{image:null,source:null});assert.deepEqual(a,b);assert.equal(calls,2);
});
