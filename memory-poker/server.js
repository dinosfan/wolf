'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
const suits = ['S','H','D','C'];
const names = ['하이카드','원페어','투페어','트리플','스트레이트','플러시','풀하우스','포카드','스트레이트 플러시'];
const now = () => Date.now();
const MEMORIZE_MS = 20_000;
const PICK_MS = 15_000;
const REVEAL_MS = 3_200;
const NEXT_ROUND_COUNTDOWN_MS = 3_000;
const randomCode = () => String(crypto.randomInt(100,1000));
function deck() {
 const arr=[]; for(const s of suits)for(let n=2;n<=14;n++)arr.push({s,n});
 for(let i=arr.length-1;i>0;i--){const j=crypto.randomInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}
 return arr;
}
function evaluate(cards) {
 const nums=cards.map(c=>c.n).sort((a,b)=>b-a);
 const counts=new Map(); nums.forEach(n=>counts.set(n,(counts.get(n)||0)+1));
 const groups=[...counts].map(([n,c])=>({n,c})).sort((a,b)=>b.c-a.c||b.n-a.n);
 const unique=[...new Set(nums)];
 const straight=unique.length===5&&(unique[0]-unique[4]===4?unique[0]:(unique.join(',')==='14,5,4,3,2'?5:0));
 const flush=cards.every(c=>c.s===cards[0].s);
 let v;
 if(flush&&straight)v=[8,straight];
 else if(groups[0].c===4)v=[7,groups[0].n,groups[1].n];
 else if(groups[0].c===3&&groups[1].c===2)v=[6,groups[0].n,groups[1].n];
 else if(flush)v=[5,...nums];
 else if(straight)v=[4,straight];
 else if(groups[0].c===3)v=[3,groups[0].n,...groups.slice(1).map(x=>x.n).sort((a,b)=>b-a)];
 else if(groups[0].c===2&&groups[1].c===2)v=[2,Math.max(groups[0].n,groups[1].n),Math.min(groups[0].n,groups[1].n),groups[2].n];
 else if(groups[0].c===2)v=[1,groups[0].n,...groups.slice(1).map(x=>x.n).sort((a,b)=>b-a)];
 else v=[0,...nums];
 return {value:v,name:v[0]===8&&v[1]===14?'로열 플러시':names[v[0]]};
}
function cmp(a,b) {for(let i=0;i<Math.max(a.length,b.length);i++){const x=(a[i]||0)-(b[i]||0);if(x)return Math.sign(x);}return 0;}
function json(res,status,data){
 const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
}
function error(res,status,message){json(res,status,{error:message});}
function getRoom(code){return rooms.get(String(code||'').toUpperCase());}
function auth(body) {
 const room=getRoom(body.code), player=room&&room.players.find(p=>p.token===body.token);
 if(!player)throw {status:403,message:'방에 다시 입장해 주세요.'};
 player.lastSeen=now();return {room,player};
}
function evaluateOutcome(room) {
 const result=room.players.map(p=>{
  const positions=room.choices[p.id];
  const hand=[...positions.map(i=>room.board[i]),...room.community];
  return {id:p.id,positions,hand,rank:evaluate(hand),autoPositions:room.autoPicks[p.id]||[]};
 });
 const order=cmp(result[0].rank.value,result[1].rank.value);
 const winner=order===0?null:(order>0?result[0].id:result[1].id);
 return {winner,players:result};
}
function fillChoices(room) {
 room.choices={};room.autoPicks={};
 for(const p of room.players) {
  const chosen=(room.selections[p.id]||[]).slice(0,2);
  const auto=[];
  while(chosen.length<2){
   const available=Array.from({length:16},(_,i)=>i).filter(i=>!chosen.includes(i));
   const pick=available[crypto.randomInt(available.length)];
   chosen.push(pick);auto.push(pick);
  }
  room.choices[p.id]=chosen;room.autoPicks[p.id]=auto;
 }
}
function updatePhase(room) {
 const t=now();
 if(room.phase==='countdown'&&t>=room.endsAt){
  start(room);
 }
 if(room.phase==='memorize'&&t>=room.endsAt){
  room.phase='pick';room.endsAt+=PICK_MS;
 }
 if(room.phase==='pick'&&t>=room.endsAt){
  fillChoices(room);
  room.phase='reveal';room.endsAt+=REVEAL_MS;
 }
 if(room.phase==='reveal'&&t>=room.endsAt){
  room.outcome=evaluateOutcome(room);
  if(room.outcome.winner){
   const p=room.players.find(p=>p.id===room.outcome.winner);
   p.score++;
   if(p.score>=3)room.matchWinner=p.id;
  }
  room.phase='result';room.endsAt=0;
 }
}
function start(room) {
 if(room.matchWinner){
  room.players.forEach(p=>p.score=0);
  room.round=0;room.matchWinner=null;
 }
 const d=deck();
 room.board=d.slice(0,16);room.community=d.slice(16,19);
 room.selections={};room.choices={};room.autoPicks={};room.ready={};room.outcome=null;
 room.round++;room.phase='memorize';room.endsAt=now()+MEMORIZE_MS;
}
function snapshot(room,player) {
 updatePhase(room);
 const showBoard=room.phase==='memorize'||room.phase==='result';
 const revealCards=room.phase==='reveal'?[...new Set(room.players.flatMap(p=>room.choices[p.id]||[]))].map(i=>({
  position:i,card:room.board[i],
  owners:room.players.filter(p=>(room.choices[p.id]||[]).includes(i)).map(p=>p.id)
 })):null;
 return {serverNow:now(),code:room.code,me:player.id,host:room.host,
   phase:room.phase,round:room.round,endsAt:room.endsAt,
   matchWinner:room.phase==='result'?room.matchWinner:null,
   players:room.players.map(p=>({id:p.id,nick:p.nick,score:p.score,online:now()-p.lastSeen<14000,
    picked:room.phase==='pick'?(room.selections[p.id]||[]).length===2:!!room.choices[p.id],
    ready:room.phase==='result'&&!!room.ready?.[p.id]})),
   board:showBoard?room.board:null,
   community:['lobby','memorize','countdown'].includes(room.phase)?null:room.community,
   ownSelection:room.phase==='pick'?(room.selections[player.id]||[]):[],
   revealCards,
   outcome:room.phase==='result'?room.outcome:null
 };
}
function readBody(req) {return new Promise((resolve,reject)=>{
 let raw='';req.on('data',d=>{raw+=d;if(raw.length>10000){reject({status:413,message:'요청이 너무 커요.'});req.destroy();}});
 req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject({status:400,message:'잘못된 요청입니다.'});}});
 req.on('error',reject);
});}
async function api(req,res,url){
 const body=req.method==='GET'?Object.fromEntries(url.searchParams):await readBody(req);
 if(url.pathname==='/api/create'){
  const nick=String(body.nick||'').trim().slice(0,12);
  if(!nick)return error(res,400,'닉네임을 입력하세요.');
  if(rooms.size>=900)return error(res,503,'현재 입장 가능한 방이 가득 찼어요.');
  let code;do{code=randomCode()}while(rooms.has(code));
  const token=crypto.randomUUID(),id=crypto.randomUUID(),room={code,host:id,players:[{id,token,nick,score:0,lastSeen:now()}],round:0,phase:'lobby',endsAt:0,board:[],community:[],selections:{},choices:{},autoPicks:{},ready:{},matchWinner:null,outcome:null,created:now()};
  rooms.set(code,room);return json(res,200,{code,token});
 }
 if(url.pathname==='/api/join'){
  if(!/^\d{3}$/.test(String(body.code||'')))return error(res,400,'숫자 3자리 방 코드를 입력하세요.');
  const room=getRoom(body.code);if(!room)return error(res,404,'방 코드를 찾을 수 없어요.');
  if(body.token){const old=room.players.find(p=>p.token===body.token);if(old){old.lastSeen=now();return json(res,200,{code:room.code,token:old.token});}}
  if(room.players.length>=2)return error(res,409,'이미 두 명이 참가한 방이에요.');
  if(room.phase!=='lobby')return error(res,409,'게임이 진행 중이에요.');
  const nick=String(body.nick||'').trim().slice(0,12);if(!nick)return error(res,400,'닉네임을 입력하세요.');
  const token=crypto.randomUUID(),id=crypto.randomUUID();room.players.push({id,token,nick,score:0,lastSeen:now()});
  return json(res,200,{code:room.code,token});
 }
 if(url.pathname==='/api/state'){
  const {room,player}=auth(body);return json(res,200,snapshot(room,player));
 }
 if(url.pathname==='/api/start'){
  const {room,player}=auth(body);
  if(player.id!==room.host)return error(res,403,'방장만 시작할 수 있어요.');
  if(room.players.length!==2)return error(res,409,'친구가 입장해야 시작할 수 있어요.');
  if(room.phase!=='lobby')return error(res,409,'다음 라운드는 두 사람 모두 준비해야 시작돼요.');
  start(room);return json(res,200,{ok:true});
 }
 if(url.pathname==='/api/ready'){
  const {room,player}=auth(body);
  updatePhase(room);
  if(room.phase!=='result')return error(res,409,'결과가 공개된 뒤에 준비할 수 있어요.');
  room.ready ||= {};
  room.ready[player.id]=true;
  if(room.players.length===2&&room.players.every(p=>room.ready[p.id])){
   room.phase='countdown';room.endsAt=now()+NEXT_ROUND_COUNTDOWN_MS;
  }
  return json(res,200,{ok:true});
 }
 if(url.pathname==='/api/select'){
  const {room,player}=auth(body);updatePhase(room);
  if(room.phase!=='pick')return error(res,409,'카드 선택 시간이 종료됐어요.');
  const i=body.position;
  if(!Number.isInteger(i)||i<0||i>15)return error(res,400,'올바른 카드를 선택하세요.');
  const picks=room.selections[player.id]||(room.selections[player.id]=[]);
  const index=picks.indexOf(i);
  if(index>=0)picks.splice(index,1);
  else if(picks.length<2)picks.push(i);
  else return error(res,409,'카드는 최대 두 장까지 선택할 수 있어요. 다른 카드를 해제해 주세요.');
  return json(res,200,{ok:true});
 }
 return error(res,404,'잘못된 요청이에요.');
}
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function staticFile(req,res,url){
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return error(res,400,'잘못된 주소');}
 const filename=pathname==='/'?'/index.html':pathname;
 const file=path.resolve(PUBLIC,'.'+filename);
 if(!file.startsWith(PUBLIC+path.sep))return error(res,403,'접근 불가');
 fs.readFile(file,(err,buf)=>{if(err)return error(res,404,'페이지를 찾을 수 없어요.');
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'});res.end(buf);
 });
}
setInterval(()=>{for(const room of rooms.values())updatePhase(room);},250).unref();
setInterval(()=>{for(const [code,room] of rooms)if(now()-Math.max(room.created,...room.players.map(p=>p.lastSeen))>3*3600000)rooms.delete(code);},600000).unref();
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health')return json(res,200,{ok:true});
 if(url.pathname.startsWith('/api/')){
  if(!((req.method==='GET'&&url.pathname==='/api/state')||(req.method==='POST'&&url.pathname!=='/api/state')))return error(res,405,'허용되지 않은 요청');
  try{return await api(req,res,url);}catch(e){return error(res,e.status||500,e.message||'서버 오류');}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return error(res,405,'허용되지 않은 요청');
 return staticFile(req,res,url);
});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log('Memory Poker on '+PORT));
module.exports={server,evaluate,cmp,deck,start,snapshot,updatePhase,fillChoices};
