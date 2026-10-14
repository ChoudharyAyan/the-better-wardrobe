import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiRequest,geminiBackend} from '../lib/gemini.mjs';

test('Gemini calls go to the Gemini API by default and to Vertex AI when asked',()=>{
 const body={store:false,contents:[{parts:[{text:'hi'}]}],generationConfig:{temperature:0}};
 const dev=geminiRequest({GEMINI_API_KEY:'k'},'gemini-3-flash-preview',body);
 assert.equal(dev.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent');
 assert.deepEqual(JSON.parse(dev.init.body),body,'the Gemini API gets the body as written');
 const v=geminiRequest({GEMINI_API_KEY:'k',GEMINI_BACKEND:'vertex'},'gemini-2.5-flash',body);
 assert.equal(v.url,'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent');
 assert.equal(v.init.headers['x-goog-api-key'],'k');
 const sent=JSON.parse(v.init.body);
 assert.equal('store' in sent,false,'Vertex rejects the store field');
 assert.equal(sent.contents[0].role,'user','Vertex needs a role on every turn');
 assert.deepEqual(sent.generationConfig,{temperature:0});
 assert.equal(geminiBackend({GEMINI_BACKEND:'anything else'}),'developer');
 assert.ok(!geminiRequest({GEMINI_API_KEY:'k',GEMINI_BACKEND:'vertex'},'a/../b',body).url.includes('/../'),'model names are encoded');
});
