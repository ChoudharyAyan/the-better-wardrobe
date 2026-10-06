import {randomBytes, createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const empty = () => ({questions: [], answers: [], wallets: {}, votes: {}, ledger: []});
const sha = value => createHash('sha256').update(value).digest('hex');
const words = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const stop = new Set('where can i find this that the for with from like need want have and what are you your some please help item piece link movie show brand india looking similar'.split(' '));
const categories = ['sunglasses','glasses','jacket','coat','bomber','shirt','tshirt','t-shirt','kurta','suit','dress','jeans','trousers','pants','shoes','sneakers','boots','bag','watch','skirt','hoodie','saree','cap'];
const colors = ['black','white','brown','blue','navy','red','pink','green','grey','gray','cream','beige','gold','silver','purple','yellow','orange'];
const details = ['aviator','suede','leather','cotton','linen','denim','cropped','oversized','relaxed','slim','vintage','embroidered','floral','striped','tinted','round','square','long','short','formal','casual'];
function matches(tokens, group) { return group.filter(word => tokens.includes(word)); }
export function screenLead(question, answer) {
  const source = words(`${question.title} ${question.detail} ${question.contextTitle || ''}`);
  const candidate = words(`${answer.text} ${new URL(answer.url || 'https://example.invalid').pathname}`);
  const rubric = [
    ['garment', 30, matches(source,categories)],
    ['colour', 20, matches(source,colors)],
    ['style and material', 25, matches(source,details)],
    ['other details', 25, [...new Set(source.filter(w => w.length > 3 && !stop.has(w) && !categories.includes(w) && !colors.includes(w) && !details.includes(w)))].slice(0,8)]
  ];
  const used = rubric.filter(([, ,terms]) => terms.length);
  const denominator = used.reduce((n,[,weight]) => n+weight,0);
  const breakdown = used.map(([label,weight,terms]) => ({label,matched:terms.filter(term => candidate.includes(term)),checked:terms,points:Math.round(weight*terms.filter(term => candidate.includes(term)).length/terms.length)}));
  const evidence=breakdown.flatMap(row=>row.matched);
  const raw = denominator && evidence.length>=2 ? breakdown.reduce((n,row)=>n+row.points,0)/denominator*100 : 0;
  // Text and URL path overlap is a lead, never visual or stock verification.
  const score = Math.min(85, Math.round(raw));
  return {score, breakdown, method:'Preliminary text match · not visually verified', publish:score>50};
}
function field(value,max,min=0) { const text=String(value||'').trim().replace(/\s+/g,' '); if(text.length<min||text.length>max)throw Object.assign(Error(`Use ${min}–${max} characters.`),{status:400}); return text; }
function url(value) { if(!value)return ''; try {const u=new URL(value); if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))throw Error(); return u.href;} catch {throw Object.assign(Error('Use a full public http or https link.'),{status:400});} }
function fail(message,status=400) {throw Object.assign(Error(message),{status});}
async function image(value) {
 if(!value)return '';
 const match=String(value).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
 if(!match||match[2].length>1_400_000)fail('Use a JPG, PNG or WebP under 1 MB.');
 const input=Buffer.from(match[2],'base64');
 try {const meta=await sharp(input,{limitInputPixels:16_000_000}).metadata();if(!meta.width||!meta.height)throw Error();const result=await sharp(input).rotate().resize({width:720,height:720,fit:'inside',withoutEnlargement:true}).webp({quality:72}).toBuffer();return `data:image/webp;base64,${result.toString('base64')}`;}catch{fail('That image could not be read.');}
}
function cookie(req) {const token=String(req.headers.cookie||'').match(/(?:^|;\s*)tbw_community=([a-f0-9]{48})(?:;|$)/)?.[1];return token||randomBytes(24).toString('hex');}
function publicQuestion(q,viewer,answers,votes={}) {return {...q,image:q.image||'',mine:q.owner===viewer,owner:undefined,answers:answers.filter(a=>a.questionId===q.id&&a.status==='published').map(a=>({id:a.id,author:a.author,text:a.text,url:a.url,image:a.image||'',score:a.score,breakdown:a.breakdown,method:a.method,createdAt:a.createdAt,votes:a.votes||0,myVote:votes[`${viewer}:${a.id}`]||0,mine:a.owner===viewer})),answerCount:answers.filter(a=>a.questionId===q.id&&a.status==='published').length};}
export function createCommunity({env=process.env,file=fileURLToPath(new URL('../.local-data/community.json',import.meta.url))}={}) {
 const connection=env.COMMUNITY_DATABASE_URL||env.POSTGRES_URL||'';
 const local=!env.VERCEL&&!env.NOW_REGION;
 let pool,pending=Promise.resolve();
 async function transact(fn) {
  if(connection){
   if(!pool){const {Pool}=await import('pg');pool=new Pool({connectionString:connection,max:3,connectionTimeoutMillis:4000,ssl:connection.includes('localhost')?false:{rejectUnauthorized:true}});}
   const client=await pool.connect();try{await client.query('BEGIN');await client.query('CREATE TABLE IF NOT EXISTS tbw_community_state (id integer PRIMARY KEY, data jsonb NOT NULL)');await client.query('INSERT INTO tbw_community_state (id,data) VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(empty())]);const row=await client.query('SELECT data FROM tbw_community_state WHERE id=1 FOR UPDATE');const state=row.rows[0].data;const result=await fn(state);await client.query('UPDATE tbw_community_state SET data=$1 WHERE id=1',[JSON.stringify(state)]);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  if(!local)fail('Community needs a database before shared posting can go live.',503);
  const task=pending.then(async()=>{let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=empty();}const result=await fn(state);await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(state));await rename(temp,file);return result;});pending=task.catch(()=>{});return task;
 }
 async function handle(req,pathname,body) {
  const token=cookie(req),viewer=sha(token),newCookie=!String(req.headers.cookie||'').includes(`tbw_community=${token}`);
  const headers=newCookie?{'Set-Cookie':`tbw_community=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${req.socket?.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`}:{ };
  const response=await transact(async state=>{
   const wallet=()=>state.wallets[viewer]||(state.wallets[viewer]={balance:0,earned:0,spent:0});
   const feed=()=>({ready:true,viewer:{name:'You',wallet:wallet(),answered:state.answers.filter(a=>a.owner===viewer&&a.status==='published').length},questions:state.questions.slice().sort((a,b)=>(b.spotlightUntil>Date.now()?1:0)-(a.spotlightUntil>Date.now()?1:0)||Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,100).map(q=>publicQuestion(q,viewer,state.answers,state.votes)),pending:state.answers.filter(a=>a.owner===viewer&&a.status!=='published').map(a=>({id:a.id,questionId:a.questionId,score:a.score,status:a.status}))});
   if(req.method==='GET'&&pathname==='/api/community')return feed();
   if(req.method!=='POST')fail('Not found.',404);
   if(pathname==='/api/community/questions'){
    const title=field(body.title,160,16),detail=field(body.detail,800,20),kind=['Find this','Recommendations','Style advice'].includes(body.kind)?body.kind:'Find this';
    const now=Date.now();if(state.questions.filter(q=>q.owner===viewer&&Date.parse(q.createdAt)>now-3600_000).length>=5)fail('You can ask five questions per hour. Try again later.',429);
    const q={id:randomUUID(),owner:viewer,author:field(body.author||'Guest spotter',28,2),title,detail,kind,contextTitle:field(body.contextTitle,80),referenceUrl:url(body.referenceUrl),image:await image(body.image),createdAt:new Date().toISOString(),spotlightUntil:0};state.questions.push(q);return {question:publicQuestion(q,viewer,state.answers),feed:feed()};
   }
   const answerId=pathname.match(/^\/api\/community\/questions\/([a-f0-9-]{36})\/answers$/)?.[1];
   if(answerId){const q=state.questions.find(q=>q.id===answerId);if(!q)fail('Question not found.',404);if(q.owner===viewer)fail('You cannot answer your own question.',403);if(state.answers.filter(a=>a.owner===viewer&&a.questionId===q.id).length>=3)fail('You have shared three leads here already.',429);
    const text=field(body.text,600,24),link=url(body.url),screen=screenLead(q,{text,url:link});const approved=screen.publish;
    const a={id:randomUUID(),questionId:q.id,owner:viewer,author:field(body.author||'Guest spotter',28,2),text,url:link,image:await image(body.image),score:screen.score,breakdown:screen.breakdown,method:screen.method,status:approved?'published':'needs_detail',createdAt:new Date().toISOString(),votes:0};state.answers.push(a);
    if(approved){wallet().balance+=10;wallet().earned+=10;state.ledger.push({id:randomUUID(),owner:viewer,delta:10,reason:'Published lead',ref:a.id,at:a.createdAt});}
    return {screening:{status:a.status,score:a.score,breakdown:a.breakdown,method:a.method,xp:approved?10:0,message:approved?'Your lead is live. +10 XP. The match is preliminary.':'This lead needs more matching detail before it can appear publicly.'},feed:feed()};
   }
   const voteId=pathname.match(/^\/api\/community\/answers\/([a-f0-9-]{36})\/vote$/)?.[1];
   if(voteId){const a=state.answers.find(a=>a.id===voteId&&a.status==='published');if(!a)fail('Answer not found.',404);if(a.owner===viewer)fail('You cannot vote on your own answer.',403);const choice=Number(body.vote);if(![-1,0,1].includes(choice))fail('Vote must be -1, 0, or 1.');const key=`${viewer}:${a.id}`;const old=state.votes[key]||0;a.votes+=choice-old;if(choice)state.votes[key]=choice;else delete state.votes[key];return {feed:feed(),vote:choice};}
   const boostId=pathname.match(/^\/api\/community\/questions\/([a-f0-9-]{36})\/spotlight$/)?.[1];
   if(boostId){const q=state.questions.find(q=>q.id===boostId&&q.owner===viewer);if(!q)fail('Your question was not found.',404);if(q.spotlightUntil>Date.now())fail('Already in the spotlight.');if(wallet().balance<20)fail('You need 20 XP to spotlight a question.');wallet().balance-=20;wallet().spent+=20;q.spotlightUntil=Date.now()+7*86400_000;state.ledger.push({id:randomUUID(),owner:viewer,delta:-20,reason:'Question spotlight',ref:q.id,at:new Date().toISOString()});return {feed:feed()};}
   fail('Not found.',404);
  });return {data:response,headers};
 }
 return {handle,enabled:connection||local,close:async()=>pool?.end()};
}
