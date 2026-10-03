import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {TIERS} from './models.mjs';

const C={bg:'#fbf5ec',panel:'#ffffff',text:'#2b1620',muted:'#5c4750',line:'#e3d2bc',rose:'#8e1b4d',success:'#327655',warn:'#96591b'};
const TIER_COLOURS={local:'#7a8b8c','very-cheap':'#327655',cheap:'#5f8f3e',mid:'#b98a2e','mid-high':'#c06a2b',expensive:'#a33c4f','very-expensive':'#6a1d48'};
const FONT="Montserrat, 'DejaVu Sans', Arial, sans-serif";
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pct=(v,d=1)=>v===null||v===undefined||Number.isNaN(v)?'—':(v*100).toFixed(d)+'%';
export const usd=v=>v===null||v===undefined?'—':v===0?'$0':v<0.01?'$'+v.toFixed(4):v<10?'$'+v.toFixed(2):'$'+v.toFixed(0);
const ms=v=>v===null||v===undefined?'—':v<1000?Math.round(v)+' ms':(v/1000).toFixed(1)+' s';
const tierLabel=id=>TIERS.find(t=>t.id===id)?.label||id;
const rowsFor=(s,task)=>s.rows.filter(r=>r.task===task).sort((a,b)=>(b.score??0)-(a.score??0));
const ci=r=>r.scoreSe?` ±${(1.96*r.scoreSe*100).toFixed(1)}`:'';

// Points nobody beats on both score and cost.
export function frontier(rows){const priced=rows.filter(r=>typeof r.costPer1k==='number').sort((a,b)=>a.costPer1k-b.costPer1k||b.score-a.score);const out=[];let best=-1;for(const r of priced)if(r.score>best){out.push(r);best=r.score;}return out;}

export function findings(summary){
 const look=rowsFor(summary,'look'),query=rowsFor(summary,'query'),out=[];
 const head=look.length?look:query;if(!head.length)return out;const task=look.length?'screenshot':'keyword';
 const best=head[0];out.push(`Best ${task} accuracy: ${best.label} at ${pct(best.score)}${ci(best)} (${usd(best.costPer1k)} per 1,000 calls).`);
 const good=[...head].filter(r=>typeof r.costPer1k==='number'&&r.score>=best.score-0.03).sort((a,b)=>a.costPer1k-b.costPer1k)[0];
 if(good&&good.modelId!==best.modelId)out.push(`Good-enough pick: ${good.label} lands within 3 points of the best (${pct(good.score)}) at ${usd(good.costPer1k)} per 1,000 calls, ${best.costPer1k&&good.costPer1k?Math.round(best.costPer1k/good.costPer1k)+'× cheaper':'far cheaper'}.`);
 let inv=null;for(const a of head)for(const b of head)if(a.costPer1k&&b.costPer1k&&a.costPer1k>=3*b.costPer1k&&a.score<b.score&&(!inv||a.costPer1k/b.costPer1k>inv.ratio))inv={a,b,ratio:a.costPer1k/b.costPer1k};
 if(inv)out.push(`Price is not quality: ${inv.a.label} costs ${Math.round(inv.ratio)}× more than ${inv.b.label} and scores lower (${pct(inv.a.score)} vs ${pct(inv.b.score)}).`);
 const open=head.find(r=>r.openWeights);if(open)out.push(`Best open-weights model: ${open.label} at ${pct(open.score)}, ${usd(open.costPer1k)} per 1,000 calls.`);
 const flaky=head.filter(r=>r.okRate<0.97).sort((a,b)=>a.okRate-b.okRate)[0];if(flaky)out.push(`Reliability matters: ${flaky.label} failed ${pct(1-flaky.okRate,0)} of calls (${Object.entries(flaky.errors).map(([k,v])=>`${v} ${k.replace('_',' ')}`).join(', ')}); failures score zero.`);
 if(look.length){const fields={};for(const r of look)for(const [f,v] of Object.entries(r.fields||{}))if(v!==null)(fields[f]||=[]).push(v);const ranked=Object.entries(fields).map(([f,v])=>[f,v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>a[1]-b[1]);if(ranked.length>2)out.push(`Hardest attributes across all models: ${ranked.slice(0,3).map(([f,v])=>`${f.replace('_',' ')} (${pct(v,0)})`).join(', ')}. Easiest: ${ranked.at(-1)[0].replace('_',' ')} (${pct(ranked.at(-1)[1],0)}).`);
  const rec=[...look].filter(r=>r.recall!==null).sort((a,b)=>b.recall-a.recall)[0];if(rec)out.push(`Finding every item in a busy image is its own skill: best item recall was ${rec.label} at ${pct(rec.recall)}.`);}
 if(query.length&&look.length){const q=query[0];const cheap=[...query].filter(r=>typeof r.costPer1k==='number'&&r.score>=q.score-0.03).sort((a,b)=>a.costPer1k-b.costPer1k)[0]||q;
  out.push(q.score>=0.9?`Keyword parsing is the easy part: ${cheap.label} gets ${pct(cheap.score)} of query filters right at ${usd(cheap.costPer1k)} per 1,000 queries.`:`Keyword parsing is not solved yet: the best model, ${q.label}, gets ${pct(q.score)} of query filters right.`);}
 return out;
}

function svgWrap(w,h,body,title){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}"><rect width="${w}" height="${h}" fill="${C.bg}"/><text x="40" y="52" font-size="26" font-weight="700" fill="${C.text}">${esc(title)}</text>${body}</svg>`;}
function watermark(w,h,summary){return summary.mock?`<text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="64" font-weight="800" fill="${C.rose}" opacity="0.16" transform="rotate(-18 ${w/2} ${h/2})">SIMULATED DATA</text>`:'';}

export function frontierChart(summary,task='look'){
 const rows=rowsFor(summary,task).filter(r=>r.score!==null);const W=1200,H=720,L=110,R=300,T=110,B=90,pw=W-L-R,ph=H-T-B;
 const costs=rows.map(r=>r.costPer1k).filter(v=>v>0);const lo=Math.log10(Math.max(0.01,Math.min(...costs,1)/2)),hi=Math.log10(Math.max(...costs,1)*2);
 const x=c=>L+(c>0?(Math.log10(c)-lo)/(hi-lo):0)*pw;const ys=[...rows.map(r=>r.score),...(task==='look'?(summary.scale?.options||[]).filter(o=>o.kind==='cascade').map(o=>o.score):[])];const ymin=Math.max(0,Math.floor((Math.min(...ys,0.5)-0.05)*10)/10),ymax=1;const y=v=>T+(1-(v-ymin)/(ymax-ymin))*ph;
 let g='';for(let e=Math.ceil(lo);e<=Math.floor(hi);e++){const xv=x(10**e);g+=`<line x1="${xv}" y1="${T}" x2="${xv}" y2="${T+ph}" stroke="${C.line}"/><text x="${xv}" y="${T+ph+28}" text-anchor="middle" font-size="15" fill="${C.muted}">${usd(10**e)}</text>`;}
 for(let v=ymin;v<=1.0001;v+=0.1){g+=`<line x1="${L}" y1="${y(v)}" x2="${L+pw}" y2="${y(v)}" stroke="${C.line}"/><text x="${L-12}" y="${y(v)+5}" text-anchor="end" font-size="15" fill="${C.muted}">${Math.round(v*100)}%</text>`;}
 const casc=task==='look'?(summary.scale?.options||[]).filter(o=>o.kind==='cascade'):[];
 const f=task==='look'&&summary.scale?(summary.scale.options.filter(o=>summary.scale.frontier.includes(o.id)).sort((a,b)=>a.costPer1k-b.costPer1k)):frontier(rows);if(f.length>1)g+=`<polyline points="${f.map(r=>`${x(r.costPer1k)},${y(r.score)}`).join(' ')}" fill="none" stroke="${C.rose}" stroke-width="2.5" stroke-dasharray="7 6"/>`;
 casc.forEach((c,i)=>{const px=x(c.costPer1k),py=y(c.score);g+=`<rect x="${px-8}" y="${py-8}" width="16" height="16" transform="rotate(45 ${px} ${py})" fill="${C.bg}" stroke="${C.rose}" stroke-width="3"/><text x="${px+14}" y="${py-12}" font-size="14" fill="${C.rose}">C${i+1}</text>`;});
 const placed=[];for(const r of [...rows].sort((a,b)=>b.score-a.score)){if(typeof r.costPer1k!=='number')continue;const px=x(r.costPer1k),py=y(r.score);let ly=py+5;while(placed.some(p=>Math.abs(p.x-px)<170&&Math.abs(p.y-ly)<18))ly+=18;placed.push({x:px,y:ly});
  g+=`<circle cx="${px}" cy="${py}" r="9" fill="${TIER_COLOURS[r.tier]||C.rose}" stroke="${C.panel}" stroke-width="2"/><text x="${px+14}" y="${ly}" font-size="15" fill="${C.text}">${esc(r.label)}</text>`;}
 const lg=TIERS.filter(t=>rows.some(r=>r.tier===t.id)).map((t,i)=>`<circle cx="${W-R+50}" cy="${T+20+i*30}" r="8" fill="${TIER_COLOURS[t.id]}"/><text x="${W-R+66}" y="${T+26+i*30}" font-size="16" fill="${C.text}">${esc(t.label)}</text>`).join('');
 const sub=`<text x="40" y="82" font-size="16" fill="${C.muted}">${task==='look'?'Screenshot task score':'Keyword task score'} vs cost per 1,000 calls (log scale). Dashed line: options nobody beats on both. Diamonds: cheap-then-strong cascades.</text>`;
 const axes=`<text x="${L+pw/2}" y="${H-24}" text-anchor="middle" font-size="16" fill="${C.muted}">Cost per 1,000 calls (USD, log scale)</text>`;
 return svgWrap(W,H,sub+g+lg+axes+watermark(W,H,summary),task==='look'?'Accuracy vs cost: screenshot understanding':'Accuracy vs cost: keyword understanding');
}
export function heatmap(summary,task,kind='fields'){
 const rows=rowsFor(summary,task);const cols=[...new Set(rows.flatMap(r=>Object.keys(kind==='fields'?r.fields||{}:r.slices||{})))].filter(c=>kind!=='slices'||c!=='sample');
 if(!rows.length||!cols.length)return null;const cw=Math.max(78,Math.min(110,900/cols.length)),rh=34,L=260,T=215,W=L+cols.length*cw+140,H=T+rows.length*rh+40;
 const colour=v=>v===null||v===undefined?C.neutral||'#f3eae0':`hsl(${Math.round(v*130)},45%,${88-v*38}%)`;
 let g=cols.map((c,i)=>`<text x="${L+i*cw+cw/2-6}" y="${T-10}" text-anchor="start" font-size="14" fill="${C.muted}" transform="rotate(-35 ${L+i*cw+cw/2-6} ${T-10})">${esc(c.replace('_',' '))}</text>`).join('');
 rows.forEach((r,ri)=>{g+=`<text x="${L-12}" y="${T+ri*rh+22}" text-anchor="end" font-size="15" fill="${C.text}">${esc(r.label)}</text>`;cols.forEach((c,ci)=>{const v=kind==='fields'?r.fields?.[c]:r.slices?.[c]?.score;g+=`<rect x="${L+ci*cw+1}" y="${T+ri*rh+1}" width="${cw-2}" height="${rh-2}" rx="4" fill="${colour(v)}"/><text x="${L+ci*cw+cw/2}" y="${T+ri*rh+22}" text-anchor="middle" font-size="13" fill="${C.text}">${v===null||v===undefined?'—':Math.round(v*100)}</text>`;});});
 const title=kind==='fields'?(task==='look'?'Attribute accuracy by model (%)':'Query filter accuracy by model (%)'):'Score by image type (%)';
 return svgWrap(Math.max(W,700),H,`<text x="40" y="82" font-size="16" fill="${C.muted}">Rows sorted by overall score. Measured on the items each model found; misses show up in recall.</text>`+g+watermark(W,H,summary),title);
}
export function latencyChart(summary,task='look'){
 const rows=rowsFor(summary,task).filter(r=>r.latencyP50!==null).sort((a,b)=>a.latencyP50-b.latencyP50);if(!rows.length)return null;
 const L=260,T=110,rh=32,W=1100,pw=W-L-120,H=T+rows.length*rh+70;const max=Math.max(...rows.map(r=>r.latencyP95||r.latencyP50));
 let g='';rows.forEach((r,i)=>{const yv=T+i*rh;g+=`<text x="${L-12}" y="${yv+21}" text-anchor="end" font-size="15" fill="${C.text}">${esc(r.label)}</text><rect x="${L}" y="${yv+6}" width="${Math.max(2,r.latencyP50/max*pw)}" height="${rh-12}" rx="4" fill="${TIER_COLOURS[r.tier]||C.rose}"/>${r.latencyP95?`<line x1="${L+r.latencyP95/max*pw}" y1="${yv+4}" x2="${L+r.latencyP95/max*pw}" y2="${yv+rh-4}" stroke="${C.text}" stroke-width="2"/>`:''}<text x="${L+Math.max(r.latencyP50,r.latencyP95||0)/max*pw+10}" y="${yv+21}" font-size="14" fill="${C.muted}">${ms(r.latencyP50)} · p95 ${ms(r.latencyP95)}</text>`;});
 return svgWrap(W,H,`<text x="40" y="82" font-size="16" fill="${C.muted}">Median latency per call; the tick marks p95. Measured from India against public APIs.</text>`+g+watermark(W,H,summary),task==='look'?'How long a screenshot takes':'How long a query takes');
}


function keySection(s){
 const k=s.answerKey,v=s.validation?.keyCheck;if(!k&&!v)return '';
 return `## How the answer key was made and checked

Nobody labelled these images by hand. ${k?`Two strong models from different companies (${k.labeledBy.map(x=>x.replace('ai-consensus:','').replace('+',' and ')).join(', ')}) labelled every image independently and were left out of the test. An item counts only if both saw it; a field counts only if both agreed${k.agreement?`: they agreed on ${pct(k.agreement.items,0)} of items and ${pct(k.agreement.fields,0)} of fields`:''}. Everything else is unscored.`:''}${v?` A third model from another company (${v.judge}) then checked ${v.images} random images against the key: ${pct(v.itemAccuracy,0)} of key items were really in the image and ${pct(v.fieldAccuracy,0)} of key fields were correct.`:' The key has not been spot-checked yet (run `validate`).'}

`;
}
function scaleSection(s){
 const sc=s.scale;if(!sc)return '';
 const casc=sc.options.filter(o=>o.kind==='cascade');
 return `## Which model for the first 1,000 users, and after

At low volume the cost difference between models is a few dollars a month, so the best model is the right call. As volume grows, a cheaper model, or a cascade where a cheap model handles the easy images and passes the hard ones to a stronger one, gives up a few points to save most of the bill.

![Cost vs quality with cascades](charts/frontier-look.png)

${table(['Monthly image searches','Use','Score','Monthly cost','Best possible','Rule'],sc.bands.map(b=>[b.label.replace(' / month',''),b.pick?b.pick.label+(b.pick.rule?` (${b.pick.rule})`:''):'—',pct(b.pick?.score),usd(b.pick?.monthlyUsd),b.best?`${b.best.label}, ${pct(b.best.score)}, ${usd(b.best.monthlyUsd)}`:'—',b.why]))}

${casc.length?`Cascades worth considering (diamonds on the chart):\n\n${table(['#','Cheap model → strong model','When to escalate','Images escalated','Score','$ / image'],casc.map((c,i)=>['C'+(i+1),c.label,c.rule,pct(c.escalation,0),pct(c.score),usd(c.costPer1k/1000)]))}\n\n`:''}By kind of extraction (best value = the cheapest model within 3 points of the best):

${table(['Extraction','Best','Best value'],sc.byExtraction.map(e=>[e.label,`${e.best.model} (${pct(e.best.score,0)})`,e.value?`${e.value.model} (${pct(e.value.score,0)}, ${usd(e.value.costPer1k/1000)} / image)`:'—']))}

`;
}
const table=(head,rows)=>`| ${head.join(' | ')} |\n|${head.map(()=>'---').join('|')}|\n${rows.map(r=>`| ${r.join(' | ')} |`).join('\n')}`;
export function buildReport(summary,{author='The Better Wardrobe team'}={}){
 const look=rowsFor(summary,'look'),query=rowsFor(summary,'query'),f=findings(summary);
 const small=summary.dataset.looks<50||summary.dataset.queries<50;const unverified=summary.rows.some(r=>!r.priceVerified);
 const date=new Date(summary.finishedAt||summary.startedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
 const warn=[summary.mock?'> **SIMULATED DATA.** This report was generated from the mock provider to preview the layout. None of these numbers are real model results. Do not publish.':'',small?`> **Small sample.** ${summary.dataset.looks} images and ${summary.dataset.queries} queries: treat differences of a few points as noise and read the ± intervals.`:'',summary.stoppedEarly?'> **Run stopped early** (budget cap or cancellation). Some calls were skipped and scored as failures.':''].filter(Boolean).join('\n\n');
 const comp=o=>Object.entries(o||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} (${v})`).join(', ')||'—';
 const md=`# Which AI model should read your fashion screenshots? We tested ${summary.config.models.length} of them.

*${author} · ${date} · run \`${summary.runId}\`*

${warn}

We are building the Discover tab of The Better Wardrobe: you share a screenshot of an outfit (an Instagram reel, a Pinterest pin, a celebrity look) or type what you want, and we find it, or something close, from Indian stores within your budget. Every search starts with a model turning pixels or words into structured attributes. This study tests only that first step, image understanding; finding products comes after it and is tested separately. Pick the wrong model and every result downstream is wrong, or the bill explodes, so we tested the candidates on our own images.

## What we found

${f.map(x=>'- '+x).join('\n')}

![Accuracy vs cost](charts/frontier-look.png)

## Leaderboard: image understanding

${look.length?table(['#','Model','Tier','Image understanding','Spots items','Names type','Describes','Search-ready','Failures','Named a person','$ / image','p50 latency'],look.map((r,i)=>[i+1,r.label+(r.openWeights?' (open)':'')+(r.priceVerified?'':' *'),tierLabel(r.tier),pct(r.score)+ci(r),pct(r.parts?.spots),pct(r.parts?.names),pct(r.parts?.describes),pct(r.parts?.search),pct(1-r.okRate,0),r.privacyRate===undefined?'not checked':pct(r.privacyRate,1),usd(r.costPer1k===null?null:r.costPer1k/1000),ms(r.latencyP50)])):'_Not run._'}

Image understanding = 25% spots every item + 25% names the product type + 30% describes its attributes + 20% search-ready phrasing, all compared against the answer key; failed calls score zero. Nothing is searched on the web. The ± is a 95% confidence interval across images. A model that names a person in more than 2% of celebrity images, or fails more than 2% of calls, is not eligible for production.${unverified?'\n\n\\* Price carried over from the previous model in the family; check the provider pricing page.':''}

![Attribute accuracy](charts/fields-look.png)

${keySection(summary)}${scaleSection(summary)}## Leaderboard: keyword understanding

${query.length?table(['#','Model','Tier','Filter accuracy','Failures','p50 latency','$ / 1k queries'],query.map((r,i)=>[i+1,r.label,tierLabel(r.tier),pct(r.score)+ci(r),pct(1-r.okRate,0),ms(r.latencyP50),usd(r.costPer1k)])):'_Not run._'}

Queries test what Indian shoppers actually type: Hinglish ("500 se kam"), rupee shorthand ("under 2k"), occasions (haldi, sangeet, farewell) and colour words (mustard, lal). We also check that models leave filters empty when the shopper did not ask for them, because an invented price or gender silently hides good results.

## Method

- **Data.** ${summary.dataset.looks} images (${comp(summary.dataset.lookComposition)}) and ${summary.dataset.queries} queries (${comp(summary.dataset.queryComposition)}), each scored against a fixed taxonomy (version ${summary.taxonomyVersion})${summary.answerKey?' and an AI consensus answer key (see below)':''}.
- **Task 1, screenshot.** One call per image returns every fashion item with its location, product type, 11 attributes (department, colour, pattern, sleeve, fit, length, neckline, fabric, occasion, Indian ethnic wear, visible brand) and the phrase a shopper would type to find it. Close answers get half credit (navy for black, loafers for formal shoes).
- **Task 2, keywords.** One call per query returns search filters (category, colour, occasion, rupee price range, size, brand, language).
- **Fairness.** Same prompt (version ${summary.promptVersion}), same JSON schema, temperature 0 where supported, images resized to ${summary.config.maxDim}px for everyone, low reasoning effort where configurable, ${summary.config.repeat} run${summary.config.repeat>1?'s':''} per item.
- **Cost.** Billed tokens × list price (or the provider's reported cost), including reasoning tokens. Total spend for this study: ${usd(summary.spentUsd)}.
- **Not tested here.** Finding the actual product. Attribute extraction is the first step; visual retrieval with image embeddings is measured separately.

## Where models struggle

${(summary.hardest?.look||[]).length?table(['Image','Avg score across models','Type'],summary.hardest.look.map(h=>[h.id,pct(h.score),(h.tags||[]).filter(t=>t!=='sample').join(', ')])):'—'}

${(summary.failures?.look||[]).slice(0,6).map(x=>`- **${x.model}** on \`${x.item}\` (${pct(x.score,0)}): ${x.details.map(d=>d.pred?`${d.gold} → ${d.pred}`:`missed ${d.gold}`).join('; ')}`).join('\n')}

![Latency](charts/latency-look.png)

## What we are doing with this

We freeze the interfaces, not the vendors: the taxonomy, the prompt, the schema and the escalation rules stay fixed, and models are config. When prices or models change we re-run this suite and switch only if the numbers say so.

---
*Reproduce: \`cd prototype && node evals/cli.mjs run --models ${[...new Set(summary.config.models.map(m=>m.tier))].join(',')} --repeat ${summary.config.repeat}\`. Notes from providers: ${[...new Set(summary.rows.flatMap(r=>r.notes))].join('; ')||'none'}.*
`;
 const lin=`${summary.mock?'[SIMULATED — DO NOT POST]\n\n':''}We tested ${summary.config.models.length} AI vision models on real fashion screenshots for The Better Wardrobe's Discover tab: from ${usd(Math.min(...look.map(r=>r.costPer1k).filter(v=>v>0)))} to ${usd(Math.max(...look.map(r=>r.costPer1k).filter(v=>v>0)))} per 1,000 images.

What we learned:
${f.slice(0,4).map(x=>'→ '+x).join('\n')}

Method: ${summary.dataset.looks} hand-labelled images and ${summary.dataset.queries} Indian shopping queries (Hinglish, rupee ranges, festive occasions), same prompt and schema for every model, failures scored as zero.

Our takeaway: freeze the taxonomy and the interfaces, keep the model swappable, and let your own data pick it.

Full write-up with charts in the comments.`;
 return {markdown:md,linkedin:lin,charts:{'frontier-look':look.length?frontierChart(summary,'look'):null,'frontier-query':query.length?frontierChart(summary,'query'):null,'fields-look':heatmap(summary,'look','fields'),'fields-query':heatmap(summary,'query','fields'),'slices-look':heatmap(summary,'look','slices'),'latency-look':latencyChart(summary,'look')}};
}
export async function writeReport(summary,outDir,options){
 const r=buildReport(summary,options);await mkdir(path.join(outDir,'charts'),{recursive:true});
 await writeFile(path.join(outDir,'report.md'),r.markdown);await writeFile(path.join(outDir,'linkedin.txt'),r.linkedin);
 for(const [name,svg] of Object.entries(r.charts)){if(!svg)continue;await writeFile(path.join(outDir,'charts',name+'.svg'),svg);await sharp(Buffer.from(svg),{density:144}).png().toFile(path.join(outDir,'charts',name+'.png'));}
 return {dir:outDir,files:['report.md','linkedin.txt',...Object.keys(r.charts).filter(k=>r.charts[k]).map(k=>`charts/${k}.png`)]};
}
