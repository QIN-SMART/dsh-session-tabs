// Controlled local adapter: exercises the actual Host Agent and event streams.
// Not included in the published plugin. It never sends external model requests.
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import {appendFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
export const inject=['llm'];
export function apply(ctx,config){
  if(process.env.DSH_TABS_TEST!=='1')throw new Error('Test adapter requires an isolated test invocation');
  class TestAdapter extends LlmAdapter{
    providerInfo(provider){return {id:provider,name:'Tabs Test · local'};}
    async listModels(provider){return [{provider,id:'delay-echo',name:'Local delayed echo',inputModalities:['text']}];}
    async resolveModel(provider,model){return {provider,id:model,name:'Local delayed echo',inputModalities:['text'],context:{contextWindow:32768}};}
    async *stream(options){
      const userTexts=options.messages.filter(m=>m.role==='user').map(m=>m.content.filter(p=>p.type==='text').map(p=>p.text).join(''));
      const task=userTexts.findLast(text=>/TAB-[A-Z]/.test(text))?.match(/TAB-[A-Z][^\n<]*/)?.[0]||'fixture';
      const stamp=(type)=>appendFileSync(config.journal,JSON.stringify({type,task,time:Date.now()})+'\n');
      stamp('start');yield {type:'block-start',index:0,blockType:'text'};
      let text='';
      try{
        for(let i=0;i<120;i++){
          await delay(500,undefined,{signal:options.signal});
          const chunk=i===0?'验证会话：'+task+'\n':'片段 '+(i+1)+'；';text+=chunk;yield {type:'text-delta',index:0,text:chunk};
        }
        yield {type:'block-end',index:0,block:{type:'text',text}};
        yield {type:'finish',reason:{kind:'stop'}};stamp('finish');
      }catch(error){stamp('abort');throw error;}
    }
  }
  ctx.llm.registerAdapter(['tabs-fixture'],new TestAdapter());
}
