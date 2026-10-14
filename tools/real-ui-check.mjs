// 真实 GUI 冒烟检查：用 CDP 驱动真实 DSH WebUI，确认插件真的装载了，并截图。
//
// 为什么需要它：单测跑在 mock DOM 上，只能证明"逻辑对"；装进真实宿主才会暴露
// 插槽不渲染、哈希类名变了、样式被覆盖、控制台报错这类问题。
//
// 用法：
//   node tools/real-ui-check.mjs --url http://127.0.0.1:3080 --global __dshSessionTabs
//   node tools/real-ui-check.mjs --assert '!!document.querySelector("style[data-plugin-css=\"dsh-session-tabs/style\"]")' --label "样式表已注入"
//
// 参数：
//   --url <url>        默认 http://127.0.0.1:3080 （可带 ?token=…，取不到就自动读取）
//   --global <name>    window 上的调试全局（默认 __dshSessionTabs），断言它存在
//   --assert <expr>    额外断言，可重复；表达式需返回真值
//   --label <text>     --assert 的说明（可重复、按顺序对应）
//   --out <path>       截图输出（默认 docs/real-ui.png）
//   --chrome <path>    Chrome 可执行文件（默认 macOS 路径）
//   --wait <ms>        导航后等待时间（默认 3500）
//   --allow-console-errors  不在控制台报错时失败（默认有 error 就失败）

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argvValue(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
function argvAll(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) out.push(process.argv[i + 1]); });
  return out;
}

const URL_FILE = argvValue('url-file', null);
const URL_BASE = URL_FILE ? readFileSync(String(URL_FILE),'utf8').trim() : String(argvValue('url', 'http://127.0.0.1:3096'));
const GLOBAL_NAME = String(argvValue('global', '__dshSessionTabs'));
const OUT = resolve(ROOT, String(argvValue('out', 'docs/real-ui.png')));
const WAIT = Number(argvValue('wait', 3500));
const ALLOW_ERRORS = process.argv.includes('--allow-console-errors');
const BASELINE = process.argv.includes('--baseline');
const RESIZE = process.argv.includes('--resize-check');
// Windows has no fixed Chrome location; try the usual suspects before giving up.
const DEFAULT_CHROME = process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe' : '', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => p && existsSync(p))
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME = String(argvValue('chrome', DEFAULT_CHROME));
const CONNECT = argvValue('connect-port', null);
const PORT = Number(CONNECT || argvValue('debug-port', 9333));
const TARGET = String(argvValue('target-match',''));
const ASSERTIONS = argvAll('assert');
const LABELS = argvAll('label');
let ownedChrome;
process.on('exit',()=>ownedChrome?.kill('SIGKILL'));

if (!CONNECT && !existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n用 --chrome <path> 指定，或跳过这项检查（但请务必人工点一遍）。`);
  process.exit(2);
}

/** 启动一个独立的 headless Chrome，返回 {proc, port}。 */
function launchChrome() {
  const userDataDir = resolve(ROOT, '.tmp', 'chrome-profile');
  mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--in-process-gpu',
    '--disable-crash-reporter', '--hide-scrollbars', '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'about:blank'
  ], { stdio: 'ignore', detached: false });
  return proc;
}

async function waitForDevtools(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return true;
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** 极简 CDP 客户端（Node 自带 WebSocket，无需依赖）。 */
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error('WebSocket 连接失败: ' + (e.message || 'error'))));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ws, ready, send, events };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`· ${CONNECT?'连接独立测试进程':'启动 headless Chrome'}（调试端口 ${PORT}）`);
  const chrome = CONNECT ? null : launchChrome();ownedChrome=chrome;
  const up = await waitForDevtools();
  if (!up) {
    chrome?.kill('SIGKILL');
    throw new Error('Chrome 的 DevTools 端口没有就绪');
  }

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page' && (!TARGET || t.url.includes(TARGET)));
  if (!page) throw new Error('没有可用的 page target');

  const cdp = connectCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  // token：URL 里没带就从 DSH 的启动日志/URL 文件里找（拿不到也继续，未认证会 401）
  let url = URL_BASE;
  if(!CONNECT){console.log(`· 打开 ${new URL(url).origin}（认证参数不写日志）`);await cdp.send('Page.navigate', { url });}
  await sleep(WAIT);

  const problems = [];
  const consoleErrors = cdp.events
    .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text);
  if (consoleErrors.length && !ALLOW_ERRORS) {
    problems.push(`控制台有 ${consoleErrors.length} 条 error：\n    ` + consoleErrors.slice(0, 5).join('\n    '));
  }

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate 抛错');
    return result.result.value;
  };
  if(process.argv.includes('--edge-ui-check')){
    const proof={};
    const ensure=(ok,label)=>{if(!ok)throw Error(label);console.log('  ✓ '+label);};
    async function clickVisible(selector){
      const point=await evaluate(`(()=>{for(const b of document.querySelectorAll(${JSON.stringify(selector)})){const r=b.getBoundingClientRect(),s=getComputedStyle(b);if(!b.hidden&&s.visibility!=='hidden'&&r.width>0&&r.left>=0&&r.right<=innerWidth+1)return {x:r.x+r.width/2,y:r.y+r.height/2};}return null;})()`);
      if(!point)throw Error('No visible control: '+selector);
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});await sleep(350);
    }
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='继续');if(b)b.click();})()`);await sleep(200);
    if(process.argv.includes('--handoff-ui-check')){
      await evaluate(`(()=>{const b=document.querySelector('button[aria-label="打开侧边栏"]');if(b)b.click();})()`);await sleep(200);
      ensure(await evaluate(`(()=>{const row=[...document.querySelectorAll('[data-row-key^="session:"]')].find(e=>e.textContent.includes('TAB-A 并发隔离验证')&&!e.textContent.includes('(1)'));if(!row)return false;row.click();return true;})()`),'使用合成会话验收底部工作区入口');await sleep(350);
    }
    ensure(await evaluate('!!document.querySelector("[data-dsst-mode] svg rect")'),'标签窗口图标已在真实左栏渲染');
    if(!(await evaluate('window.__dshSessionTabs.snapshot().enabled')))await clickVisible('[data-dsst-mode]');
    await clickVisible('[data-dsst-mode]');
    ensure(await evaluate('document.querySelector("[data-dsh-session-tabs]").hidden&&!document.querySelector("[data-dsh-session-tabs-native-hidden]")'),'新图标切回原生视图，原生入口恢复');
    if(process.argv.includes('--handoff-ui-check')){
      if(await evaluate('document.querySelector("[data-dsh-bottom-toggle]")?.getAttribute("aria-pressed")==="true"'))await clickVisible('[data-dsh-bottom-toggle]');
      proof.nativeBottom=await evaluate(`(()=>{const b=[...document.querySelectorAll('[data-dsh-bottom-toggle]')].find(e=>!e.closest('[hidden]')&&!e.closest('[aria-hidden="true"]'));if(!b)return null;const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();return {width:r.width,height:r.height,iconWidth:s.width,iconHeight:s.height};})()`);
    }
    await clickVisible('[data-dsst-mode]');
    const modeReturn=await evaluate('({state:window.__dshSessionTabs.snapshot(),hidden:document.querySelector("[data-dsh-session-tabs]").hidden,label:document.querySelector("[data-dsst-mode]").getAttribute("aria-label")})');
    if(modeReturn.hidden){const shot=await cdp.send('Page.captureScreenshot',{format:'png'});mkdirSync(dirname(OUT),{recursive:true});writeFileSync(OUT.replace(/\.png$/,'-mode-failure.png'),Buffer.from(shot.data,'base64'));console.log(JSON.stringify(modeReturn));}
    ensure(!modeReturn.hidden,'新图标恢复标签视图');
    const geometry=selector=>evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>{const r=e.getBoundingClientRect();return !e.hidden&&getComputedStyle(e).visibility!=='hidden'&&r.width>0&&r.left>=0&&r.right<=innerWidth+1;});if(!b)return null;const r=b.getBoundingClientRect(),svg=b.querySelector('svg').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,iconWidth:svg.width,iconHeight:svg.height,rightGap:innerWidth-r.right};})()`);
    if(!(await geometry('[data-dsst-action=right]')))await clickVisible('[data-sidebar-right-toggle]');
    proof.collapsed=await geometry('[data-dsst-action=right]');ensure(!!proof.collapsed,'关闭右栏时有一个顶部打开入口');
    if(process.argv.includes('--handoff-ui-check')){
      proof.bottom=await geometry('[data-dsst-action=bottom]');
      ensure(proof.nativeBottom&&proof.bottom&&['width','height','iconWidth','iconHeight'].every(k=>Math.abs(proof.bottom[k]-proof.nativeBottom[k])<.1),'底部工作区按钮和图标与原生尺寸一致');
      ensure(Math.abs(proof.bottom.y+proof.bottom.height/2-proof.collapsed.y-proof.collapsed.height/2)<.1,'底部按钮和右栏按钮中心线对齐');
    }
    await clickVisible('[data-dsst-action=right]');
    ensure(await evaluate('document.querySelector("[data-dsst-action=right]").hidden'),'展开后中央重复按钮隐藏');
    proof.expanded=await geometry('[data-sidebar-right-toggle]');ensure(!!proof.expanded,'展开后保留最右侧原生收起入口');
    ensure(['width','height','iconWidth','iconHeight'].every(k=>Math.abs(proof.collapsed[k]-proof.expanded[k])<.1),'新打开按钮与原生收起按钮尺寸相同');
    ensure(['x','y'].every(k=>Math.abs(proof.collapsed[k]-proof.expanded[k])<.1),'展开与收起时开关位置完全对齐');
    const opened=await cdp.send('Page.captureScreenshot',{format:'png'});mkdirSync(dirname(OUT),{recursive:true});writeFileSync(OUT.replace(/\.png$/,'-open.png'),Buffer.from(opened.data,'base64'));
    await clickVisible('[data-sidebar-right-toggle]');ensure(!!(await geometry('[data-dsst-action=right]')),'点击原生收起按钮后恢复顶部打开入口');
    if(process.argv.includes('--handoff-ui-check')){
      await evaluate(`(()=>{const p={frames:[],bottomHits:0,stop:false};window.__dsstHandoffProbe=p;p.listener=e=>{if(e.target.closest?.('[data-dsst-action="bottom"]')||e.target.closest?.('[data-dsh-bottom-toggle]'))p.bottomHits++;};document.addEventListener('click',p.listener,true);function sample(t){if(p.stop)return;const b=document.querySelector('[data-dsst-action=bottom]'),slot=document.querySelector('[data-dsst-right-slot]'),r=document.querySelector('[data-dsst-action=right]');if(b&&slot){const a=b.getBoundingClientRect(),s=slot.getBoundingClientRect();if(a.width&&s.width)p.frames.push({t,overlap:a.right>s.left+.1,aligned:Math.abs(a.y+a.height/2-s.y-s.height/2)<.1,pending:r.getAttribute('data-dsst-pending')==='true',bottomOpen:b.getAttribute('aria-pressed')==='true'});}if(p.frames.length<300)requestAnimationFrame(sample);}requestAnimationFrame(sample);return true;})()`);
      async function tap(point){await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});}
      const point={x:proof.expanded.x+proof.expanded.width/2,y:proof.expanded.y+proof.expanded.height/2};
      for(let i=0;i<3;i++){
        await clickVisible('[data-dsst-action=right]');
        await tap(point);
        for(const ms of [10,25,45,80]){await sleep(ms);await tap(point);}
        await sleep(350);
        if(!(await geometry('[data-dsst-action=right]')))await clickVisible('[data-sidebar-right-toggle]');
      }
      proof.handoff=await evaluate('(()=>{const p=window.__dsstHandoffProbe;p.stop=true;document.removeEventListener("click",p.listener,true);const result={frames:p.frames,bottomHits:p.bottomHits};delete window.__dsstHandoffProbe;return result;})()');
      ensure(proof.handoff.frames.length>10&&proof.handoff.frames.every(f=>!f.overlap&&f.aligned),'逐帧验证：动画过程中底部按钮不挤占右栏开关位置');
      ensure(proof.handoff.bottomHits===0&&proof.handoff.frames.every(f=>!f.bottomOpen),'连续开关和过渡期重复点击未误触底部工作区');
    }
    proof.nativeParentKept=await evaluate('!!document.querySelector("[data-slot=main]")&&document.querySelectorAll("[data-dsh-session-tabs]").length===1');
    writeFileSync(OUT.replace(/\.png$/,'.json'),JSON.stringify(proof,null,2)+'\n');
  }
  if(process.argv.includes('--tabs-ui-check')){
    const proof={};
    const ensure=(ok,label)=>{if(!ok)throw Error(label);console.log('  ✓ '+label);};
    const click=async(selector)=>{
      const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      if(!p)throw Error('Missing UI control: '+selector);
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
      await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
      await sleep(200);
    };
    await evaluate(`(()=>{const dialog=[...document.querySelectorAll('[role=dialog]')].find(e=>e.textContent.includes('预览版说明'));const b=[...(dialog||document).querySelectorAll('button')].find(e=>e.textContent.trim()==='继续');if(b)b.click();})()`);
    await sleep(200);
    await evaluate(`(()=>{const b=document.querySelector('button[aria-label="打开侧边栏"]');if(b)b.click();})()`);
    await sleep(300);
    await evaluate(`(()=>{window.__tabsUiNodes={left:document.querySelector('[data-slot=sidebar]'),right:document.querySelector('[data-slot=rightbar]'),main:document.querySelector('[data-slot=main]')};return true;})()`);
    for(const name of ['TAB-A 并发隔离验证','TAB-B 并发隔离验证']){
      ensure(await evaluate(`(()=>{const row=[...document.querySelectorAll('[data-row-key^="session:"]')].find(e=>e.textContent.includes(${JSON.stringify(name)})&&!e.textContent.includes('(1)'));if(!row)return false;row.click();return true;})()`),'打开合成测试会话：'+name);
      await sleep(300);
    }
    proof.initial=await evaluate('window.__dshSessionTabs.snapshot()');
    ensure(proof.initial.ids.length>=2,'多个标签已打开');
    ensure(await evaluate('!document.querySelector("[data-dsst-action=menu]")'),'加号旁的标签选项已移除');
    const hover=async(selector)=>{
      const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await sleep(80);
      return evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}),cell=b.closest('[data-dsst-tab]');return {hovered:cell.matches(':hover'),selected:b.getAttribute('aria-selected'),titleBackground:getComputedStyle(b).backgroundColor,cellBackground:getComputedStyle(cell).backgroundColor,highlight:getComputedStyle(cell,'::before').backgroundColor,closeBackground:getComputedStyle(cell.querySelector('[data-dsst-action=close]')).backgroundColor}})()`);
    };
    proof.activeHover=await hover('[data-dsst-tab][data-active=true] [data-dsst-action=open]');
    ensure(proof.activeHover.hovered&&proof.activeHover.titleBackground==='rgba(0, 0, 0, 0)'&&proof.activeHover.highlight==='rgba(0, 0, 0, 0)','当前标签悬停保持亮色，标题无灰色叠层');
    proof.inactiveHover=await hover('[data-dsst-tab][data-active=false] [data-dsst-action=open]');
    ensure(proof.inactiveHover.hovered&&proof.inactiveHover.titleBackground==='rgba(0, 0, 0, 0)'&&proof.inactiveHover.closeBackground==='rgba(0, 0, 0, 0)'&&proof.inactiveHover.highlight!=='rgba(0, 0, 0, 0)','其他标签悬停使用一层覆盖标题和关闭按钮的灰色底');
    const hoverShot=await cdp.send('Page.captureScreenshot',{format:'png'});mkdirSync(dirname(OUT),{recursive:true});writeFileSync(OUT.replace(/\.png$/, '-hover.png'),Buffer.from(hoverShot.data,'base64'));
    proof.geometry=await evaluate(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),p=r('[data-dsst-action=new]'),a=r('[data-dsst-tab][data-active=true]'),j=r('.dsst-join');return {plusCenter:p.y+p.height/2,closeCenters:[...document.querySelectorAll('[data-dsst-action=close]')].map(e=>{const r=e.getBoundingClientRect();return r.y+r.height/2}),joinVisible:!document.querySelector('.dsst-join').hidden,joinLeftDifference:j.left-a.left,joinWidthDifference:j.width-a.width};})()`);
    ensure(proof.geometry.closeCenters.every(y=>Math.abs(y-proof.geometry.plusCenter)<.1),'加号与所有关闭按钮中心平齐');
    ensure(proof.geometry.joinVisible&&Math.abs(proof.geometry.joinLeftDifference)<.1&&Math.abs(proof.geometry.joinWidthDifference)<.1,'当前标签的底部衔接层定位正确');
    await click('[data-dsst-tab][data-active=false] [data-dsst-action=open]');
    ensure((await evaluate('window.__dshSessionTabs.snapshot().active'))!==proof.initial.active,'点击其他标签切换原生会话');
    await click('[data-dsst-action=new]');
    const created=await evaluate('window.__dshSessionTabs.snapshot().active');
    await click('[data-dsst-tab][data-active=true] [data-dsst-action=close]');
    ensure(!(await evaluate('window.__dshSessionTabs.snapshot().ids')).includes(created),'新建后关闭标签正常');
    proof.panels={};
    for(const kind of ['bottom','right']){
      const selector='[data-dsst-action='+kind+']';
      const before=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});return b&&!b.hidden?b.getAttribute('aria-pressed'):null;})()`);
      if(before===null){proof.panels[kind]='native control unavailable';continue;}
      // Windows sidebar animations settle slower than the 0.2s used elsewhere; give the
      // native panel a moment before reading the relayed state back.
      await click(selector);await sleep(450);
      const after=await evaluate(`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')??null`);
      ensure(after!==before,'顶部入口转发原生面板：'+kind);await click(selector);await sleep(450);proof.panels[kind]='toggled and restored';
    }
    await evaluate('window.__dshSessionTabs.enable(false)');
    ensure(await evaluate('document.querySelector("[data-dsh-session-tabs]").hidden&&!document.querySelector("[data-dsh-session-tabs-native-hidden]")'),'切回原生视图恢复原生面板入口');
    await evaluate('window.__dshSessionTabs.enable(true)');
    ensure(await evaluate('(()=>{const n=window.__tabsUiNodes;return !!n.left&&!!n.right&&!!n.main&&n.left===document.querySelector("[data-slot=sidebar]")&&n.right===document.querySelector("[data-slot=rightbar]")&&n.main===document.querySelector("[data-slot=main]");})()'),'左右侧栏及主视图节点保留');
    await evaluate('delete window.__tabsUiNodes');
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:500});
    writeFileSync(OUT.replace(/\.png$/, '.json'),JSON.stringify(proof,null,2)+'\n');
  }
  if(process.argv.includes('--ensure-tab')&&!BASELINE){
    const hasTab=await evaluate('!!document.querySelector("[data-dsst-tab]")');
    if(!hasTab){await evaluate('document.querySelector("[data-dsst-action=new]").click()');await sleep(400);}
  }
  if(RESIZE){
    // Exercise only native UI controls in the isolated test browser.
    const rightExists=await evaluate('!!document.querySelector("[data-side=rightbar]")');
    if(!rightExists){
      const opened=await evaluate('(()=>{const b=document.querySelector("button[aria-label=\\"打开右侧边栏\\"]");if(!b)return false;b.click();return true})()');
      if(!opened)throw Error('No observed native rightbar toggle');
      await sleep(300);
    }
    for(const side of ['sidebar','rightbar']){
      const rect=async()=>evaluate(`(()=>{const e=document.querySelector('[data-side="${side}"]');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(160,r.height/2)}})()`);
      const origin=await rect();if(!origin)throw Error('Native drag handle missing: '+side);
      async function drag(from,to){
        await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...from});
        await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',buttons:1,clickCount:1});
        await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...to,button:'left',buttons:1});
        await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',buttons:0,clickCount:1});
        await sleep(200);
      }
      await drag(origin,{x:origin.x+24,y:origin.y});const moved=await rect();
      if(!moved||Math.abs(moved.x-origin.x)<12)throw Error('Native sidebar did not resize: '+side);
      await drag(moved,origin);console.log('  ✓ 原生拖宽并恢复：'+side);
    }
  }

  const checks = [];
  const globalExpr = `typeof window[${JSON.stringify(GLOBAL_NAME)}] !== 'undefined'`;
  if(!BASELINE)checks.push([globalExpr, `调试全局 window.${GLOBAL_NAME} 存在（插件已装载）`]);
  checks.push(['document.querySelectorAll("iframe").length===0','没有 iframe']);
  checks.push(['document.querySelectorAll("[data-slot=main]").length===1','只有一个原生主视图入口']);
  if(BASELINE){checks.push(['document.querySelectorAll("[data-dsh-session-tabs]").length===0','原生对照：标签插件未加载']);}
  else{checks.push(['document.querySelectorAll("[data-dsh-session-tabs]").length===1','只有一条标签栏']);checks.push(['!!document.querySelector("style[data-plugin-css=\\"dsh-session-tabs/style\\"]")','标签栏样式已注入']);}
  ASSERTIONS.forEach((expr, i) => checks.push([expr, LABELS[i] || `自定义断言 #${i + 1}`]));

  for (const [expr, label] of checks) {
    const ok = await evaluate(`Boolean(${expr})`);
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) problems.push(label);
  }

  const info = await evaluate(`JSON.stringify({
    lang: document.documentElement.lang || '',
    dark: !!document.body && document.body.hasAttribute('data-ds-dark-theme'),
    rows: document.querySelectorAll('[data-row-key^="session:"]').length,
    styles: document.querySelectorAll('style[data-plugin]').length
  })`);
  console.log(`· 页面状态 ${info}`);

  mkdirSync(dirname(OUT), { recursive: true });
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`· 截图已写入 ${OUT}`);

  cdp.ws.close();
  chrome?.kill('SIGKILL');

  if (problems.length) {
    console.error(`\n✗ 真实界面检查失败（${problems.length} 项）：`);
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\n✓ 真实界面检查通过');
}

main().catch((err) => {
  console.error('✗ ' + err.message);
  process.exit(1);
});
