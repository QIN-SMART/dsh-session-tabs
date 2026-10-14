// One client, one native conversation. The strip never owns either sidebar.
window.__ModuleLoader__.load({
  id: 'dsh-session-tabs',
  factory: (require) => {
    var React = require('react');
    var KEY = 'dsh-session-tabs.v1', GLOBAL = '__dshSessionTabs', SOURCE = 'dsh-session-tabs';
    var WORDS = {
      zh: {tabs:'会话标签',new:'新会话',close:'关闭标签',closed:'恢复刚关闭的标签',native:'原生视图',enable:'显示会话标签',openRight:'打开右侧边栏',running:'运行中',pending:'等待确认',done:'已完成 · 未读',idle:'空闲',loading:'正在连接',archived:'已归档，请先在左栏恢复',unavailable:'会话暂不可用',failed:'无法打开会话',hint:'拖动调整顺序；Alt + Shift + 方向键移动标签；标签栏内 ⌘/Ctrl + Shift + T 恢复关闭的标签'},
      en: {tabs:'Session tabs',new:'New session',close:'Close tab',closed:'Reopen closed tab',native:'Native view',enable:'Show session tabs',openRight:'Open right sidebar',running:'Running',pending:'Needs attention',done:'Completed · unread',idle:'Idle',loading:'Connecting',archived:'Archived: restore it in the sidebar first',unavailable:'Session unavailable',failed:'Could not open session',hint:'Drag to reorder; Alt + Shift + arrows move a tab; Cmd/Ctrl + Shift + T reopens a tab while this strip has focus'}
    };
    var CSS = `
[data-dsh-session-tabs-column]{min-height:0}
[data-dsh-session-tabs-main]{flex:1 1 0!important;min-height:0!important;height:auto!important}
.dsst-host{--dsst-page:var(--dsw-alias-bg-base);--dsst-line:var(--dsw-alias-border-l3);--dsst-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,var(--dsst-page));--dsst-strip:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,var(--dsst-page));box-sizing:border-box;flex:0 0 auto;min-width:0;max-width:100%;color:var(--dsw-alias-label-primary);background:var(--dsst-strip);font-family:inherit;font-size:14px;line-height:20px;-webkit-app-region:no-drag;padding-inline-start:var(--dsh-frame-leading-clearance,0px)}
.dsst-host[hidden]{display:none!important}
.dsst-strip{box-sizing:border-box;display:flex;min-width:0;align-items:stretch;height:47px;padding:7px 8px 0 12px;border-bottom:1px solid var(--dsst-line);position:relative}
html[data-platform=darwin] .dsst-strip{height:48px}
.dsst-list{display:flex;flex:0 1 auto;min-width:0;gap:2px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}
.dsst-list::-webkit-scrollbar{display:none}
.dsst-spacer{flex:1;min-width:4px}
.dsst-panels{display:flex;align-items:center;align-self:flex-start;flex:0 0 auto;gap:4px;height:28px;margin-top:3px;margin-inline-end:-2px;padding:0 0 0 2px}
.dsst-panel-button{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:28px;height:28px;padding:0;color:var(--dsw-alias-label-secondary)!important}
.dsst-panel-button[data-dsst-action=bottom]{border-radius:50%}
.dsst-panel-button[data-dsst-action=bottom] svg{width:16px;height:16px}
.dsst-panel-button[data-dsst-action=right] svg{width:15px;height:15px}
.dsst-panel-button[hidden]{display:none!important}
.dsst-panel-button:disabled{opacity:.4;cursor:default}
.dsst-right-slot{display:flex;flex:0 0 28px;width:28px;height:28px}
.dsst-panel-button[aria-pressed=true]{background:var(--dsst-hover)}
[data-dsh-session-tabs-native-hidden]{display:none!important}
.dsst-tab{box-sizing:border-box;display:flex;flex:0 0 auto;align-items:center;position:relative;min-width:78px;max-width:210px;padding:0 5px 0 10px;color:var(--dsw-alias-label-secondary);border:1px solid transparent;border-radius:16px 16px 0 0;z-index:0}
.dsst-tab[data-active=true]{background:var(--dsst-page);color:var(--dsw-alias-label-primary);border-color:var(--dsst-line);border-bottom-color:var(--dsst-page);box-shadow:0 -2px 5px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);z-index:1}
.dsst-tab[data-active=false]:is(:hover,:focus-within)::before{content:"";position:absolute;inset:3px 3px 4px;border-radius:12px;background:var(--dsst-hover);pointer-events:none}
.dsst-tab>button{position:relative;z-index:1}
.dsst-host button,.dsst-mode-button{font:inherit;color:inherit;border:0;background:transparent;border-radius:6px;cursor:pointer;-webkit-app-region:no-drag}
.dsst-host button:hover:not(.dsst-select):not(.dsst-close){background:var(--dsst-hover)}
.dsst-mode-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsst-host button.dsst-select:is(:hover,:active,:focus){background:transparent}
.dsst-tab[data-active=false] .dsst-close:hover{background:transparent}
.dsst-tab[data-active=true] .dsst-close:hover{background:var(--dsst-hover);border-radius:50%}
.dsst-host button:focus-visible,.dsst-mode-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.dsst-select{display:flex;gap:7px;align-items:center;flex:1;min-width:0;height:100%;padding:0 12px 0 0}
.dsst-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.dsst-dot{width:14px;text-align:center;flex:0 0 auto;color:var(--dsw-alias-label-tertiary)}
.dsst-dot[data-status=idle]{display:none}
.dsst-dot[data-status=running]{color:var(--dsw-alias-state-business-primary)}
.dsst-dot[data-status=pending]{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-state-business-primary))}
.dsst-dot[data-status=done]{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.dsst-close{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:25px;height:25px;padding:0;color:var(--dsw-alias-label-secondary)!important}
.dsst-close svg{width:14px;height:14px}
.dsst-tab[data-active=false] .dsst-close{opacity:.65}
.dsst-tab:is(:hover,:focus-within) .dsst-close{opacity:1}
.dsst-tools{display:flex;align-items:center;flex:0 0 auto;padding:0 4px}
.dsst-tools>button{display:flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;color:var(--dsw-alias-label-secondary)}
.dsst-tools svg{width:18px;height:18px}
.dsst-join{position:absolute;bottom:-1px;height:12px;pointer-events:none;z-index:3}
.dsst-join[hidden],.dsst-tail[hidden]{display:none!important}
.dsst-join-base{position:absolute;inset:auto 0 0;height:2px;background:var(--dsst-page)}
.dsst-tail{position:absolute;bottom:0;width:13px;height:13px}
.dsst-tail-left{left:-12px;background:radial-gradient(circle at left top,transparent calc(12px - .8px),var(--dsst-line) 12px,var(--dsst-page) calc(12px + .8px))}
.dsst-tail-right{right:-12px;background:radial-gradient(circle at right top,transparent calc(12px - .8px),var(--dsst-line) 12px,var(--dsst-page) calc(12px + .8px))}
.dsst-notice{padding:5px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dsst-notice[hidden]{display:none!important}
.dsst-mode-button{display:flex;align-items:center;justify-content:center;padding:4px;width:32px;height:32px;flex:0 0 auto}
.dsst-mode-button svg{display:block;width:18px;height:18px}
`;
    function validId(id) {return typeof id==='string'&&id.length>0&&id.length<=512&&!/[\u0000-\u001f]/.test(id);}
    function parse(raw) {
      var value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch(_){value=null;}
      if(!value||value.version!==1)return {version:1,enabled:true,ids:[],active:null};
      var ids=[...new Set((Array.isArray(value.ids)?value.ids:[]).filter(validId))].slice(0,200);
      return {version:1,enabled:value.enabled!==false,ids:ids,active:ids.includes(value.active)?value.active:null};
    }
    function serial(s){return JSON.stringify({version:1,enabled:s.enabled,ids:s.ids,active:s.active});}
    function current(list){return Object.keys(list.byId||{}).find(id=>(list.byId[id].retainedBy?.mainView||0)>0)||null;}
    function createController(ctx,options){
      options=options||{};var ls=options.storage,state;
      try{state=parse(ls?.getItem(KEY));}catch(_){state=parse(null);}
      var savedActive=options.restoreActive===false?null:state.active;
      var refs=new Map(),observers=new Set(),disposers=[],closed=[],scrolls=new Map(),saveTimer=null;
      var list=ctx.sessions.list.getSnapshot(),suppressed=null,syncing=false,again=false,alive=true,notice='',lastMain=null,restored=false;
      var changed=options.changed||function(){},getLang=options.lang||function(){return 'en';};
      var beforeNavigate=options.beforeNavigate||function(){},afterNavigate=options.afterNavigate||function(){};
      function words(){return WORDS[getLang()]||WORDS.en;}
      function saveNow(){try{ls?.setItem(KEY,serial(state));}catch(_){}}
      function persist(){if(!ls||saveTimer!==null)return;saveTimer=setTimeout(()=>{saveTimer=null;saveNow();},50);}
      function emit(){observers.forEach(fn=>{try{fn();}catch(_){}});changed();}
      function status(id){
        var live=ctx.uiSession.sessionStatus.getSnapshot().get(id);
        if(live?.pendingInteraction)return 'pending';
        if(live?.running||list.byId[id]?.running)return 'running';
        if(live?.completionUnread)return 'done';
        return list.byId[id]?'idle':'loading';
      }
      function archived(id){return (ctx.workspaces.list.getSnapshot().archivedSessionIds||[]).includes(id);}
      function release(id){var ref=refs.get(id);refs.delete(id);if(ref)try{ref.release();}catch(_){}}
      function retain(id){
        if(refs.has(id)||!list.byId[id])return;
        refs.set(id,null); // retain publishes counts synchronously
        try{var ref=ctx.sessions.retain(id,{source:SOURCE});refs.set(id,ref);ref.ready.catch(()=>{if(alive){notice=words().unavailable;emit();}});}
        catch(_){refs.delete(id);notice=words().unavailable;}
      }
      function navigate(id){
        if(!validId(id)||!list.byId[id]){notice=words().unavailable;emit();return false;}
        if(archived(id)){notice=words().archived;emit();return false;}
        beforeNavigate(lastMain,id);retain(id);
        try{ctx.uiWorkspace.openSession(id);return true;}catch(_){notice=words().failed;emit();return false;}
      }
      function sync(){
        if(!alive)return;if(syncing){again=true;return;}syncing=true;
        try{do{
          again=false;list=ctx.sessions.list.getSnapshot();var id=current(list);
          if(suppressed&&id!==suppressed)suppressed=null;
          if(list.phase==='ready'){var filtered=state.ids.filter(s=>!!list.byId[s]&&!archived(s));if(filtered.length!==state.ids.length){state.ids=filtered;persist();}}
          if(id&&id!==suppressed){
            if(state.enabled){if(!state.ids.includes(id)){state.ids.push(id);persist();}retain(id);}
            var switched=lastMain!==id;if(switched&&lastMain)beforeNavigate(lastMain,id);lastMain=id;
            if(state.active!==id){state.active=id;persist();}if(switched)afterNavigate(id,scrolls.get(id));
          }
          if(!restored&&list.phase==='ready'){restored=true;if(savedActive&&state.enabled&&state.ids.includes(savedActive)&&id!==savedActive)navigate(savedActive);}
          for(var retained of [...refs.keys()]){var busy=status(retained)==='running'||status(retained)==='pending';if(!list.byId[retained]||(!state.ids.includes(retained)&&!busy))release(retained);}
        }while(again);}finally{syncing=false;}emit();
      }
      disposers.push(ctx.sessions.list.subscribe(sync),ctx.uiSession.sessionStatus.subscribe(sync),ctx.workspaces.list.subscribe(sync),ctx.layout.panelInfo.subscribe(emit));
      var api={
        words:words,status:status,
        snapshot:()=>({enabled:state.enabled,ids:state.ids.slice(),active:lastMain,notice:notice,panel:ctx.layout.panelInfo.getSnapshot().activePanelId,rows:state.ids.map(id=>({id,title:list.byId[id]?.blank?words().new:list.byId[id]?.displayTitle||list.byId[id]?.title||id,status:status(id)})),retained:refs.size}),
        subscribe:fn=>{observers.add(fn);return()=>observers.delete(fn);},
        open:id=>{notice='';if(!state.ids.includes(id)&&validId(id)){state.ids.push(id);persist();}return navigate(id);},
        close:id=>{
          var index=state.ids.indexOf(id);if(index<0)return false;suppressed=id===lastMain?id:suppressed;
          state.ids.splice(index,1);closed=closed.filter(x=>x!==id);closed.push(id);closed=closed.slice(-20);persist();
          if(id===lastMain){var next=state.ids[Math.min(index,state.ids.length-1)];if(next)navigate(next);else if(!list.byId[id]?.blank){beforeNavigate(id,null);try{ctx.uiWorkspace.startSession();}catch(_){notice=words().failed;}}}
          sync();return true;
        },
        reopen:()=>{var id=closed.pop();return id?api.open(id):false;},
        reorder:(id,before)=>{if(id===before||!state.ids.includes(id)||!state.ids.includes(before))return false;state.ids.splice(state.ids.indexOf(id),1);state.ids.splice(state.ids.indexOf(before),0,id);persist();emit();return true;},
        move:(id,offset)=>{var i=state.ids.indexOf(id),j=i+offset;if(i<0||j<0||j>=state.ids.length)return false;state.ids.splice(i,1);state.ids.splice(j,0,id);persist();emit();return true;},
        newSession:()=>{notice='';suppressed=null;beforeNavigate(lastMain,null);try{ctx.uiWorkspace.startSession();sync();}catch(_){notice=words().failed;emit();}},
        setEnabled:value=>{state.enabled=!!value;persist();if(state.enabled)sync();emit();},
        external:raw=>{var next=parse(raw);state.ids=[...new Set([...next.ids,...state.ids])];state.enabled=next.enabled;state.active=lastMain;if(lastMain&&!state.ids.includes(lastMain))state.ids.push(lastMain);sync();},
        dismiss:()=>{notice='';emit();},scrolls:scrolls,sync:sync,
        dispose:()=>{if(!alive)return;alive=false;if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;saveNow();}disposers.forEach(fn=>fn());disposers=[];for(var id of [...refs.keys()])release(id);observers.clear();scrolls.clear();}
      };
      sync();return api;
    }
    function install(ctx){
      var alive=true,observer,nativeObserver,resizeObserver,timer=null,restoreTimer=null,host,center,mainBody,style,ctrl;
      var strip,list,tools,join,joinLeft,joinRight,notice,panels,dragging=null,lastSignature='',cells=new Map(),hiddenNative=new Set();
      var panelBindings={bottom:null,right:null},panelButtons={},panelIcons={};
      var stats={renders:0,totalMs:0,maxMs:0},lastRevealed=null;
      var panel=ctx.layout.panelInfo,local;try{local=window.localStorage;}catch(_){local=null;}
      function lang(){return String(document.documentElement.lang||navigator.language||'en').startsWith('zh')?'zh':'en';}
      function now(){return window.performance?.now?.()??Date.now();}
      function attr(el,key,value){value=String(value);if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
      function scrollport(){return document.querySelector('[data-conversation-scroll]');}
      function capture(id){var el=scrollport();if(id&&el&&ctrl)ctrl.scrolls.set(id,el.scrollTop);}
      function restore(id,top){if(restoreTimer!==null)clearTimeout(restoreTimer);if(typeof top==='number')restoreTimer=setTimeout(()=>{restoreTimer=null;var el=scrollport();if(alive&&ctrl.snapshot().active===id&&el)el.scrollTop=top;},100);}
      function refresh(){if(!alive||!ctrl)return;if(timer!==null){clearTimeout(timer);timer=null;}var start=now();mount();render();var elapsed=now()-start;stats.renders++;stats.totalMs+=elapsed;stats.maxMs=Math.max(stats.maxMs,elapsed);}
      function schedule(){if(!alive||timer!==null)return;timer=setTimeout(()=>{timer=null;refresh();},16);}
      ctrl=createController(ctx,{storage:local,lang:lang,changed:()=>{if(host&&ctrl)schedule();},beforeNavigate:capture,afterNavigate:restore});
      var global={snapshot:ctrl.snapshot,enable:value=>{ctrl.setEnabled(value);refresh();},metrics:()=>({...stats}),dispose:dispose};window[GLOBAL]=global;
      function unmark(){center?.removeAttribute('data-dsh-session-tabs-column');mainBody?.removeAttribute('data-dsh-session-tabs-main');center=null;mainBody=null;}
      function button(label,text,attrs){var b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=text;Object.keys(attrs||{}).forEach(k=>b.setAttribute(k,attrs[k]));return b;}
      function glyphButton(kind,attrs){var b=button('','',attrs);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="'+(kind==='plus'?'M12 5v14M5 12h14':'M6 6l12 12M18 6L6 18')+'"/></svg>';return b;}
      function revealActive(){if(alive&&host&&!host.hidden)cells.get(ctrl.snapshot().active)?.cell.scrollIntoView?.({block:'nearest',inline:'nearest'});}
      // Draw outside the scrolling list so its overflow cannot clip the reverse corners.
      function placeJoin(){
        if(!alive||!join)return;var active=cells.get(ctrl.snapshot().active)?.cell;
        if(host.hidden||!active?.getBoundingClientRect){join.hidden=true;return;}
        var a=active.getBoundingClientRect(),v=list.getBoundingClientRect(),bar=strip.getBoundingClientRect();
        var left=Math.max(a.left,v.left),right=Math.min(a.right,v.right);join.hidden=right<=left||a.height===0;
        if(join.hidden)return;join.style.left=(left-bar.left)+'px';join.style.width=(right-left)+'px';
        joinLeft.hidden=a.left<v.left-.5;joinRight.hidden=a.right>v.right+.5;
      }
      function chrome(){
        host=document.createElement('div');host.className='dsst-host';host.setAttribute('data-dsh-session-tabs','');bindHost();
        strip=document.createElement('div');strip.className='dsst-strip';
        list=document.createElement('div');list.className='dsst-list';list.setAttribute('role','tablist');
        list.addEventListener('scroll',placeJoin,{passive:true});
        if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>{revealActive();placeJoin();});resizeObserver.observe(list);resizeObserver.observe(strip);}
        tools=document.createElement('div');tools.className='dsst-tools';
        tools.append(glyphButton('plus',{'data-dsst-action':'new'}));
        var spacer=document.createElement('div');spacer.className='dsst-spacer';
        panels=document.createElement('div');panels.className='dsst-panels';
        for(var kind of ['bottom','right']){var b=button('','',{'data-dsst-action':kind});b.className='dsst-panel-button';b.hidden=true;panelButtons[kind]=b;if(kind==='right'){var rightSlot=document.createElement('div');rightSlot.className='dsst-right-slot';rightSlot.setAttribute('data-dsst-right-slot','');rightSlot.append(b);panels.append(rightSlot);}else panels.append(b);}
        strip.append(list,tools,spacer,panels);host.append(strip);
        join=document.createElement('div');join.className='dsst-join';join.hidden=true;join.setAttribute('aria-hidden','true');
        joinLeft=document.createElement('span');joinLeft.className='dsst-tail dsst-tail-left';
        joinRight=document.createElement('span');joinRight.className='dsst-tail dsst-tail-right';
        var base=document.createElement('span');base.className='dsst-join-base';join.append(joinLeft,base,joinRight);strip.append(join);
        notice=document.createElement('div');notice.className='dsst-notice';notice.setAttribute('role','status');host.append(notice);
      }
      function mount(){
        var slot=document.querySelector('#root [data-slot="main"]');if(!slot||!slot.parentElement)return;
        var column=slot.parentElement;while(column.hasAttribute('data-slot')&&column.parentElement)column=column.parentElement;
        if(center!==column){unmark();center=column;}
        if(!host)chrome();if(host.parentElement!==center)center.insertBefore(host,center.firstChild);
        var visible=ctrl.snapshot().enabled&&panel.getSnapshot().activePanelId===null;host.hidden=!visible;
        if(visible){
          center.setAttribute('data-dsh-session-tabs-column','');
          // A retained body needs no style read on every session/status notification.
          if(!mainBody||!slot.contains(mainBody)){mainBody?.removeAttribute('data-dsh-session-tabs-main');var next=slot.firstElementChild;while(next&&window.getComputedStyle(next).display==='contents')next=next.firstElementChild;mainBody=next;}
          mainBody?.setAttribute('data-dsh-session-tabs-main','');
        }else{mainBody?.removeAttribute('data-dsh-session-tabs-main');center.removeAttribute('data-dsh-session-tabs-column');}
      }
      function nativeSources(){
        var root=document.querySelector('#root [data-slot="main"]'),id=ctrl.snapshot().active;
        function foreground(b){return !b.closest('[hidden]')&&!b.closest('[aria-hidden="true"]');}
        var bottom=[...(root?.querySelectorAll('[data-dsh-bottom-toggle]')||[])].find(foreground)||null;
        var right=[...(root?.querySelectorAll('[data-sidebar-right-expand]')||[])].find(foreground)||null;
        var rightOpener=right;
        var rightPanel=[...document.querySelectorAll('[data-sidebar-right-panel]')].find(p=>p.getAttribute('data-sidebar-right-session')===id&&!p.closest('[hidden]'))||null;
        // The native panel state outranks opener presence during React/animation handoffs.
        if(rightPanel?.hasAttribute('data-sidebar-right-open'))right=null;
        return {bottom:bottom,right:right,rightPanel:rightPanel,rightOpener:rightOpener};
      }
      function restoreNative(){hiddenNative.forEach(b=>b.removeAttribute('data-dsh-session-tabs-native-hidden'));hiddenNative.clear();}
      function syncIcon(kind,source,b){
        var svg=source.querySelector('svg'),iconKey=svg?.outerHTML||source;
        if(panelIcons[kind]!==iconKey){panelIcons[kind]=iconKey;b.replaceChildren();if(svg)b.append(svg.cloneNode(true));else b.textContent=kind==='right'?'▥':'▤';}
      }
      function syncPanels(){
        if(!alive||!panels)return;
        var visible=!host.hidden,sources=visible?nativeSources():{bottom:null,right:null};
        var changed=sources.bottom!==panelBindings.bottom||sources.right!==panelBindings.right;
        if(changed){nativeObserver?.disconnect();for(var kind of ['bottom','right']){var source=sources[kind];if(source)nativeObserver?.observe(source,{attributes:true,attributeFilter:['aria-label','aria-pressed','disabled']});}panelBindings=sources;}
        var hiddenNow=new Set();if(sources.rightOpener)hiddenNow.add(sources.rightOpener);
        for(var kind of ['bottom','right']){
          var source=sources[kind],b=panelButtons[kind],rightPanel=sources.rightPanel;
          if(kind==='right'&&!source&&rightPanel&&!panelIcons.right){var collapse=rightPanel.querySelector('[data-sidebar-right-toggle]');if(collapse)syncIcon(kind,collapse,b);}
          var waiting=kind==='right'&&!source&&rightPanel&&!rightPanel.hasAttribute('data-sidebar-right-open')&&!!panelIcons.right;
          b.hidden=!source&&!waiting;b.disabled=!source||!!source.disabled;attr(b,'data-dsst-pending',!!waiting);
          if(!source){if(waiting){var opening=ctrl.words().openRight;attr(b,'aria-label',opening);attr(b,'aria-pressed',false);b.title=opening;}continue;}
          var label=source.getAttribute('aria-label')||source.title||'';attr(b,'aria-label',label);b.title=label;b.disabled=!!source.disabled;
          var pressed=kind==='right'?!source.hasAttribute('data-sidebar-right-expand'):source.getAttribute('aria-pressed')==='true';attr(b,'aria-pressed',pressed);
          syncIcon(kind,source,b);
          // Leave the right panel's own collapse control in its original place.
          if(kind==='bottom'||source.hasAttribute('data-sidebar-right-expand'))hiddenNow.add(source);
        }
        hiddenNative.forEach(b=>{if(!hiddenNow.has(b))b.removeAttribute('data-dsh-session-tabs-native-hidden');});
        hiddenNow.forEach(b=>{if(!b.hasAttribute('data-dsh-session-tabs-native-hidden'))b.setAttribute('data-dsh-session-tabs-native-hidden','');});hiddenNative=hiddenNow;
      }
      function createCell(row){
        var cell=document.createElement('div');cell.className='dsst-tab';cell.setAttribute('data-dsst-tab',row.id);cell.draggable=true;
        var select=button('','',{'data-dsst-action':'open','data-dsst-id':row.id,role:'tab'});select.className='dsst-select';
        var dot=document.createElement('span');dot.className='dsst-dot';dot.setAttribute('aria-hidden','true');
        var label=document.createElement('span');label.className='dsst-title';select.append(dot,label);
        var close=glyphButton('close',{'data-dsst-action':'close','data-dsst-id':row.id});close.className='dsst-close';cell.append(select,close);
        return {cell,select,dot,label,close};
      }
      function render(){
        if(!host)return;var s=ctrl.snapshot(),w=ctrl.words(),signature=JSON.stringify([s.enabled,s.rows,s.active,s.notice,lang()]),changed=signature!==lastSignature;
        if(changed){
          lastSignature=signature;attr(host,'aria-label',w.tabs);attr(list,'aria-label',w.tabs);list.title=w.hint;
          var keep=new Set(s.ids),focus=document.activeElement;
          for(var [id,entry] of cells){if(!keep.has(id)){entry.cell.remove();cells.delete(id);}}
          var cursor=list.firstChild;
          s.rows.forEach(row=>{
            var e=cells.get(row.id);if(!e){e=createCell(row);cells.set(row.id,e);}
            attr(e.cell,'data-active',row.id===s.active);attr(e.select,'aria-selected',row.id===s.active);
            var label=row.title+' — '+w[row.status];attr(e.select,'aria-label',label);e.select.title=label;
            attr(e.dot,'data-status',row.status);var mark=({running:'●',pending:'!',done:'✓',loading:'…',idle:'○'})[row.status];if(e.dot.textContent!==mark)e.dot.textContent=mark;
            if(e.label.textContent!==row.title)e.label.textContent=row.title;
            var close=w.close+': '+row.title;attr(e.close,'aria-label',close);e.close.title=close;
            if(e.cell!==cursor)list.insertBefore(e.cell,cursor);cursor=e.cell.nextSibling;
          });
          var plus=tools.querySelector('[data-dsst-action="new"]');attr(plus,'aria-label',w.new);plus.title=w.new;
          notice.hidden=!s.notice;if(notice.textContent!==s.notice)notice.textContent=s.notice;
          if(focus&&host.contains(focus)&&document.activeElement!==focus)focus.focus({preventScroll:true});
        }
        syncPanels();
        if(s.active!==lastRevealed){lastRevealed=s.active;revealActive();}
        if(changed)placeJoin();
      }
      function bindHost(){
        host.addEventListener('click',e=>{
          var b=e.target.closest('[data-dsst-action]');if(!b||!host.contains(b)||b.disabled)return;var action=b.getAttribute('data-dsst-action'),id=b.getAttribute('data-dsst-id');
          if(action==='open')ctrl.open(id);else if(action==='close')ctrl.close(id);else if(action==='new')ctrl.newSession();
          else if(action==='bottom'||action==='right'){var source=nativeSources()[action];if(source&&!source.disabled)source.click();schedule();return;}
          refresh();
        });
        host.addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229)return;if((e.metaKey||e.ctrlKey)&&e.shiftKey&&String(e.key).toLowerCase()==='t'){e.preventDefault();ctrl.reopen();refresh();return;}var b=e.target.closest('[data-dsst-action="open"]');if(!b)return;var id=b.getAttribute('data-dsst-id'),ids=ctrl.snapshot().ids,i=ids.indexOf(id),delta=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!delta)return;e.preventDefault();if(e.altKey&&e.shiftKey)ctrl.move(id,delta);else ctrl.open(ids[(i+delta+ids.length)%ids.length]);refresh();});
        host.addEventListener('dragstart',e=>{var cell=e.target.closest('[data-dsst-tab]');if(!cell)return;dragging=cell.getAttribute('data-dsst-tab');e.dataTransfer?.setData('text/plain',dragging);});
        host.addEventListener('dragover',e=>{if(dragging&&e.target.closest('[data-dsst-tab]'))e.preventDefault();});
        host.addEventListener('drop',e=>{var cell=e.target.closest('[data-dsst-tab]');if(dragging&&cell){e.preventDefault();ctrl.reorder(dragging,cell.getAttribute('data-dsst-tab'));}dragging=null;});host.addEventListener('dragend',()=>{dragging=null;});
      }
      style=document.createElement('style');style.setAttribute('data-plugin','dsh-session-tabs');style.setAttribute('data-plugin-css','dsh-session-tabs/style');style.textContent=CSS;document.head.append(style);
      function hasControl(node){return ['data-dsh-bottom-toggle','data-sidebar-right-expand','data-sidebar-right-toggle','data-sidebar-right-panel'].some(key=>node.hasAttribute?.(key)||node.querySelector?.('['+key+']'));}
      observer=new MutationObserver(records=>{
        // React can switch visibility/state without inserting a new node. Sync panel controls
        // in this microtask; the tab render can stay coalesced and streaming stays ignored.
        if(records.some(r=>{
          var node=r.target;if(host&&(node===host||host.contains(node)))return false;
          if(r.type==='attributes')return hasControl(node);
          if(['data-dsh-bottom-toggle','data-sidebar-right-expand','data-sidebar-right-toggle','data-sidebar-right-panel'].some(key=>node.hasAttribute?.(key)))return true;
          if(node.closest?.('[data-slot="conversation.session.header.corner"]')||node.closest?.('[data-slot="conversation.session.header.utilities"]'))return true;
          return [...(r.addedNodes||[]),...(r.removedNodes||[])].some(hasControl);
        }))syncPanels();
        if(records.some(r=>{
          if(host&&(r.target===host||host.contains(r.target)))return false;
          if(mainBody&&(r.target===mainBody||mainBody.contains(r.target))){
            if(r.target.closest?.('[data-slot="conversation.session.header.corner"]')||r.target.closest?.('[data-slot="conversation.session.header.utilities"]'))return true;
            return [...(r.addedNodes||[]),...(r.removedNodes||[])].some(hasControl);
          }
          return true;
        }))schedule();
      });observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','data-sidebar-right-open','data-sidebar-right-session']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
      nativeObserver=new MutationObserver(()=>{if(alive)syncPanels();});
      function storageEvent(e){if(e.key===KEY&&(!e.storageArea||e.storageArea===local))ctrl.external(e.newValue);}
      window.addEventListener('storage',storageEvent);
      refresh();
      function ModeGlyph(){return React.createElement('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'},React.createElement('rect',{x:3,y:3,width:18,height:18,rx:2}),React.createElement('path',{d:'M3 9h18M9 9v12'}));}
      var slotDispose=ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'dsh-session-tabs:mode',order:80},function ModeToggle(){var pair=React.useState(0);React.useEffect(()=>ctrl.subscribe(()=>pair[1](n=>n+1)),[]);var w=ctrl.words(),enabled=ctrl.snapshot().enabled,label=enabled?w.native:w.enable;return React.createElement('button',{type:'button',className:'dsst-mode-button','data-dsst-mode':'','aria-label':label,'aria-pressed':enabled,title:label,onClick:()=>ctrl.setEnabled(!ctrl.snapshot().enabled)},React.createElement(ModeGlyph));}));
      function dispose(){if(!alive)return;alive=false;if(timer!==null)clearTimeout(timer);if(restoreTimer!==null)clearTimeout(restoreTimer);observer?.disconnect();nativeObserver?.disconnect();resizeObserver?.disconnect();list?.removeEventListener('scroll',placeJoin);restoreNative();slotDispose?.();ctrl.dispose();host?.remove();style?.remove();unmark();cells.clear();window.removeEventListener('storage',storageEvent);if(window[GLOBAL]===global)delete window[GLOBAL];}
      return dispose;
    }

    function apply(ctx){if(window[GLOBAL])return;try{ctx.effect(()=>install(ctx),'dsh-session-tabs: native center strip');}catch(error){window[GLOBAL]?.dispose();ctx.logger?.warn('Session tabs could not attach; native UI remains available: '+String(error));}}
    return {apply:apply,inject:['slots','sessions','uiWorkspace','uiSession','layout','workspaces'],createController:createController,parse:parse,serialize:serial,current:current,CSS:CSS,storageKey:KEY};
  }
});
