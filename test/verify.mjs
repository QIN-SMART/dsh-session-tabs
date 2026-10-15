import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {domFixture,TestContext} from './dom-fixture.mjs';
const source=readFileSync(new URL('../lib/client.js',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
const plain=x=>JSON.parse(JSON.stringify(x));
class Observable{
  constructor(value){this.value=value;this.listeners=new Set();}
  getSnapshot(){return this.value;}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){[...this.listeners].forEach(fn=>fn());}
}
function load(extra={}){
  let registration;
  const window=extra.window||{};window.__ModuleLoader__={load(r){registration=r;}};
  const sandbox={window,console,setTimeout,clearTimeout,Map,Set,Promise,...extra};sandbox.window=window;
  vm.runInNewContext(source,sandbox,{filename:'client.js'});
  return {registration,plugin:registration.factory(id=>{assert.equal(id,'react');return {createElement(){},useState(){return [0,()=>{}];},useEffect(){}};}),sandbox,window};
}
function fixture(opts={}){
  const {plugin}=load();
  const list=new Observable({phase:opts.phase||'ready',ids:['a','b','c'],byId:{a:{id:'a',displayTitle:'A',blank:false,running:false,retainedBy:{mainView:1}},b:{id:'b',displayTitle:'B',blank:false,running:false,retainedBy:{}},c:{id:'c',displayTitle:'C',blank:false,running:false,retainedBy:{}}}});
  const status=new Observable(new Map()),workspaces=new Observable({items:[],archivedSessionIds:[]}),panel=new Observable({activePanelId:null});
  const calls=[],refs=[],values=new Map();if(opts.raw)values.set(plugin.storageKey,opts.raw);
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{values.set(k,v);}};
  const services={sessions:{list,retain(id,options){
    calls.push(['retain',id,options.source]);
    const r={id,released:false,ready:opts.rejectReady?Promise.reject(new Error('open failed')):Promise.resolve(),release(){if(r.released)return;r.released=true;const row=list.value.byId[id];if(row){delete row.retainedBy[options.source];list.emit();}}};refs.push(r);
    list.value.byId[id].retainedBy[options.source]=1;list.emit();return r;
  }},uiSession:{sessionStatus:status},workspaces:{list:workspaces},layout:{panelInfo:panel},uiWorkspace:{
    openSession(id){if(opts.failOpen)throw new Error('navigation failure');calls.push(['open',id]);Object.values(list.value.byId).forEach(row=>delete row.retainedBy.mainView);list.value.byId[id].retainedBy.mainView=1;list.emit();},
    startSession(){calls.push(['new']);if(opts.noCreate)return;const id='new'+calls.length;list.value.byId[id]={id,displayTitle:'new',blank:true,retainedBy:{}};services.uiWorkspace.openSession(id);}
  }};
  // The service guard rejects undeclared injection, unlike a permissive plain ctx.
  const ctx=new Proxy({}, {get(_,key){assert.ok(plugin.inject.includes(key),'undeclared service '+String(key));return services[key];}});
  const controller=plugin.createController(ctx,{storage,lang:()=>opts.lang||'en'});
  return {plugin,ctx,services,controller,list,status,workspaces,panel,calls,refs,storage,values};
}
test('published module shape, lazy import, declared services and metadata',()=>{
  const r=load();assert.equal(r.registration.id,pkg.name);assert.equal(typeof r.plugin.apply,'function');assert.equal(r.plugin.default,undefined);assert.deepEqual(Object.keys(r.window),['__ModuleLoader__']);
  for(const file of [pkg.main,pkg.icon,pkg.dsh.bundle.patch,pkg.exports['./client']])assert.ok(readFileSync(new URL('../'+file,import.meta.url)).length);
  assert.equal(pkg.dsh.client.platform,'web');
});
test('parse rejects malformed, future and unsafe data; de-duplicates and bounds IDs',()=>{
  const {plugin}=load();assert.deepEqual(plain(plugin.parse('{')), {version:1,enabled:true,ids:[],active:null});
  assert.equal(plugin.parse('{"version":2,"ids":["x"]}').ids.length,0);
  const state=plugin.parse({version:1,ids:['a','a','',3,null,'\u0000',...Array.from({length:250},(_,i)=>'s'+i)],active:'a'});
  assert.equal(state.ids.length,200);assert.equal(state.ids[0],'a');assert.equal(state.active,'a');assert.deepEqual(plain(plugin.parse(plugin.serialize(state))),plain(state));
});
test('initial active reference has its own source; inactive restored IDs do not open history',()=>{
  const f=fixture({raw:'{"version":1,"ids":["a","b","c"],"active":"a"}'});
  assert.deepEqual(f.calls,[['retain','a','dsh-session-tabs']]);assert.equal(f.controller.snapshot().retained,1);assert.equal(f.list.value.byId.a.retainedBy.mainView,1);
  f.controller.dispose();
});
test('restore once after ready, prune removed IDs, and do not steal focus later',()=>{
  const f=fixture({phase:'pending',raw:'{"version":1,"ids":["a","b","gone"],"active":"b"}'});
  assert.equal(f.calls.some(c=>c[0]==='open'),false);f.list.value.phase='ready';f.list.emit();
  assert.equal(f.controller.snapshot().active,'b');assert.deepEqual(plain(f.controller.snapshot().ids),['a','b']);
  f.controller.open('a');f.list.emit();assert.equal(f.controller.snapshot().active,'a');f.controller.dispose();
});
test('native navigation and per-session input lifecycle survive switching',()=>{
  const f=fixture();f.controller.open('b');assert.equal(f.controller.snapshot().active,'b');
  assert.equal(f.refs.filter(r=>!r.released).length,2);assert.equal(f.list.value.byId.a.retainedBy.mainView,undefined);
  assert.equal(f.list.value.byId.a.retainedBy['dsh-session-tabs'],1);f.controller.dispose();
});
test('opening a tab navigates first and takes its keepalive ref only after the switch settles',()=>{
  const f=fixture();f.controller.open('b');
  const openAt=f.calls.findIndex(c=>c[0]==='open'&&c[1]==='b');
  const retainAt=f.calls.findIndex(c=>c[0]==='retain'&&c[1]==='b');
  assert.ok(openAt>=0&&retainAt>openAt,'retain must follow navigation, not sit on the click path');
  assert.equal(f.refs.find(r=>r.id==='b').released,false);f.controller.dispose();
});
test('closing a running tab never cancels and retains it until idle',()=>{
  const f=fixture();f.controller.open('b');f.list.value.byId.a.running=true;f.status.value.set('a',{running:true});f.status.emit();
  f.controller.close('a');assert.equal(f.controller.snapshot().ids.includes('a'),false);assert.equal(f.refs.find(r=>r.id==='a').released,false);
  assert.equal(f.calls.some(c=>['cancel','delete','archive'].includes(c[0])),false);
  f.list.value.byId.a.running=false;f.status.value.set('a',{running:false});f.status.emit();assert.equal(f.refs.find(r=>r.id==='a').released,true);f.controller.dispose();
});
test('pending interaction outranks running and closing preserves its ownership',()=>{
  const f=fixture();f.controller.open('b');f.status.value.set('a',{running:true,pendingInteraction:{key:'approval-a'}});f.status.emit();assert.equal(f.controller.status('a'),'pending');
  f.controller.close('a');assert.equal(f.refs.find(r=>r.id==='a').released,false);f.controller.dispose();
});
test('close active selects a neighbour; final close creates a blank without readding the old tab',()=>{
  const f=fixture();f.controller.open('b');f.controller.close('b');assert.equal(f.controller.snapshot().active,'a');
  f.controller.close('a');assert.ok(f.controller.snapshot().active.startsWith('new'));assert.equal(f.controller.snapshot().ids.includes('a'),false);f.controller.dispose();
});
test('new command reopens a closed blank even when native startSession reuses it',()=>{
  const f=fixture();f.list.value.byId.a.blank=true;f.controller.close('a');assert.equal(f.controller.snapshot().ids.length,0);
  f.services.uiWorkspace.startSession=()=>{};f.controller.newSession();assert.deepEqual(plain(f.controller.snapshot().ids),['a']);f.controller.dispose();
});
test('reopen and reorder preserve identity and active selection',()=>{
  const f=fixture();f.controller.open('b');f.controller.open('c');f.controller.reorder('c','a');assert.deepEqual(plain(f.controller.snapshot().ids),['c','a','b']);
  f.controller.move('c',1);assert.deepEqual(plain(f.controller.snapshot().ids),['a','c','b']);assert.equal(f.controller.move('a',-1),false);
  f.controller.close('a');f.controller.reopen();assert.ok(f.controller.snapshot().ids.includes('a'));f.controller.dispose();
});
test('archived session is not navigated; host deletion and archive prune tabs',()=>{
  const f=fixture({raw:'{"version":1,"ids":["a","b","c"],"active":"a"}'});f.workspaces.value.archivedSessionIds=['b'];f.workspaces.emit();
  assert.equal(f.controller.open('b'),false);assert.equal(f.calls.some(c=>c[0]==='open'&&c[1]==='b'),false);
  delete f.list.value.byId.c;f.list.emit();assert.equal(f.controller.snapshot().ids.includes('c'),false);f.controller.dispose();
});
test('cross-window storage updates never change native current session',()=>{
  const f=fixture();f.controller.external('{"version":1,"enabled":true,"ids":["b","a"],"active":"b"}');
  assert.equal(f.controller.snapshot().active,'a');assert.equal(f.calls.some(c=>c[0]==='open'),false);assert.deepEqual(plain(f.controller.snapshot().ids),['b','a']);f.controller.dispose();
});
test('native view preserves draft ownership, survives private storage errors, and restores',()=>{
  const f=fixture();f.storage.setItem=()=>{throw Error('quota');};f.controller.setEnabled(false);assert.equal(f.controller.snapshot().enabled,false);assert.equal(f.refs[0].released,false);
  f.controller.setEnabled(true);assert.equal(f.controller.snapshot().enabled,true);assert.ok(f.refs.some(r=>!r.released));f.controller.dispose();
});
test('ready or navigation failure degrades to a notice without stopping native UI',async()=>{
  const f=fixture({rejectReady:true,failOpen:true});await Promise.resolve();assert.equal(f.controller.snapshot().notice,'Session unavailable');
  assert.equal(f.controller.open('b'),false);assert.equal(f.controller.snapshot().notice,'Could not open session');f.controller.dispose();
});
test('status projection includes completion and reconnect baseline without duplicate retains',()=>{
  const f=fixture();f.controller.open('b');f.status.value.set('a',{running:false,completionUnread:true});f.status.emit();assert.equal(f.controller.status('a'),'done');
  const count=f.calls.filter(c=>c[0]==='retain').length;f.list.emit();f.list.emit();assert.equal(f.calls.filter(c=>c[0]==='retain').length,count);f.controller.dispose();
});
test('dispose releases each reference once and removes every observable subscription',()=>{
  const f=fixture();f.controller.open('b');f.controller.dispose();f.controller.dispose();assert.ok(f.refs.every(r=>r.released));
  for(const observable of [f.list,f.status,f.workspaces,f.panel])assert.equal(observable.listeners.size,0);
});
test('implementation forbids client cloning, sidebar replacement, global keys and unscoped CSS',()=>{
  assert.doesNotMatch(source,/createElement\(['"]iframe|<iframe|window\.open\(|sidebarRight\.|name:\s*['"](?:rightbar|sidebar|root|main)['"]/);
  assert.doesNotMatch(source,/(?:document|window)\.addEventListener\(['"]keydown/);assert.match(source,/e\.isComposing\|\|e\.keyCode===229/);
  const {plugin}=load();assert.doesNotMatch(plugin.CSS,/[A-Za-z0-9_]{6,}_(?:root|header|frame)/);assert.match(plugin.CSS,/-webkit-app-region:no-drag/);
});
function mounted(setup){const f=fixture();f.controller.dispose();const dom=domFixture();setup?.(dom);const {plugin,window}=load(dom.extra);const ctx=new TestContext(f.services,plugin.inject);plugin.apply(ctx);dom.flush();return {...f,dom,plugin,window,ctx};}
test('actual apply mounts only the center and leaves both native sidebar nodes intact',()=>{
  const f=mounted();assert.equal(f.dom.center.firstChild.getAttribute('data-dsh-session-tabs'),'');assert.equal(f.dom.native.getAttribute('data-dsh-session-tabs-main'),'');
  assert.equal(f.dom.left.textContent,'native left');assert.equal(f.dom.right.textContent,'native right');assert.deepEqual(f.dom.left.attrs,{'data-slot':'sidebar'});assert.deepEqual(f.dom.right.attrs,{'data-slot':'rightbar'});
  assert.equal(f.ctx.registrations[0].meta.name,'sidebar.footer.action');assert.equal(f.dom.doc.querySelectorAll('[data-dsh-session-tabs]').length,1);f.ctx.dispose();
});
test('actual apply is idempotent and dispose removes DOM, styles, listeners, observers and refs',()=>{
  const f=mounted();f.plugin.apply(f.ctx);assert.equal(f.ctx.cleanups.length,1);f.ctx.dispose();f.dom.flush();
  assert.equal(f.dom.doc.querySelectorAll('[data-dsh-session-tabs]').length,0);assert.equal(f.dom.doc.querySelectorAll('[data-plugin="dsh-session-tabs"]').length,0);
  assert.equal(f.dom.center.hasAttribute('data-dsh-session-tabs-column'),false);assert.equal(f.dom.native.hasAttribute('data-dsh-session-tabs-main'),false);assert.equal(f.window.__dshSessionTabs,undefined);
  assert.equal(f.ctx.registrations.length,0);assert.ok(f.dom.observers.every(o=>o.stopped));assert.equal(f.dom.window.listeners.get('storage').size,0);assert.equal(f.dom.doc.listeners.get('pointerdown')?.size||0,0);assert.equal(f.list.listeners.size,0);
});
test('native mode and global panels restore original center sizing and hide only the strip',()=>{
  const f=mounted();f.window.__dshSessionTabs.enable(false);f.dom.flush();assert.equal(f.dom.center.firstChild.hidden,true);assert.equal(f.dom.native.hasAttribute('data-dsh-session-tabs-main'),false);
  f.window.__dshSessionTabs.enable(true);f.panel.value.activePanelId='settings';f.panel.emit();f.dom.flush();assert.equal(f.dom.center.firstChild.hidden,true);
  f.panel.value.activePanelId=null;f.panel.emit();f.dom.flush();assert.equal(f.dom.center.firstChild.hidden,false);f.ctx.dispose();
});
test('own mutations do not schedule an observer-render loop, and keyboard events are IME guarded',()=>{
  const f=mounted(),host=f.dom.center.firstChild,button=host.querySelector('[data-dsst-action="open"]');
  f.dom.observers[0].fn([{target:host}]);assert.equal(f.dom.timers.size,0);
  f.dom.observers[0].fn([{target:f.dom.native}]);assert.equal(f.dom.timers.size,0,'streaming chat mutations should not remount the strip');
  const before=f.calls.length;host.dispatch('keydown',{target:button,key:'ArrowRight',isComposing:true,preventDefault(){throw Error('IME must not be captured');}});assert.equal(f.calls.length,before);
  assert.equal(f.dom.doc.listeners.has('keydown'),false);f.ctx.dispose();
});
test('conversation remount re-marks the flex body synchronously, before the coalesced refresh',()=>{
  const f=mounted(),dom=f.dom,conv=dom.main.firstChild;
  const old=dom.native,fresh=dom.doc.createElement('div');
  conv.append(fresh);old.remove();
  dom.observers[0].fn([{type:'childList',target:conv,removedNodes:[old],addedNodes:[fresh]}]);
  assert.equal(fresh.hasAttribute('data-dsh-session-tabs-main'),true,'the new body must be marked in the same microtask');
  assert.equal(old.hasAttribute('data-dsh-session-tabs-main'),false);
  f.ctx.dispose();
});
test('replacing chat with a global panel does not create a hidden-attribute observer loop',()=>{
  const f=mounted(),dom=f.dom,host=dom.center.firstChild,old=dom.native;
  let hidden=host.hidden,writes=0;const mutations=[];
  // Like a browser, assigning HTMLElement.hidden queues an attribute mutation even if unchanged.
  Object.defineProperty(host,'hidden',{get:()=>hidden,set:value=>{hidden=!!value;writes++;mutations.push({type:'attributes',attributeName:'hidden',target:host});}});
  try{
    f.panel.value.activePanelId='plugins';f.panel.emit();
    const page=dom.doc.createElement('div');dom.main.replaceChildren(page);
    dom.observers[0].fn([{type:'childList',target:dom.main,removedNodes:[old],addedNodes:[page]}]);
    dom.flush();
    for(let round=0;round<20&&mutations.length;round++)dom.observers[0].fn(mutations.splice(0));
    assert.equal(mutations.length,0,'own hidden mutations must settle instead of starving the renderer');
    assert.ok(writes<=2,'hiding a global panel must not repeatedly mount a detached chat body');
    assert.equal(host.hidden,true);assert.equal(page.hasAttribute('data-dsh-session-tabs-main'),false);
    f.panel.value.activePanelId=null;dom.main.replaceChildren(old);f.panel.emit();dom.flush();
    assert.equal(host.hidden,false);assert.equal(old.hasAttribute('data-dsh-session-tabs-main'),true);
  }finally{f.ctx.dispose();}
});
function scrollScenario({height=2000,remembered=400}={}){
  const f=mounted(),dom=f.dom,host=dom.center.firstChild;
  const port=dom.doc.createElement('div');port.setAttribute('data-conversation-scroll','');port.scrollHeight=2000;port.clientHeight=500;
  let top=0;const writes=[];
  // Browsers clamp a restore while history is shorter than the viewport plus remembered offset.
  Object.defineProperty(port,'scrollTop',{get:()=>top,set:value=>{top=Math.max(0,Math.min(Number(value)||0,Math.max(0,port.scrollHeight-port.clientHeight)));writes.push({time:dom.time,top});}});
  const region=dom.doc.createElement('div');region.setAttribute('data-conversation-region','chat');region.setAttribute('data-conversation-session','a');
  const transcript=dom.doc.createElement('p'),composer=dom.doc.createElement('textarea'),seat=dom.doc.createElement('div'),widthControl=dom.doc.createElement('div');
  seat.setAttribute('data-composer-seat','');seat.setAttribute('data-conversation-region','composer');seat.append(composer);port.append(transcript,seat);region.append(port,widthControl);dom.native.append(region);
  const navigate=f.services.uiWorkspace.openSession;f.services.uiWorkspace.openSession=id=>{region.setAttribute('data-conversation-session',id);navigate(id);};
  port.scrollTop=remembered;
  const a=host.querySelector('[data-dsst-id="a"]'),plus=host.querySelector('[data-dsst-action="new"]');
  host.dispatch('click',{target:plus});port.scrollTop=0;port.scrollHeight=height;
  host.dispatch('click',{target:a});port.scrollTop=0;
  return {...f,host,port,region,transcript,composer,widthControl,writes,open:id=>host.dispatch('click',{target:host.querySelector('[data-dsst-id="'+id+'"]')})};
}
test('scroll restore waits through a temporarily stable short transcript, then restores after growth',()=>{
  const f=scrollScenario({height:600,remembered:600});try{
    f.dom.advance(100);assert.equal(f.port.scrollTop,100,'the first attempt must really clamp');
    f.dom.advance(120);assert.equal(f.port.scrollTop,100,'history can remain short through another attempt');
    f.port.scrollHeight=2000;f.dom.advance(240);
    assert.equal(f.port.scrollTop,600,'later transcript growth must still permit restoration');
    f.dom.flush();assert.equal(f.dom.timers.size,0);
  }finally{f.ctx.dispose();}
});
test('user wheel input takes priority before the first restore and after a clamped attempt',()=>{
  for(const beforeFirst of [true,false]){
    const f=scrollScenario({height:beforeFirst?2000:600});try{
      f.dom.advance(beforeFirst?50:100);f.dom.dispatch(f.transcript,'wheel',{deltaY:100});f.port.scrollTop=50;
      f.port.scrollHeight=2000;f.dom.advance(2500);
      assert.equal(f.port.scrollTop,50,beforeFirst?'first restore must yield to earlier input':'settling retries must not pull the user back');
      assert.equal(f.dom.timers.size,0);
    }finally{f.ctx.dispose();}
  }
});
test('touch, scrollbar dragging and scrolling keys cancel restoration without consuming input',()=>{
  for(const [type,props] of [['touchstart',{}],['pointerdown',{}],['keydown',{key:'PageUp'}],['keydown',{key:'ArrowUp'}],['keydown',{key:'Home'}],['keydown',{key:'End'}],['keydown',{key:' '}]]){
    const f=scrollScenario();try{
      f.dom.advance(50);let prevented=false;f.dom.dispatch(f.port,type,{...props,preventDefault(){prevented=true;}});f.port.scrollTop=120;f.dom.advance(2500);
      assert.equal(f.port.scrollTop,120,type+' '+(props.key||'')+' must cancel the queued restore');assert.equal(prevented,false,'native input must remain usable');
    }finally{f.ctx.dispose();}
  }
});
test('typing and pointer input in the composer do not cancel transcript restoration',()=>{
  const f=scrollScenario();try{
    f.dom.advance(50);
    for(const [type,props] of [['keydown',{key:'ArrowUp'}],['keydown',{key:' '}],['pointerdown',{}],['touchstart',{}]])f.dom.dispatch(f.composer,type,props);
    f.dom.advance(50);assert.equal(f.port.scrollTop,400);f.dom.flush();
  }finally{f.ctx.dispose();}
});
test('wheel input forwarded by the native width controls also cancels restoration',()=>{
  const f=scrollScenario();try{
    f.dom.advance(50);f.dom.dispatch(f.widthControl,'wheel',{deltaY:100});f.port.scrollTop=80;f.dom.advance(2500);
    assert.equal(f.port.scrollTop,80);
  }finally{f.ctx.dispose();}
});
test('non-scrolling keys and IME composition leave restoration queued',()=>{
  const f=scrollScenario();try{
    for(const props of [{key:'a'},{key:'ArrowUp',isComposing:true},{key:'PageDown',keyCode:229}])f.dom.dispatch(f.transcript,'keydown',props);
    f.dom.advance(100);assert.equal(f.port.scrollTop,400);
  }finally{f.ctx.dispose();}
});
test('a newly mounted transcript observes input before the first restore',()=>{
  const f=scrollScenario();try{
    const next=f.dom.doc.createElement('div');next.setAttribute('data-conversation-scroll','');next.scrollTop=0;next.scrollHeight=2000;next.clientHeight=500;
    f.port.remove();f.region.append(next);f.dom.observers[0].fn([{type:'childList',target:f.region,removedNodes:[f.port],addedNodes:[next]}]);
    f.dom.advance(50);f.dom.dispatch(next,'wheel',{deltaY:100});next.scrollTop=70;f.dom.advance(2500);
    assert.equal(next.scrollTop,70);for(const type of ['wheel','touchstart','pointerdown','keydown'])assert.equal(f.region.listeners.get(type)?.size||0,0);
  }finally{f.ctx.dispose();}
});
test('restoration never writes into a reused region showing another session',()=>{
  const f=scrollScenario();try{
    f.region.setAttribute('data-conversation-session','other');f.port.scrollTop=25;f.dom.advance(2500);
    assert.equal(f.port.scrollTop,25);
  }finally{f.ctx.dispose();}
});
test('an intervening scroll position change also stops restoration when no input event was observed',()=>{
  for(const beforeFirst of [true,false]){
    const f=scrollScenario({height:600});try{
      f.dom.advance(beforeFirst?50:100);f.port.scrollTop=60;f.port.scrollHeight=2000;f.dom.advance(2500);
      assert.equal(f.port.scrollTop,60,'a changed position must not be overwritten by a later attempt');
    }finally{f.ctx.dispose();}
  }
});
test('restoration stops after a bounded wait when history never grows',()=>{
  const f=scrollScenario({height:600});try{
    f.dom.advance(3000);assert.equal(f.port.scrollTop,100);assert.equal(f.dom.timers.size,0,'short content must not leave a permanent retry chain');
    const count=f.writes.length;f.port.scrollHeight=2000;f.dom.advance(10000);
    assert.equal(f.writes.length,count,'timed-out restoration must not resume itself');assert.equal(f.port.scrollTop,100);
  }finally{f.ctx.dispose();}
});
test('switching sessions, native view and disposal cancel outstanding restoration',()=>{
  for(const action of ['session','native','dispose']){
    const f=scrollScenario({height:600});try{
      f.dom.advance(100);
      if(action==='session')f.open(f.window.__dshSessionTabs.snapshot().ids.find(id=>id!=='a'));
      else if(action==='native')f.window.__dshSessionTabs.enable(false);
      else f.ctx.dispose();
      f.port.scrollTop=25;f.port.scrollHeight=2000;f.dom.advance(2500);
      assert.equal(f.port.scrollTop,25,action+' must cancel the pending conversation restore');assert.equal(f.dom.timers.size,0);
      if(action==='dispose')for(const node of [f.dom.doc,f.dom.main,f.region,f.port])for(const type of ['wheel','touchstart','pointerdown','keydown'])assert.equal(node.listeners.get(type)?.size||0,0,'scroll-intent listeners must be removed');
    }finally{f.ctx.dispose();}
  }
});
test('partial mount failure rolls back rather than blocking native UI',()=>{
  const f=fixture();f.controller.dispose();const dom=domFixture();dom.extra.window.getComputedStyle=()=>{throw Error('bad native structure');};
  const {plugin,window}=load(dom.extra);const ctx=new TestContext(f.services,plugin.inject);assert.doesNotThrow(()=>plugin.apply(ctx));dom.flush();
  assert.equal(window.__dshSessionTabs,undefined);assert.equal(dom.doc.querySelectorAll('[data-dsh-session-tabs]').length,0);assert.equal(f.list.listeners.size,0);assert.equal(ctx.warnings.length,1);
});
test('status, title and selection updates preserve tab nodes and focused controls',()=>{
  const f=mounted(),host=f.dom.center.firstChild,a=host.querySelector('[data-dsst-id="a"]'),plus=host.querySelector('[data-dsst-action="new"]');
  a.focus();f.status.value.set('a',{running:true});f.status.emit();f.dom.flush();
  assert.equal(host.querySelector('[data-dsst-id="a"]'),a);assert.equal(f.dom.doc.activeElement,a);
  f.list.value.byId.a.displayTitle='renamed';f.list.emit();f.dom.flush();assert.equal(a.textContent.includes('renamed'),true);
  host.dispatch('click',{target:plus});assert.equal(host.querySelector('[data-dsst-id="a"]'),a);
  assert.equal(host.querySelector('[data-dsst-action="new"]'),plus);assert.equal(host.querySelectorAll('[data-dsst-tab]').length,2);
  f.ctx.dispose();
});
test('removing options keeps native fallback and strip-local reopen, with IME guarding',()=>{
  const f=mounted(),host=f.dom.center.firstChild,plus=host.querySelector('[data-dsst-action="new"]');
  assert.equal(host.querySelector('[data-dsst-action="menu"]'),null);assert.equal(f.ctx.registrations[0].meta.id,'dsh-session-tabs:mode');
  host.dispatch('click',{target:plus});const id=f.window.__dshSessionTabs.snapshot().active;
  host.dispatch('click',{target:host.querySelectorAll('[data-dsst-action="close"]').find(b=>b.getAttribute('data-dsst-id')===id)});
  assert.equal(f.window.__dshSessionTabs.snapshot().ids.includes(id),false);
  host.dispatch('keydown',{target:plus,key:'T',metaKey:true,shiftKey:true,isComposing:true,preventDefault(){throw Error('IME must not be captured');}});
  assert.equal(f.window.__dshSessionTabs.snapshot().ids.includes(id),false);
  host.dispatch('keydown',{target:plus,key:'T',metaKey:true,shiftKey:true,preventDefault(){}});
  assert.equal(f.window.__dshSessionTabs.snapshot().active,id);assert.equal(f.dom.doc.listeners.has('keydown'),false);
  const list=host.querySelector('[role="tablist"]');f.ctx.dispose();assert.equal(list.listeners.get('scroll').size,0);
});
test('top panel controls relay native clicks, track native state and restore originals',()=>{
  let bottom,right,other,bottomClicks=0,rightClicks=0;
  const f=mounted(dom=>{
    bottom=dom.doc.createElement('button');bottom.setAttribute('data-dsh-bottom-toggle','');bottom.setAttribute('aria-label','展开底部面板');bottom.setAttribute('aria-pressed','false');bottom.append(dom.doc.createElement('svg'));
    bottom.addEventListener('click',()=>{bottomClicks++;bottom.setAttribute('aria-pressed','true');bottom.setAttribute('aria-label','收起底部面板');});
    right=dom.doc.createElement('button');right.setAttribute('data-sidebar-right-expand','');right.setAttribute('aria-label','打开右侧边栏');right.addEventListener('click',()=>rightClicks++);
    other=dom.doc.createElement('button');other.setAttribute('aria-label','其他操作');dom.native.append(bottom,right,other);
  });
  const host=f.dom.center.firstChild,b=host.querySelector('[data-dsst-action="bottom"]'),r=host.querySelector('[data-dsst-action="right"]');
  assert.equal(bottom.parentElement,f.dom.native);assert.equal(right.parentElement,f.dom.native);assert.equal(other.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
  assert.equal(bottom.hasAttribute('data-dsh-session-tabs-native-hidden'),true);assert.notEqual(b.firstChild,bottom.firstChild);
  host.dispatch('click',{target:b});f.dom.flush();assert.equal(bottomClicks,1);assert.equal(b.getAttribute('aria-pressed'),'true');assert.equal(b.getAttribute('aria-label'),'收起底部面板');
  host.dispatch('click',{target:r});assert.equal(rightClicks,1);right.disabled=true;host.dispatch('click',{target:r});assert.equal(rightClicks,1);
  f.window.__dshSessionTabs.enable(false);assert.equal(bottom.hasAttribute('data-dsh-session-tabs-native-hidden'),false);assert.equal(right.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
  f.window.__dshSessionTabs.enable(true);f.ctx.dispose();assert.equal(bottom.hasAttribute('data-dsh-session-tabs-native-hidden'),false);assert.equal(right.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
});
test('expanded right sidebar keeps only its native edge toggle and restores the opener after collapse',()=>{
  let expand,collapse,domRef;
  const f=mounted(dom=>{
    domRef=dom;expand=dom.doc.createElement('button');expand.setAttribute('data-sidebar-right-expand','');expand.setAttribute('aria-label','打开右侧边栏');
    collapse=dom.doc.createElement('button');collapse.setAttribute('data-sidebar-right-toggle','');collapse.setAttribute('aria-label','收起右侧边栏');
    expand.addEventListener('click',()=>{expand.remove();dom.right.append(collapse);});
    collapse.addEventListener('click',()=>{collapse.remove();dom.native.append(expand);});dom.native.append(expand);
  });
  const host=f.dom.center.firstChild,proxy=host.querySelector('[data-dsst-action="right"]');
  assert.equal(proxy.hidden,false);host.dispatch('click',{target:proxy});f.dom.flush();
  assert.equal(proxy.hidden,true);assert.equal(collapse.parentElement,domRef.right);assert.equal(collapse.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
  collapse.click();f.dom.observers[0].fn([{target:domRef.native,addedNodes:[expand]}]);f.dom.flush();assert.equal(proxy.hidden,false);
  f.window.__dshSessionTabs.enable(false);assert.equal(expand.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
  f.ctx.dispose();assert.equal(collapse.hasAttribute('data-dsh-session-tabs-native-hidden'),false);
});
test('native panel attributes win over a stale opener and update without a tab render delay',()=>{
  let expand,panel;
  const f=mounted(dom=>{
    expand=dom.doc.createElement('button');expand.setAttribute('data-sidebar-right-expand','');expand.append(dom.doc.createElement('svg'));dom.native.append(expand);
    panel=dom.doc.createElement('div');panel.setAttribute('data-sidebar-right-panel','push');panel.setAttribute('data-sidebar-right-session','a');dom.right.append(panel);
  });
  const proxy=f.dom.center.firstChild.querySelector('[data-dsst-action="right"]');assert.equal(proxy.hidden,false);
  panel.setAttribute('data-sidebar-right-open','');f.dom.observers[0].fn([{type:'attributes',target:panel,attributeName:'data-sidebar-right-open'}]);
  assert.equal(proxy.hidden,true,'attribute handoff must sync immediately, before timers');
  assert.equal(expand.hasAttribute('data-dsh-session-tabs-native-hidden'),true,'stale native opener must not flash back');f.ctx.dispose();
});
test('collapse handoff reserves the right slot and disables only its placeholder until the native opener returns',()=>{
  let expand,panel,bottomClicks=0;
  const f=mounted(dom=>{
    const bottom=dom.doc.createElement('button');bottom.setAttribute('data-dsh-bottom-toggle','');bottom.addEventListener('click',()=>bottomClicks++);dom.native.append(bottom);
    expand=dom.doc.createElement('button');expand.setAttribute('data-sidebar-right-expand','');expand.append(dom.doc.createElement('svg'));dom.native.append(expand);
    panel=dom.doc.createElement('div');panel.setAttribute('data-sidebar-right-panel','push');panel.setAttribute('data-sidebar-right-session','a');dom.right.append(panel);
  });
  const host=f.dom.center.firstChild,proxy=host.querySelector('[data-dsst-action="right"]'),slot=proxy.parentElement;
  expand.remove();panel.setAttribute('data-sidebar-right-open','');f.dom.observers[0].fn([{type:'attributes',target:panel}]);assert.equal(proxy.hidden,true);
  panel.removeAttribute('data-sidebar-right-open');f.dom.observers[0].fn([{type:'attributes',target:panel}]);
  assert.equal(proxy.parentElement,slot);assert.equal(slot.hasAttribute('data-dsst-right-slot'),true);assert.equal(proxy.hidden,false);assert.equal(proxy.disabled,true);
  host.dispatch('click',{target:proxy});assert.equal(bottomClicks,0);assert.equal(host.querySelector('[data-dsst-action="bottom"]').disabled,false);
  f.dom.native.append(expand);f.dom.observers[0].fn([{type:'childList',target:f.dom.native,addedNodes:[expand]}]);
  assert.equal(proxy.disabled,false);assert.equal(proxy.hidden,false);f.ctx.dispose();
});
test('native panel sources ignore hidden retained session headers',()=>{
  let wrong=0,right=0;
  const f=mounted(dom=>{
    const old=dom.doc.createElement('div');old.setAttribute('hidden','');dom.native.append(old);
    for(const container of [old,dom.native]){
      const b=dom.doc.createElement('button');b.setAttribute('data-sidebar-right-expand','');b.addEventListener('click',()=>{if(container===old)wrong++;else right++;});container.append(b);
    }
  });
  const host=f.dom.center.firstChild;host.dispatch('click',{target:host.querySelector('[data-dsst-action="right"]')});assert.equal(right,1);assert.equal(wrong,0);f.ctx.dispose();
});
