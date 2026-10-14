import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createStylePreview} from '../lib/style-preview.mjs';
test('Gemini image adapter sends personal and garment references and validates returned image',async()=>{
 const image=await sharp({create:{width:300,height:450,channels:3,background:'#dddddd'}}).png().toBuffer();let request;
 const provider=createStylePreview({env:{STYLE_PREVIEW_ENABLED:'true',STYLE_PREVIEW_MODEL:'gemini-nano-banana-2.1',GEMINI_API_KEY:'fixture'},fetcher:async(url,options)=>{request=JSON.parse(options.body);assert.ok(!url.includes('fixture'));return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:image.toString('base64')}}]}}]})};}});
 const result=await provider.render({items:[{id:'shirt',name:'Navy shirt',slot:'top'}]},'data:image/png;base64,'+image.toString('base64'),undefined,[{id:'shirt',image:'data:image/png;base64,'+image.toString('base64')}]);
 assert.ok(result.image.startsWith('data:image/jpeg;base64,'));assert.equal(result.referenceCount,1);assert.equal(request.contents[0].parts.filter(p=>p.inlineData).length,2);assert.ok(result.approximate);
});
test('preview rejects invalid image and text-only provider output',async()=>{
 const provider=createStylePreview({env:{STYLE_PREVIEW_ENABLED:'true',STYLE_PREVIEW_MODEL:'gemini-nano-banana-2.1',GEMINI_API_KEY:'fixture'},fetcher:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'no image'}]}}]})})});
 await assert.rejects(provider.render({items:[]},'data:image/png;base64,bm90LWltYWdl'),e=>e.status===400);
 const image=await sharp({create:{width:300,height:450,channels:3,background:'#dddddd'}}).png().toBuffer();
 await assert.rejects(provider.render({items:[]},'data:image/png;base64,'+image.toString('base64')),e=>e.status===502);
});
