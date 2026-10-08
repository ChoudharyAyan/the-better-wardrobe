import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key.toLowerCase(),h.value]));
const csp=Object.fromEntries(headers['content-security-policy'].split(';').map(d=>d.trim().split(/\s+/)).map(([k,...v])=>[k,v]));

test('every response carries the production security headers',()=>{
 assert.match(headers['strict-transport-security'],/max-age=\d{8,}; includeSubDomains/);
 assert.equal(headers['x-content-type-options'],'nosniff');
 assert.equal(headers['x-frame-options'],'DENY');
 assert.equal(headers['referrer-policy'],'no-referrer');
 // Google sign-in opens a popup that must be able to message back.
 assert.equal(headers['cross-origin-opener-policy'],'same-origin-allow-popups');
 // Voice search needs the microphone; nothing needs location or payments.
 assert.match(headers['permissions-policy'],/microphone=\(self\)/);
 assert.match(headers['permissions-policy'],/geolocation=\(\)/);
});

test('the content security policy blocks injected scripts and framing',()=>{
 assert.deepEqual(csp['script-src'],['\'self\'','https://accounts.google.com/gsi/client']);
 assert.ok(!headers['content-security-policy'].includes('unsafe-eval'));
 assert.deepEqual(csp['object-src'],['\'none\'']);
 assert.deepEqual(csp['frame-ancestors'],['\'none\'']);
 assert.deepEqual(csp['base-uri'],['\'self\'']);
 assert.ok(csp['form-action'].every(s=>s==='\'self\''||s==='https://accounts.google.com'));
});
