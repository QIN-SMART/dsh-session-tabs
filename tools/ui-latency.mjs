// Purpose-built real GUI measurement on an isolated DSH profile; no model calls.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const url=readFileSync(arg('url-file','.tmp/test-url.txt'),'utf8').trim(),out=arg('out','docs/latency.json');
const port=Number(arg('port','9348')),tag=arg('tag','unknown');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
mkdirSync('.tmp/chrome-latency',{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--in-process-gpu','--no-first-run','--disable-crash-reporter',`--remote-debugging-port=${port}`,`--user-data-dir=${resolve('.tmp/chrome-latency')}`,'--window-size=1280,820','about:blank'],{stdio:'ignore'});
process.on('exit',()=>chrome.kill('SIGKILL'));
let ws,next=0,pending=new Map();
async function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function wait(expression){const start=performance.now();while(performance.now()-start<8000){if(await evaluate(expression))return;await sleep(16);}throw Error('Visible UI did not become ready');}
async function click(selector){const r=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!r)throw Error('UI target missing: '+selector);await send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',clickCount:1});}
const nativeReady=title=>`(()=>{const main=document.querySelector('[data-slot="main"]');if(!main)return false;return !!main.querySelector('[contenteditable="true"]')&&!/载入历史|Loading history/.test(main.textContent)&&Array.from(main.querySelectorAll('header,[role="banner"]')).some(e=>e.textContent.includes(${JSON.stringify(title)}))})()`;
async function metrics(){return Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));}
async function main(){
  for(let i=0;i<60;i++){try{const data=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const page=data.find(p=>p.type==='page');if(page){ws=new WebSocket(page.webSocketDebuggerUrl);break;}}catch{}await sleep(150);}
  if(!ws)throw Error('Test browser did not start');await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j);});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  await send('Page.enable');await send('Runtime.enable');await send('Performance.enable');await send('Page.navigate',{url});await wait('!!document.querySelector("[data-dsst-action=new]")');
  if(await evaluate('!!document.querySelector("button[aria-label=\\"打开侧边栏\\"]")'))await click('button[aria-label="打开侧边栏"]');
  await wait(`Array.from(document.querySelectorAll('[data-row-key^="session:"]')).filter(e=>/TAB-[AB] 并发隔离验证/.test(e.textContent)&&!e.textContent.includes('验证 (1)')).length>=2`);
  const rows=await evaluate(`Array.from(document.querySelectorAll('[data-row-key^="session:"]')).filter(e=>/TAB-[AB] 并发隔离验证/.test(e.textContent)&&!e.textContent.includes('验证 (1)')).map(e=>({id:e.getAttribute('data-row-key').slice(8),title:e.textContent.match(/TAB-[AB] 并发隔离验证/)[0]})).slice(0,2)`);
  if(rows.length<2)throw Error('Requires the two existing synthetic TAB-A / TAB-B sessions');
  const samples=[];
  async function record(kind,selector,ready){const before=await metrics(),ownBefore=await evaluate('window.__dshSessionTabs?.metrics?.()||null');const start=performance.now();await click(selector);await wait(ready);const elapsed=performance.now()-start,after=await metrics(),ownAfter=await evaluate('window.__dshSessionTabs?.metrics?.()||null');samples.push({kind,elapsedMs:+elapsed.toFixed(2),scriptMs:+((after.ScriptDuration-before.ScriptDuration)*1000).toFixed(2),layoutMs:+((after.LayoutDuration-before.LayoutDuration)*1000).toFixed(2),...(ownBefore&&ownAfter?{stripMs:+(ownAfter.totalMs-ownBefore.totalMs).toFixed(2),stripRenders:ownAfter.renders-ownBefore.renders}:{})});}
  // Warm both native session bindings, then compare the two navigation entrances.
  for(const r of rows){await click(`[data-row-key="session:${r.id}"]`);await wait(nativeReady(r.title));}
  for(let i=0;i<6;i++){const r=rows[i%2];await record('tab-switch',`[data-dsst-action="open"][data-dsst-id="${r.id}"]`,nativeReady(r.title));}
  for(let i=0;i<4;i++){const r=rows[i%2];await record('native-sidebar-switch',`[data-row-key="session:${r.id}"]`,nativeReady(r.title));}
  for(let i=0;i<3;i++){
    const r=rows[0];await click(`[data-dsst-action="open"][data-dsst-id="${r.id}"]`);await wait(nativeReady(r.title));
    await record('new-blank','[data-dsst-action="new"]',`(()=>{const e=document.querySelector('[data-dsst-action="open"][aria-selected="true"]');const main=document.querySelector('[data-slot="main"]');return e&&e.getAttribute('data-dsst-id')!==${JSON.stringify(r.id)}&&e.textContent.includes('新会话')&&main.querySelector('[contenteditable="true"]')&&main.textContent.includes('探索未至之境')})()`);
    const id=await evaluate(`document.querySelector('[data-dsst-action="open"][aria-selected="true"]').getAttribute('data-dsst-id')`);
    const neighbour=await evaluate(`(()=>{const rows=Array.from(document.querySelectorAll('[data-dsst-action="open"]'));const i=rows.findIndex(e=>e.getAttribute('data-dsst-id')===${JSON.stringify(id)});const rest=rows.filter(e=>e.getAttribute('data-dsst-id')!==${JSON.stringify(id)});return rest[Math.min(i,rest.length-1)].querySelector('.dsst-title').textContent})()`);
    await record('close-blank',`[data-dsst-action="close"][data-dsst-id="${id}"]`,nativeReady(neighbour));
  }
  const summary={};for(const kind of new Set(samples.map(s=>s.kind))){const a=samples.filter(s=>s.kind===kind).map(s=>s.elapsedMs).sort((a,b)=>a-b),middle=Math.floor(a.length/2);summary[kind]={n:a.length,medianMs:+(a.length%2?a[middle]:(a[middle-1]+a[middle])/2).toFixed(2),maxMs:a.at(-1)};}
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({tag,method:'CDP pointer click to visible native header/editor readiness; includes polling/automation overhead; local synthetic sessions, no model call; headless software rendering',samples,summary},null,2)+'\n');console.log(JSON.stringify({tag,summary}));ws.close();chrome.kill('SIGKILL');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;ws?.close();chrome.kill('SIGKILL');});
