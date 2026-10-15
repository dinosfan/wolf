'use strict';
const crypto=require('node:crypto'),rooms=new Map();
const rnd=n=>crypto.randomInt(n);
const randomize=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const verify=(v,msg)=>{if(!v)throw Error(msg)};
const key=()=>crypto.randomUUID();
const code=()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rnd(32)]).join('');
const roles={3:[3,2],4:[3,2],5:[4,2],6:[4,2],7:[5,3],8:[6,3]};
const faces={blank:'빈 상자',treasure:'보물 상자',kraken:'크라켄'};
const tones=['#69d6dd','#f9c66c','#b69afd','#79d7a2','#ff849b','#83aaf6','#e5a56a','#c0d783'];
function person(name,seat,bot=false){return {name,seat,bot,ready:bot,token:key(),role:null,cards:[],mark:tones[seat],lost:0}}
function findRoom(c){const r=rooms.get(String(c||'').toUpperCase());verify(r,'방을 찾지 못했어.');return r}
function authorization(body){const r=findRoom(body.code),p=r.players.find(p=>p.token===body.token);verify(p,'방 참가 인증이 만료됐어.');return [r,p]}
function publish(r,msg){
 if(msg)r.history.push(msg);r.history=r.history.slice(-30);r.updated=Date.now();
 for(const c of [...r.clients])try{c.write('data: refresh\n\n')}catch{r.clients.delete(c)}
 scheduleBot(r);
}
function recount(cards){return {blank:cards.filter(x=>x==='blank').length,treasure:cards.filter(x=>x==='treasure').length,kraken:cards.filter(x=>x==='kraken').length}}
function state(r,p){
 const finish=r.stage==='ended';
 return {
  code:r.code,size:r.size,stage:r.stage,round:r.round,step:r.step,turn:r.turn,startSeat:r.startSeat,
  isHost:r.hostToken===p.token,seat:p.seat,role:p.role,roleRevealed:finish,
  remaining:r.players.reduce((a,x)=>a+x.cards.length,0),
  treasureFound:r.opened.filter(x=>x.type==='treasure').length,
  treasureTotal:r.size,
  revealed:r.opened.map(x=>({owner:x.owner,by:x.by,type:x.type,round:x.round,id:x.id})),
  lastReveal:r.lastReveal,winner:r.winner,
  players:r.players.map(x=>({seat:x.seat,name:x.name,bot:x.bot,ready:x.ready,remaining:x.cards.length,mark:x.mark,
   ...(finish?{role:x.role}:{}),lost:x.lost})),
  myCards:recount(p.cards),myBacks:p.cards.length,
  history:r.history.slice(-18),results:finish?{winner:r.winner,treasures:r.opened.filter(x=>x.type==='treasure').length,
   specialThreePlayerLoss:r.size===3&&r.winner==='skeleton'&&!r.players.some(x=>x.role==='skeleton')}:null
 };
}
function create(name,size,practice=false){
 verify(Number.isInteger(size)&&size>=3&&size<=8,'인원은 3~8명만 가능해.');
 verify(name&&name.trim(),'닉네임이 필요해.');
 let c=code();while(rooms.has(c))c=code();
 const p=person(name,0);
 const r={code:c,size,players:[p],hostToken:p.token,stage:'lobby',round:0,step:0,turn:0,startSeat:0,
  history:[],opened:[],lastReveal:null,winner:null,clients:new Set(),botTimer:null};
 rooms.set(c,r);
 if(practice){fillBots(r);start(r)}
 return {code:c,token:p.token,state:state(r,p)};
}
function fillBots(r){while(r.players.length<r.size)r.players.push(person('🤖 봇 '+(r.players.filter(p=>p.bot).length+1),r.players.length,true))}
function start(r){
 const [good,bad]=roles[r.size];
 const rolePool=randomize([...Array(good).fill('explorer'),...Array(bad).fill('skeleton')]).slice(0,r.size);
 // 5 cards per player: N treasures, one Kraken, remainder blanks.
 const cards=randomize([...Array(r.size).fill('treasure'),'kraken',...Array(4*r.size-1).fill('blank')]);
 r.players.forEach((p,i)=>{
  p.role=rolePool[i];p.cards=randomize(cards.slice(i*5,i*5+5));p.ready=false;
 });
 r.round=1;r.step=0;r.turn=r.startSeat;r.stage='playing';r.opened=[];r.winner=null;r.lastReveal=null;
 r.history=['🏴‍☠️ 비밀 역할이 배분됐어. 서로의 말을 듣고 다른 사람의 카드를 공개하자!'];
 publish(r);
}
function nextRound(r){
 verify(r.stage==='break'&&r.round<4,'다음 라운드를 시작할 수 없어.');
 const rest=randomize(r.players.flatMap(p=>p.cards));
 verify(rest.length===r.size*(5-r.round),'카드 재분배 개수 오류');
 const per=5-r.round;
 r.players.forEach((p,i)=>p.cards=randomize(rest.slice(i*per,(i+1)*per)));
 r.round++;r.step=0;r.lastReveal=null;r.stage='playing';
 publish(r,'🌊 '+r.round+'라운드! 카드를 다시 섞어 '+per+'장씩 배분했어.');
}
function finish(r,winner,reason){
 r.stage='ended';r.winner=winner;r.lastReveal=r.lastReveal||null;
 r.players.forEach(p=>{if(p.role!==winner)p.lost++});
 publish(r,reason+' · '+(winner==='explorer'?'탐험대':'스켈레톤')+' 승리!');
}
function reveal(r,actor,target,slot){
 verify(r.stage==='playing'&&r.turn===actor.seat,'현재 선택할 수 있는 차례가 아니야.');
 verify(actor.seat!==target.seat,'자기 카드는 공개할 수 없어.');
 verify(Number.isInteger(slot)&&slot>=0&&slot<target.cards.length,'선택할 카드가 없어.');
 const type=target.cards.splice(slot,1)[0],entry={id:r.opened.length+1,type,owner:target.seat,by:actor.seat,round:r.round};
 r.opened.push(entry);r.lastReveal=entry;r.step++;r.turn=target.seat;
 r.history.push('🃏 '+actor.name+'님이 '+target.name+'님의 카드를 열었어: '+faces[type]);
 if(type==='kraken')return finish(r,'skeleton','🐙 크라켄 발견!');
 if(type==='treasure'&&r.opened.filter(x=>x.type==='treasure').length===r.size)
  return finish(r,'explorer','💎 모든 보물을 발견했어!');
 if(r.step===r.size){
  if(r.round===4)return finish(r,'skeleton','⏳ 4라운드 제한 종료');
  r.stage='break';publish(r,'📦 '+r.round+'라운드 종료! 남은 카드를 다시 섞어 배분할 차례야.');
 }else publish(r);
}
function action(b){
 const [r,p]=authorization(b),host=()=>verify(r.hostToken===p.token,'방장만 사용할 수 있어.');
 if(b.type==='ready'){
  verify(r.stage==='lobby'&&!p.bot,'대기실에서만 준비할 수 있어.');
  p.ready=!!b.ready;publish(r);
 }else if(b.type==='addBot'||b.type==='fillBots'){
  host();verify(r.stage==='lobby'&&r.players.length<r.size,'빈자리가 없어.');
  if(b.type==='fillBots')fillBots(r);else r.players.push(person('🤖 봇 '+(r.players.filter(x=>x.bot).length+1),r.players.length,true));
  publish(r,'🤖 봇 참가');
 }else if(b.type==='removeBot'){
  host();verify(r.stage==='lobby','대기실에서만 가능해.');
  const bot=r.players.find(x=>x.bot&&x.seat===Number(b.seat));verify(bot,'봇을 찾지 못했어.');
  r.players=r.players.filter(x=>x!==bot);r.players.forEach((x,i)=>{x.seat=i;x.mark=tones[i]});publish(r);
 }else if(b.type==='start'){
  host();verify(r.stage==='lobby'&&r.players.length===r.size&&r.players.every(x=>x.ready),'모든 참가자가 준비해야 시작해.');
  start(r);
 }else if(b.type==='open'){
  const target=r.players.find(x=>x.seat===Number(b.target));verify(target,'대상을 선택해.');
  reveal(r,p,target,Number(b.slot));
 }else if(b.type==='next'){
  host();nextRound(r);
 }else if(b.type==='again'){
  host();verify(r.stage==='ended','게임이 끝난 후에 가능해.');
  r.stage='lobby';r.round=0;r.step=0;r.opened=[];r.winner=null;r.lastReveal=null;
  r.players.forEach(x=>{x.cards=[];x.role=null;x.ready=x.bot});
  publish(r,'새 경기 준비!');
 }else if(b.type==='leave'){
  verify(r.stage==='lobby','진행 중에는 방을 나갈 수 없어. 재접속해줘.');
  r.players=r.players.filter(x=>x!==p);r.players.forEach((x,i)=>{x.seat=i;x.mark=tones[i]});
  const human=r.players.find(x=>!x.bot);if(r.hostToken===p.token&&human)r.hostToken=human.token;
  if(!human)rooms.delete(r.code);else publish(r,p.name+'님이 방에서 나갔어.');
  return {left:true};
 }else verify(false,'지원하지 않는 요청이야.');
 return state(r,p);
}
function scheduleBot(r){
 if(r.botTimer||r.stage!=='playing'||!r.players[r.turn]?.bot)return;
 const code=r.code,round=r.round,turn=r.turn,step=r.step;
 r.botTimer=setTimeout(()=>{
  r.botTimer=null;
  if(!rooms.has(code)||r.stage!=='playing'||r.round!==round||r.turn!==turn||r.step!==step)return;
  const p=r.players[turn],others=r.players.filter(x=>x!==p&&x.cards.length);
  if(!others.length)return;
  const target=others[rnd(others.length)];
  try{action({code,token:p.token,type:'open',target:target.seat,slot:rnd(target.cards.length)})}
  catch(e){r.history.push('봇 진행 오류: '+e.message);publish(r)}
 },900);
}
module.exports={rooms,findRoom,authorization,create,person,state,action,roles,finish,reveal,recount,start,nextRound};
