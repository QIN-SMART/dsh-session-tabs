// Isolated DSH_HOME. Never reads or edits the user's daily profile configuration.
import {mkdirSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const get=(key)=>process.argv[process.argv.indexOf(key)+1];
if(!process.argv.includes('--runtime'))throw new Error('Usage: node tools/start-test-profile.mjs --runtime <installed-dsh-directory> [--port 3096]');
const runtime=resolve(get('--runtime')),port=get('--port')||'3096';
// The dsh package may carry nested deps (runtime/node_modules/@deepseek-ai) or sit in a
// hoisted install (runtime = <store>/node_modules/@deepseek-ai/dsh). Use the nearest real scope.
let scope=join(runtime,'node_modules','@deepseek-ai');
for(let dir=runtime;!existsSync(scope)&&dir!==dirname(dir);dir=dirname(dir))scope=join(dir,'node_modules','@deepseek-ai');
if(!existsSync(scope))throw new Error('No @deepseek-ai scope found above '+runtime);
const home=join(root,'.tmp','dsh-home'),profile=join(home,'profiles','tabs-test');
const modules=join(profile,'node_modules');
mkdirSync(modules,{recursive:true});
function link(target,path){if(!existsSync(path)){
  // Windows without Developer Mode/admin denies 'dir' symlinks; junctions need no privilege (absolute targets only).
  try{symlinkSync(target,path,'dir');}catch(_){symlinkSync(target,path,'junction');}
}}
link(scope,join(modules,'@deepseek-ai'));
link(root,join(modules,'dsh-session-tabs'));
link(join(root,'tools','fixtures','model'),join(modules,'dsh-session-tabs-test-model'));
// Resolve the test adapter's imports without adding production dependencies.
mkdirSync(join(root,'node_modules'),{recursive:true});
link(scope,join(root,'node_modules','@deepseek-ai'));
const better=process.argv.includes('--better-sidebar')?resolve(get('--better-sidebar')):null;
if(better)link(better,join(modules,'dsh-better-sidebar'));
writeFileSync(join(profile,'package.json'),JSON.stringify({name:'dsh-session-tabs-isolated-profile',private:true,type:'module',dependencies:{'dsh-session-tabs':'file:../../../..'},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-session-tabs-test-model',...(better?['dsh-better-sidebar']:[]),'dsh-session-tabs']}}},null,2));
writeFileSync(join(profile,'cordis.yml'),'[]\n');
writeFileSync(join(profile,'cordis.patch.yml'),`- id: session-title-llm\n  disabled: true\n- id: llm-pi-ai\n  disabled: true\n- id: desktop-product-telemetry\n  disabled: true\n- id: test-model\n  config:\n    journal: ${JSON.stringify(join(root,'.tmp','model-calls.jsonl'))}\n`);
console.log('Isolated profile:',profile);
const proc=spawn(process.execPath,[join(runtime,'lib','bin.js'),'--profile','tabs-test','--no-open','--host','127.0.0.1','--port',port],{cwd:root,env:{...process.env,DSH_HOME:home,DSH_TABS_TEST:'1'},stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>proc.kill(signal));
proc.on('exit',code=>{process.exitCode=code||0;});
