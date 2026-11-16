'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {server}=require('../server');
const clientCode=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');

function memoryStorage(map=new Map()){
 return {
  getItem(key){return map.has(key)?map.get(key):null},
  setItem(key,value){map.set(key,String(value))},
  removeItem(key){map.delete(key)}
 };
}
function createClient(base,sharedLocal){
 const events={};
 const mount={innerHTML:''};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const session=memoryStorage();
 const context={
  document:{
   querySelector(selector){
    if(selector==='#mount')return mount;
    if(selector==='#toast')return toast;
    throw new Error('Unexpected selector '+selector);
   },
   addEventListener(name,cb){events[name]=cb}
  },
  location:{search:'',origin:base},
  history:{replaceState(){}},
  localStorage:sharedLocal,
  sessionStorage:session,
  URLSearchParams,
  Date,
  console,
  setInterval(){return 1},
  setTimeout(){return 1},
  clearTimeout(){},
  fetch(url,options){return fetch(new URL(url,base),options)},
  prompt(){return ''}
 };
 vm.createContext(context);
 vm.runInContext(clientCode,context,{filename:'memory-poker/public/app.js'});
 return {
  html(){return mount.innerHTML},
  async enter(code,token){
   context.roomCode=code;
   context.playerToken=token;
   await vm.runInContext('roomStorage.setItem("memoryPokerRoom:"+roomCode,playerToken); code=roomCode;token=playerToken;refresh()',context);
  },
  async refresh(){await vm.runInContext('refresh()',context)},
  async ready(){
   const button={dataset:{action:'ready'},disabled:false};
   assert.match(mount.innerHTML,/data-action="ready"/,'Ready button must be visible on this client');
   await events.click({target:{closest(selector){return selector==='[data-action]'?button:null}}});
   return button;
  },
  renderFake(data){
   context.fixture=data;
   vm.runInContext('state=fixture;phase=state.phase;render()',context);
  },
  isTabScoped(){return vm.runInContext('roomStorage===sessionStorage',context)}
 };
}
async function api(base,route,data,method='POST'){
 const u=base+'/api/'+route+(method==='GET'?'?'+new URLSearchParams(data).toString():'');
 const res=await fetch(u,{method,headers:{'Content-Type':'application/json'},
  body:method==='GET'?undefined:JSON.stringify(data)});
 const value=await res.json();
 assert.equal(res.status,200,JSON.stringify(value));
 return value;
}

test('real lobby: guest has visible ready button; guest ready and host ready cause shared countdown',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const a=await api(base,'create',{nick:'방장'});
  const b=await api(base,'join',{code:a.code,nick:'친구'});
  const sharedLocal=memoryStorage();
  const host=createClient(base,sharedLocal);
  const guest=createClient(base,sharedLocal);
  assert.ok(host.isTabScoped()&&guest.isTabScoped(),'room credentials must use tab-scoped sessionStorage');
  await host.enter(a.code,a.token);
  await guest.enter(b.code,b.token);
  assert.match(host.html(),/data-action="ready"/);
  assert.match(guest.html(),/data-action="ready"/);
  assert.match(guest.html(),/게임 준비하기/);
  assert.match(guest.html(),/준비 0 \/ 2명/);
  assert.match(guest.html(),/ready-dock/);
  await guest.ready();
  assert.match(guest.html(),/내 준비 완료/);
  await host.refresh();
  assert.match(host.html(),/준비 1 \/ 2명/);
  assert.match(host.html(),/data-action="ready"/);
  const oneReady=await api(base,'state',{code:a.code,token:a.token},'GET');
  assert.equal(oneReady.phase,'lobby');
  assert.deepEqual(oneReady.players.map(p=>p.ready),[false,true]);
  await host.ready();
  const countdown=await api(base,'state',{code:a.code,token:b.token},'GET');
  assert.equal(countdown.phase,'countdown');
  assert.equal(countdown.readyCount,2);
  await guest.refresh();
  assert.match(guest.html(),/countdown-number/);
  assert.match(host.html(),/countdown-number/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('guest result screen: ready control is visible after full card board, not hidden above it',()=>{
 const base='http://localhost:9999';
 const guest=createClient(base,memoryStorage());
 const hand=[{n:2,s:'S'},{n:3,s:'H'},{n:4,s:'D'},{n:5,s:'C'},{n:6,s:'S'}];
 const players=[{id:'h',nick:'방장',score:1,ready:false,picked:true,online:true},
  {id:'g',nick:'친구',score:0,ready:false,picked:true,online:true}];
 guest.renderFake({
  phase:'result',code:'123',host:'h',me:'g',round:1,endsAt:0,matchWinner:null,
  board:Array.from({length:16},()=>({n:2,s:'S'})),
  community:hand.slice(2),players,readyCount:0,ownSelection:[],
  outcome:{winner:'h',players:players.map(p=>({
   id:p.id,positions:[0,1],hand,rank:{name:'스트레이트'},autoPositions:[]
  }))}
 });
 const html=guest.html();
 assert.match(html,/data-action="ready"/);
 assert.match(html,/다음 판 준비하기/);
 assert.ok(html.indexOf('ready-dock')>html.indexOf('table-panel'),
  'ready dock must render after the long result card board');
 assert.match(html,/준비 0 \/ 2명/);
});

test('host can be ready before guest joins; late guest still gets ready button',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const a=await api(base,'create',{nick:'방장'});
  const host=createClient(base,memoryStorage());
  await host.enter(a.code,a.token);
  assert.match(host.html(),/data-action="ready"/);
  await host.ready();
  let state=await api(base,'state',{code:a.code,token:a.token},'GET');
  assert.equal(state.phase,'lobby');
  assert.equal(state.readyCount,1);
  const b=await api(base,'join',{code:a.code,nick:'참가자'});
  const guest=createClient(base,memoryStorage());
  await guest.enter(b.code,b.token);
  assert.match(guest.html(),/data-action="ready"/);
  await guest.ready();
  state=await api(base,'state',{code:b.code,token:b.token},'GET');
  assert.equal(state.phase,'countdown');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
