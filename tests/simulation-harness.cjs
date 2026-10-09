const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname, '..');
function harness(seed=1){
 let now=0,seq=0,clientSeq=0,connect;const timers=new Map(),clients=new Map(),events=[];
 const defer=(fn,delay=0,interval=false)=>{const id=++seq;timers.set(id,{fn,time:now+delay,interval:interval?delay:0});return id};
 const clear=id=>timers.delete(id);
 const DateFake=class extends Date {constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};
 const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const io={on:(e,fn)=>connect=fn,to:target=>({emit:(event,data)=>{
   const payload=JSON.parse(JSON.stringify(data??null));events.push({target,event,data:payload,at:now});
   for(const c of clients.values())if(c.online&&(c.id===target||c.rooms.has(target)))c.received.push({event,data:payload});
 }})};
 const express=()=>({use(){}});express.static=()=>{};
 const ctx=vm.createContext({require:n=>n==='express'?express:n==='http'?{createServer:()=>({listen(){}})}:n==='socket.io'?{Server:function(){return io}}:n==='./game-engine'?require(root+'/game-engine.js'):require(n.startsWith('./')?path.resolve(root,n):n),__dirname:root,process,console,Date:DateFake,Math:math,setTimeout:defer,clearTimeout:clear,setInterval:(f,d)=>defer(f,d,true),clearInterval:clear});
 vm.runInContext(fs.readFileSync(root+'/server.js','utf8'),ctx);
 function client(name='P'){
  const id='s'+(++clientSeq),handlers={};
  const c={id,online:true,rooms:new Set(),received:[],call(event,data={}){let res;handlers[event](data,x=>res=JSON.parse(JSON.stringify(x)));return res},take(event){return this.received.filter(x=>x.event===event).at(-1)?.data},disconnect(){this.online=false;handlers.disconnect();},name};
  const socket={id,data:{},on:(e,f)=>handlers[e]=f,join:code=>c.rooms.add(code),leave:code=>c.rooms.delete(code),emit:(e,d)=>c.received.push({event:e,data:d})};
  clients.set(id,c);connect(socket);return c;
 }
 function advance(ms){const end=now+ms;let guard=0;while(true){const entry=[...timers].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!entry)break;if(++guard>10000)throw Error('Timer runaway');now=entry[1].time;timers.delete(entry[0]);entry[1].fn();if(entry[1].interval)timers.set(entry[0],{...entry[1],time:now+entry[1].interval});}now=end;}
 vm.runInContext('const simulationShuffle = shuffle;',ctx);
 return {ctx,client,advance,events,clients,room:code=>vm.runInContext(`rooms.get(${JSON.stringify(code)})`,ctx),setDeck:roles=>{ctx.fixed=roles;vm.runInContext('shuffle = a => a.length === fixed.length && a.every(c=>c.role) ? fixed.map((r,i)=>a.filter(c=>c.role===r)[fixed.slice(0,i).filter(x=>x===r).length]) : simulationShuffle(a);',ctx)},now:()=>now};
}
module.exports={harness,root};
