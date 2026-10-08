'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');const {root}=require('./simulation-harness.cjs');
function ui({speech=true,duration=20000}={}){
 let now=0,seq=0,voices=[],wakeReleased=0;const timers=new Map(),handlers={},sent=[],elements=new Map(),storage=new Map();
 function el(id){if(!elements.has(id))elements.set(id,{id,value:'',innerHTML:'',textContent:'',disabled:false,dataset:{},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id)}
 const document={getElementById:el,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,visibilityState:'visible'};
 const defer=(fn,d)=>{const id=++seq;timers.set(id,{fn,at:now+d});return id};const clear=id=>timers.delete(id);
 const sock={id:'me',on:(e,f)=>handlers[e]=f,emit:(e,d,cb)=>{sent.push({event:e,data:d,cb});}};
 let current=null;
 const synth={getVoices:()=>[{lang:'ko-KR'}],speak:u=>{voices.push(u);current=u;if(duration!==null)defer(()=>{if(current===u){current=null;u.onend?.()}},duration)},cancel:()=>{const old=current;current=null;old?.onerror?.()}};
 const window=speech?{speechSynthesis:synth}:{};
 const ctx=vm.createContext({io:()=>sock,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{wakeLock:{request:async()=>({release:async()=>wakeReleased++})}},window,SpeechSynthesisUtterance:function(t){this.text=t},setTimeout:defer,clearTimeout:clear,setInterval:defer,clearInterval:clear,console,Date:class extends Date{static now(){return now}}});
 vm.runInContext(fs.readFileSync(root+'/public/app.js','utf8'),ctx);
 async function advance(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await Promise.resolve()}now=end;await Promise.resolve()}
 return {ctx,el,sent,voices,storage,handlers,advance,fire:(e,d)=>handlers[e](d),get:s=>vm.runInContext(s,ctx),run:s=>vm.runInContext(s,ctx),html:()=>el('app').innerHTML,timers};
}
const room={code:'TEST',hostId:'me',phase:'night',playerCount:3,selectedRoles:['seer'],players:[{id:'me',name:'Me',connected:true},{id:'other',name:'Other',connected:true},{id:'third',name:'Third',connected:true}],loneWolfCenter:true,readyIds:[]};
const prompt={role:'seer',actionRole:'seer',roleName:'예언자',emoji:'🔮',instructions:'test',others:room.players.slice(1),skipAllowed:true};
async function run(){
 let tests=0;
 const a=ui();a.run("state.myId='me'");a.fire('room:update',room);a.fire('night:prompt',prompt);
 a.el('seerPlayer').onclick();a.run("state.selected=[{type:'player',val:'other'}]");const before=a.html();a.fire('room:update',{...room});assert.equal(a.html(),before);assert.equal(a.get('state.selected.length'),1);tests++;
 a.run('submitNight(state.nightPrompt,false)');const req=a.sent.at(-1);req.cb({ok:true,requiresAck:true,seen:[{role:'werewolf',name:'늑대인간',emoji:'🐺'}]});assert(a.html().includes('확인 결과'));a.fire('room:update',{...room});assert(a.html().includes('ackReveal'));assert.equal(a.get('state.nightPrompt'),null);tests++;
 a.el('ackReveal').onclick();assert(!a.get('state.nightReveal'));assert.equal(a.sent.at(-1).event,'night:ack');tests++;
 const follow={...prompt,role:'doppelganger',stage:'followup'};a.fire('night:prompt',follow);assert(a.html().includes('seerPlayer'));tests++;
 a.fire('night:reveal',{seen:[{role:'villager',name:'주민',emoji:'🏠'}]});a.run('render()');assert(a.html().includes('ackReveal'));tests++;
 a.fire('role:reveal',{role:'seer',name:'예언자',emoji:'🔮',team:'village'});a.fire('room:update',{...room,phase:'roleReveal',readyIds:['me']});assert(a.el('ready').disabled);a.fire('room:update',{...room,phase:'roleReveal',readyIds:['me']});assert(a.el('ready').disabled);tests++;
 a.fire('room:update',{...room,phase:'discussion',discussionEndsAt:100000});assert(!a.get('state.nightReveal'));assert(!a.html().includes('확인 결과'));assert(!a.html().includes('당신의 시작 카드'));tests++;
 const guest=ui();guest.run("state.myId='other'");guest.storage.set('mw_narration','1');guest.fire('room:update',room);assert.equal(guest.get('state.narrationEnabled'),false);guest.fire('narration:say',{text:'guest should be silent',cueId:'a'});assert.equal(guest.voices.length,0);tests++;
 const voice=ui({duration:20000});voice.run("state.myId='me'");voice.fire('room:update',room);voice.fire('narration:say',{text:'예언자는 눈을 뜨세요.',cueId:'long',kind:'role-start'});assert.equal(voice.voices[0].lang,'ko-KR');await voice.advance(10000);assert(!voice.sent.some(x=>x.event==='narration:done'));await voice.advance(10000);assert.equal(voice.sent.at(-1).data.cueId,'long');tests++;
 const missing=ui({speech:false});missing.run("state.myId='me'");missing.fire('room:update',room);missing.fire('narration:say',{text:'모두 눈을 감아 주세요.',cueId:'fallback'});await missing.advance(15000);assert.equal(missing.sent.at(-1).data.cueId,'fallback');tests++;
 const stalled=ui({duration:null});stalled.run("state.myId='me'");stalled.fire('room:update',room);stalled.fire('narration:say',{text:'눈을 감으세요.',cueId:'stalled'});await stalled.advance(59000);assert(!stalled.sent.some(x=>x.event==='narration:done'));await stalled.advance(1000);assert.equal(stalled.sent.at(-1).data.cueId,'stalled');tests++;
 const out=ui();out.run("state.myId='me'");out.fire('room:update',{...room,phase:'lobby'});out.storage.set('mw_room','TEST');out.storage.set('mw_token','token');out.el('leave').onclick();out.sent.at(-1).cb({ok:true});assert(!out.storage.has('mw_room'));assert(!out.storage.has('mw_token'));assert(out.html().includes('방 만들기'));tests++;
 console.log(`Client/voice checks passed: ${tests} scenarios (selection/reveal persistence, ready state, hidden cards, host-only voice, delayed TTS, unsupported/stalled TTS, leave).`);
}
run().catch(e=>{console.error(e);process.exitCode=1});
