import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createQaStore} from '../lib/qa.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXmQAAAAASUVORK5CYII=';

async function tempStore(){
 const dir=pathToFileURL(await mkdtemp(path.join(tmpdir(),'qa-test-'))+'/');
 return {dir,store:createQaStore({dir})};
}

test('a submitted screenshot and note are persisted with an id, and readable back from disk',async()=>{
 const {dir,store}=await tempStore();
 try{
  const {id}=await store.add({image,note:'  The category chips still show before AI runs.  '});
  assert.match(id,/^[a-f0-9]{16}$/);
  const index=JSON.parse(await readFile(new URL('index.json',dir),'utf8'));
  assert.equal(index.length,1);
  assert.equal(index[0].id,id);
  assert.equal(index[0].note,'The category chips still show before AI runs.');
  assert.equal(index[0].status,'open');
  const bytes=await readFile(new URL(index[0].file,dir));
  assert.ok(bytes.length>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a note without a screenshot or with an empty note is rejected',async()=>{
 const {dir,store}=await tempStore();
 try{
  await assert.rejects(()=>store.add({image:'not-an-image',note:'Something'}),/JPG, PNG or WebP/);
  await assert.rejects(()=>store.add({image,note:'   '}),/Add a note/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('history lists newest first, serves images by id only, and keeps edits made directly to index.json',async()=>{
 const {dir,store}=await tempStore();
 try{
  const first=await store.add({image,note:'First'});const second=await store.add({image,note:'Second'});
  const index=JSON.parse(await readFile(new URL('index.json',dir),'utf8'));index[0].status='resolved';index[0].resolution='Fixed cancel propagation';
  await writeFile(new URL('index.json',dir),JSON.stringify(index));
  await store.add({image,note:'Third'});
  const items=await store.list();
  assert.deepEqual(items.map(i=>i.note),['Third','Second','First']);
  assert.equal(items[2].status,'resolved');assert.equal(items[2].resolution,'Fixed cancel propagation');
  assert.equal((await store.image(second.id)).type,'image/png');
  assert.equal(await store.image('../index.json'),null);assert.equal(await store.image('0000000000000000'),null);
  assert.ok(first.id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
