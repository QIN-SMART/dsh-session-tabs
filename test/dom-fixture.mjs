// Purpose-limited DOM and injection-aware Context for the actual published bundle.
export class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.listeners=new Map();this.hidden=false;this.className='';this._text='';this.display='block';}
  get parentElement(){return this.parentNode||null;}
  get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n!==this&&n.tagName==='HTML';}
  get firstChild(){return this.children[0]||null;}
  get firstElementChild(){return this.firstChild;}
  get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;}
  set textContent(v){this._text=String(v);this.replaceChildren();}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  hasAttribute(k){return Object.hasOwn(this.attrs,k);}
  removeAttribute(k){delete this.attrs[k];}
  append(...nodes){nodes.forEach(n=>this.appendChild(n));}
  appendChild(n){n.remove();this.children.push(n);n.parentNode=this;return n;}
  insertBefore(n,before){n.remove();const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,n);n.parentNode=this;return n;}
  replaceChildren(...nodes){this.children.forEach(n=>n.parentNode=null);this.children=[];this.append(...nodes);}
  remove(){if(this.parentNode){const i=this.parentNode.children.indexOf(this);this.parentNode.children.splice(i,1);this.parentNode=null;}}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  addEventListener(t,fn){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(fn);}
  removeEventListener(t,fn){this.listeners.get(t)?.delete(fn);}
  click(){this.dispatch('click',{target:this});}
  cloneNode(deep=false){const n=new Node(this.tagName);n.attrs={...this.attrs};n.className=this.className;n._text=this._text;n.document=this.document;if(deep)this.children.forEach(c=>n.append(c.cloneNode(true)));return n;}
  dispatch(t,event){this.listeners.get(t)?.forEach(fn=>fn(event));}
  matches(sel){
    if(sel.startsWith('.'))return this.className.split(' ').includes(sel.slice(1));
    if(sel.startsWith('#'))return this.getAttribute('id')===sel.slice(1);
    const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(sel);
    if(match)return match[2]===undefined?this.hasAttribute(match[1]):this.getAttribute(match[1])===match[2];
    return this.tagName===sel.toUpperCase();
  }
  closest(sel){let n=this;while(n){if(n.matches(sel))return n;n=n.parentNode;}return null;}
  querySelectorAll(sel){
    const parts=sel.trim().split(/\s+(?![^\[]*\])/),last=parts.pop(),all=[];
    const walk=n=>n.children.forEach(c=>{if(c.matches(last)){let parent=c.parentNode,index=parts.length-1;while(parent&&index>=0){if(parent.matches(parts[index]))index--;parent=parent.parentNode;}if(index<0)all.push(c);}walk(c);});walk(this);return all;
  }
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  focus(){this.document.activeElement=this;}
}
export function domFixture(){
  const html=new Node('html'),head=new Node('head'),body=new Node('body');html.lang='zh';html.append(head,body);
  const root=new Node('div');root.setAttribute('id','root');body.append(root);
  const frame=new Node('div'),left=new Node('div'),center=new Node('div'),right=new Node('div');root.append(frame);frame.append(left,center,right);
  left.setAttribute('data-slot','sidebar');right.setAttribute('data-slot','rightbar');left.textContent='native left';right.textContent='native right';
  const main=new Node('span'),conv=new Node('span'),native=new Node('div');main.setAttribute('data-slot','main');main.display='contents';conv.setAttribute('data-slot','main.conversation');conv.display='contents';main.append(conv);conv.append(native);center.append(main);
  const doc=new Node('document');doc.documentElement=html;doc.head=head;doc.body=body;doc.activeElement=body;doc.children=[html];
  doc.createElement=tag=>{const n=new Node(tag);n.document=doc;return n;};
  const timers=new Map(),observers=[];let next=0,time=0;
  const window=new Node('window');window.localStorage={getItem(){return null;},setItem(){}};window.getComputedStyle=el=>({display:el.display});
  class Observer{constructor(fn){this.fn=fn;this.stopped=false;observers.push(this);}observe(){}disconnect(){this.stopped=true;}}
  const extra={window,document:doc,navigator:{language:'zh',platform:'MacIntel'},MutationObserver:Observer,setTimeout:(fn,ms=0)=>{timers.set(++next,{fn,at:time+Math.max(0,Number(ms)||0)});return next;},clearTimeout:id=>timers.delete(id)};
  const advance=ms=>{const end=time+ms;for(let i=0;i<1000;i++){const nextTask=[...timers].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!nextTask){time=end;return;}time=nextTask[1].at;timers.delete(nextTask[0]);nextTask[1].fn();}throw Error('timer loop');};
  const flush=()=>{for(let i=0;timers.size&&i<100;i++)advance(Math.max(0,Math.min(...[...timers.values()].map(task=>task.at))-time));if(timers.size)throw Error('timer loop');};
  // Input tests dispatch through the real ancestor path so delegated capture listeners see it.
  const dispatch=(target,type,props={})=>{const event={target,type,preventDefault(){},...props},path=[];for(let n=target;n;n=n.parentNode)path.push(n);if(!path.includes(doc))path.push(doc);path.push(window);for(const node of path.reverse())node.dispatch(type,event);return event;};
  return {extra,doc,window,left,right,center,main,native,timers,observers,flush,advance,dispatch,get time(){return time;}};
}
export class TestContext{
  constructor(services,inject){this.cleanups=[];this.registrations=[];this.warnings=[];this.logger={warn:message=>this.warnings.push(message)};
    services.slots={inject:(_name,cb)=>cb(),register:(meta,component)=>{const entry={meta,component};this.registrations.push(entry);return()=>this.registrations.splice(this.registrations.indexOf(entry),1);}};
    for(const [name,service] of Object.entries(services))Object.defineProperty(this,name,{get(){if(!inject.includes(name))throw Error('Undeclared injection '+name);return service;}});
  }
  effect(fn){const cleanup=fn();this.cleanups.push(cleanup);return cleanup;}
  dispose(){this.cleanups.splice(0).forEach(fn=>fn?.());}
}
