'use strict';
const crypto=require('node:crypto'),R=require('./rules');
const rooms=new Map(),maxPlayers=4;
const err=(condition,message)=>{if(!condition)throw Error(message)};
const shuffled=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=crypto.randomInt(i+1);[x[i],x[j]]=[x[j],x[i]]}return x};
const token=()=>crypto.randomUUID();
const roomCode=()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');
const player=(name,seat,bot=false)=>({name,seat,token:token(),bot,ready:bot,hand:[],pending:[],trade:null,grand:null,call:null,hasPlayed:false,tricks:[],out:false});
const find=code=>{const x=rooms.get(String(code||'').toUpperCase());err(x,'방을 찾을 수 없어.');return x};
const auth=b=>{const r=find(b.code),p=r.players.find(x=>x.token===b.token);err(p,'다시 접속해 줘. 인증이 만료됐어.');return [r,p]};
const next=(r,from)=>{for(let i=1;i<=4;i++){const id=(from+i)%4;if(r.players[id]?.hand.length)return id}return null};
const team=R.team;
function notify(r,msg){
 if(msg)r.logs.push(msg);
 r.logs=r.logs.slice(-35);r.updated=Date.now();
 for(const res of [...r.clients])try{res.write('data: update\n\n')}catch{r.clients.delete(res)}
 scheduleBot(r);
}
function create(name,target=1000,practice=false){
 err(typeof name==='string'&&name.trim(),'닉네임을 입력해 줘.');
 err([500,1000].includes(target),'500점 또는 1000점으로 정해야 해.');
 let code=roomCode();while(rooms.has(code))code=roomCode();
 const host=player(name.trim().slice(0,14),0),r={code,target,players:[host],host:host.token,stage:'lobby',phase:'lobby',round:0,
 scores:[0,0],lead:0,turn:0,table:null,pile:[],passes:0,lastSeat:null,finish:[],wish:null,history:[],
 logs:[],clients:new Set(),botKey:'',roundResult:null,result:null,handStarted:false};
 rooms.set(code,r);
 if(practice){fill(r);r.players[0].ready=true;newRound(r)}
 return {code,token:host.token,state:state(r,host)};
}
function fill(r){while(r.players.length<4)r.players.push(player('🤖 봇 '+(r.players.filter(p=>p.bot).length+1),r.players.length,true))}
function newRound(r){
 r.round++;r.phase='grand';r.stage='playing';r.roundResult=null;r.result=null;r.handStarted=false;r.finish=[];
 r.table=null;r.pile=[];r.lastSeat=null;r.wish=null;r.passes=0;r.history=[];
 const deck=shuffled(R.DECK.map(x=>x.id));
 r.players.forEach((p,i)=>{
  p.hand=deck.slice(i*14,(i+1)*14).slice(0,8);
  p.pending=deck.slice(i*14+8,(i+1)*14);
  p.ready=false;p.trade=null;p.grand=null;p.call=null;p.hasPlayed=false;p.tricks=[];p.out=false;
 });
 notify(r,'🀄 '+r.round+'라운드 시작! 8장을 보고 그랜드 티츄를 결정해.');
}
function afterGrand(r){
 if(r.players.every(p=>p.grand!==null)){
  r.players.forEach(p=>{p.hand.push(...p.pending);p.pending=[]});
  r.phase='trade';notify(r,'카드 14장이 준비됐어. 팀원과 상대에게 각각 한 장씩 교환해.');
 }
}
function afterTrade(r){
 if(!r.players.every(p=>p.trade))return;
 const deliveries=Array.from({length:4},()=>[]);
 for(const p of r.players){
  for(const [dest,id] of Object.entries(p.trade))deliveries[Number(dest)].push(id);
  p.hand=p.hand.filter(id=>!Object.values(p.trade).includes(id));
 }
 r.players.forEach((p,i)=>{p.hand.push(...deliveries[i]);p.trade=null});
 r.turn=r.players.find(p=>p.hand.includes('MJ')).seat;r.lead=r.turn;
 r.phase='play';r.handStarted=true;
 notify(r,'🀄 '+r.players[r.turn].name+'님이 마작 카드를 가졌어. 선공!');
}
function wishes(r,p){
 if(!r.wish||!p.hand.some(id=>R.card(id)?.rank===r.wish))return [];
 return R.combinations(p.hand,r.table,!r.table,r.wish).filter(x=>x.fulfills);
}
function recordFinish(r,p){
 if(p.hand.length!==0||r.finish.includes(p.seat))return false;
 r.finish.push(p.seat);p.out=true;r.logs.push('🏁 '+p.name+'님 '+r.finish.length+'등!');
 return r.finish.length===2&&team(r.finish[0])===team(r.finish[1]);
}
function settle(r,doubleVictory){
 const outgoing=r.finish[0],teamPoints=[0,0];const extra=[0,0];
 if(doubleVictory){teamPoints[team(outgoing)]=200}
 else{
  // Any unclaimed cards in the last trick go to the player who put down the highest hand.
  if(r.pile.length&&r.lastSeat!==null){r.players[r.lastSeat].tricks.push(...r.pile);r.pile=[]}
  const tail=r.players.find(p=>p.hand.length);
  if(tail){
   const enemy=1-team(tail.seat);
   teamPoints[enemy]+=tail.hand.reduce((a,id)=>a+R.scoreCard(id),0);
   r.players[outgoing].tricks.push(...tail.tricks);tail.tricks=[];
  }
  for(const p of r.players)teamPoints[team(p.seat)]+=p.tricks.reduce((sum,id)=>sum+R.scoreCard(id),0);
 }
 for(const p of r.players){
  if(p.grand||p.call==='small'){
   const amount=p.grand?200:100;
   const success=r.finish[0]===p.seat;
   extra[team(p.seat)]+=success?amount:-amount;
  }
 }
 const award=[teamPoints[0]+extra[0],teamPoints[1]+extra[1]];
 r.scores=r.scores.map((n,i)=>n+award[i]);
 r.roundResult={base:teamPoints,announcements:extra,award,out:[...r.finish],doubleVictory:!!doubleVictory,total:[...r.scores]};
 const [a,b]=r.scores,complete=Math.max(a,b)>=r.target&&a!==b;
 r.phase=complete?'matchEnd':'roundEnd';r.stage=complete?'ended':'playing';
 r.result=complete?{winner:a>b?0:1,score:[...r.scores]}:null;
 notify(r,(doubleVictory?'🎯 1·2등 같은 팀! ':'🏁 라운드 종료! ')+award[0]+' : '+award[1]+'점');
}
function closeTrick(r){
 const seat=r.lastSeat,holder=r.players[seat];
 if(r.table?.type==='single'&&r.table.cards[0]==='DG'){
  r.phase='dragon';r.turn=seat;notify(r,'🐉 드래곤 획득! 상대 팀 중 트릭을 받을 사람을 골라.');
  return;
 }
 holder.tricks.push(...r.pile);r.pile=[];
 r.table=null;r.passes=0;r.lastSeat=null;r.turn=holder.hand.length?seat:next(r,seat);
 if(r.turn===null)settle(r,false);
 else notify(r,'📥 '+holder.name+'님이 트릭을 가져갔어.');
}
function play(r,p,ids,chosen,wish){
 err(r.phase==='play','지금 카드를 낼 수 없어.');
 err(Array.isArray(ids)&&ids.length>0&&ids.length<=14,'낼 카드를 선택해.');
 err(new Set(ids).size===ids.length&&ids.every(id=>p.hand.includes(id)),'내 손패에 없는 카드가 있어.');
 const selected=R.validOptions(ids,r.table,!r.table);
 const option=selected.find(x=>x.type===chosen?.type&&x.power===chosen?.power&&x.len===chosen?.len&&x.bomb===chosen?.bomb&&x.wild===chosen?.wild)||
    (selected.length===1?selected[0]:null);
 err(option,'유효한 조합을 지정해야 해. 카드 종류와 길이를 확인해.');
 const onTurn=r.turn===p.seat;
 err(onTurn||!!r.table&&option.bomb>0,'내 차례가 아니야. 턴 밖에서는 폭탄만 낼 수 있어.');
 if(r.wish&&onTurn&&wishes(r,p).length){
  err(ids.some(id=>R.card(id).rank===r.wish),'마작이 요청한 숫자를 낼 수 있다면 반드시 내야 해.');
 }
 if(option.type==='dog'){
  err(onTurn&&!r.table,'개 카드는 선공일 때만 사용해.');
  err(p.hand.includes('DO'),'개 카드가 없어.');
  p.hand=p.hand.filter(x=>x!=='DO');p.hasPlayed=true;
  r.logs.push('🐕 '+p.name+'님이 팀원에게 선공권을 넘겼어.');
  recordFinish(r,p);
  if(r.finish.length>=3)return settle(r,false);
  r.turn=r.players[(p.seat+2)%4].hand.length?(p.seat+2)%4:next(r,(p.seat+2)%4);
  notify(r);return;
 }
 p.hand=p.hand.filter(x=>!ids.includes(x));p.hasPlayed=true;
 r.pile.push(...ids);r.table={...option,cards:[...ids],owner:p.seat};r.lastSeat=p.seat;r.passes=0;
 if(ids.includes('MJ')){err(Number.isInteger(wish)&&wish>=2&&wish<=14,'마작을 낼 때는 2부터 A까지 원하는 숫자를 골라.');r.wish=wish}
 if(r.wish&&ids.some(x=>R.card(x).rank===r.wish))r.wish=null;
 r.history.push({seat:p.seat,cards:[...ids],kind:option.type,round:r.round});
 r.logs.push((option.bomb?'💣 ': '🃏 ')+p.name+': '+ids.map(R.label).join(' '));
 if(recordFinish(r,p)&&r.finish.length===2)return settle(r,true);
 if(r.finish.length===3)return settle(r,false);
 r.turn=next(r,p.seat);
 notify(r);
}
function action(b){
 const [r,p]=auth(b),isHost=()=>err(r.host===p.token,'방장만 할 수 있어.');
 if(b.type==='ready'){err(r.phase==='lobby'&&!p.bot,'대기실에서만 준비 가능');p.ready=!!b.ready;notify(r)}
 else if(b.type==='addBot'||b.type==='fillBots'){
  isHost();err(r.phase==='lobby'&&r.players.length<4,'빈자리가 없어.');
  if(b.type==='addBot')r.players.push(player('🤖 봇 '+(r.players.filter(x=>x.bot).length+1),r.players.length,true));else fill(r);
  notify(r,'🤖 봇 입장');
 }else if(b.type==='removeBot'){
  isHost();err(r.phase==='lobby','대기실에서만 제거해.');
  const bot=r.players.find(x=>x.seat===Number(b.seat)&&x.bot);err(bot,'해당 봇이 없어.');
  r.players=r.players.filter(x=>x!==bot);r.players.forEach((x,i)=>x.seat=i);notify(r);
 }else if(b.type==='start'){
  isHost();err(r.phase==='lobby'&&r.players.length===4&&r.players.every(x=>x.ready),'4명 모두 준비해야 해.');newRound(r);
 }else if(b.type==='grand'){
  err(r.phase==='grand'&&p.grand===null,'선언 단계가 아니야.');
  p.grand=!!b.value;notify(r,p.name+'님 결정 완료'+(p.grand?' · 그랜드 티츄!':''));
  afterGrand(r);
 }else if(b.type==='trade'){
  err(r.phase==='trade'&&!p.trade,'카드 교환 단계가 아니야.');
  const selected=b.cards;
  err(selected&&typeof selected==='object'&&!Array.isArray(selected),'카드 교환을 지정해.');
  const keys=Object.keys(selected);
  err(keys.length===3&&keys.every(k=>['0','1','2','3'].includes(k)&&Number(k)!==p.seat),'팀원과 상대 양쪽에 각각 1장을 전달해.');
  const ids=Object.values(selected);
  err(new Set(ids).size===3&&ids.every(id=>p.hand.includes(id)),'서로 다른 내 카드 3장을 선택해.');
  p.trade=selected;notify(r,p.name+'님 교환 완료');afterTrade(r);
 }else if(b.type==='small'){
  err(r.phase==='play'&&!p.hasPlayed&&p.call!=='small'&&!p.grand,'첫 카드를 내기 전 한 번만 티츄를 선언할 수 있어.');
  p.call='small';notify(r,'⚡ '+p.name+'님 티츄 선언!');
 }else if(b.type==='play'){
  play(r,p,b.cards,b.variant,b.wish);
 }else if(b.type==='pass'){
  err(r.phase==='play'&&r.turn===p.seat&&!!r.table,'지금은 패스할 수 없어.');
  err(!wishes(r,p).length,'마작 요청 숫자를 낼 수 있으면 패스할 수 없어.');
  r.passes++;r.logs.push('↪ '+p.name+' 패스');
  const need=r.players.filter(x=>x.hand.length&&x.seat!==r.lastSeat).length;
  if(r.passes>=need)closeTrick(r);
  else{r.turn=next(r,p.seat);notify(r)}
 }else if(b.type==='dragon'){
  err(r.phase==='dragon'&&r.lastSeat===p.seat,'드래곤 소유자만 상대를 지정할 수 있어.');
  const receiver=r.players.find(x=>x.seat===Number(b.seat));err(receiver&&team(receiver.seat)!==team(p.seat),'상대 팀 한 명을 골라.');
  receiver.tricks.push(...r.pile);r.pile=[];r.table=null;r.passes=0;r.lastSeat=null;
  r.phase='play';r.turn=p.hand.length?p.seat:next(r,p.seat);
  notify(r,'🐉 드래곤 트릭을 '+receiver.name+'님에게 줬어.');
 }else if(b.type==='next'){
  isHost();err(r.phase==='roundEnd','라운드 결과 화면에서 진행해.');newRound(r);
 }else if(b.type==='restart'){
  isHost();err(r.phase==='matchEnd','경기가 끝나야 다시 시작할 수 있어.');
  r.scores=[0,0];r.round=0;newRound(r);
 }else if(b.type==='leave'){
  err(r.phase==='lobby','진행 중에는 새로고침으로 다시 접속해.');
  r.players=r.players.filter(x=>x!==p);r.players.forEach((x,i)=>x.seat=i);
  if(r.host===p.token)r.host=r.players.find(x=>!x.bot)?.token||null;
  if(!r.players.some(x=>!x.bot))rooms.delete(r.code);else notify(r,p.name+'님 퇴장');
  return {left:true};
 }else err(false,'알 수 없는 요청이야.');
 return state(r,p);
}
function state(r,p){
 const playing=r.stage!=='lobby';
 const v=r.phase==='play'?r.table:null;
 return {code:r.code,target:r.target,seat:p.seat,isHost:r.host===p.token,
  stage:r.stage,phase:r.phase,round:r.round,scores:[...r.scores],turn:r.turn,lead:r.lead,
  table:v?{...v}:r.phase==='dragon'?r.table:null,wish:r.wish,passes:r.passes,
  players:r.players.map(x=>({seat:x.seat,name:x.name,bot:x.bot,ready:x.ready,cardCount:x.hand.length,
    out:r.finish.indexOf(x.seat)+1||0,grand:x.grand===true,grandDecided:x.grand!==null,
    small:x.call==='small',traded:!!x.trade})),
  hand:playing?[...p.hand]:[],trade:p.trade,grand:p.grand,hasPlayed:p.hasPlayed,
  history:r.history.slice(-12),logs:r.logs.slice(-17),roundResult:r.roundResult,result:r.result,
  options:r.phase==='play'&&r.turn===p.seat?{canPass:!!r.table&&!wishes(r,p).length,wishForced:!!wishes(r,p).length}:null,
  cardsOnTable:r.pile.length};
}
function scheduleBot(r){
 if(r.stage==='lobby'||!['grand','trade','play','dragon'].includes(r.phase))return;
 const phases=r.phase;
 const target=phases==='grand'?r.players.find(x=>x.bot&&x.grand===null):
 phases==='trade'?r.players.find(x=>x.bot&&!x.trade):
 phases==='play'?r.players[r.turn]?.bot?r.players[r.turn]:null:
 r.players[r.lastSeat]?.bot?r.players[r.lastSeat]:null;
 if(!target)return;
 const sig=[r.round,r.phase,r.turn,r.passes,r.lastSeat,target.seat,r.history.length,r.players.map(p=>p.grand===null?'n':p.trade?'t':'x').join('')].join('/');
 if(r.botKey===sig)return;
 r.botKey=sig;
 setTimeout(()=>{
  if(r.botKey!==sig||r.phase!==phases)return;
  try{
   const b={code:r.code,token:target.token};
   if(phases==='grand'){
    const sum=target.hand.filter(x=>R.card(x)?.rank>=11).length;
    action({...b,type:'grand',value:sum>=6});
   }else if(phases==='trade'){
    const ids=target.hand.slice().sort((a,b)=>(R.card(a)?.rank||0)-(R.card(b)?.rank||0));
    const others=r.players.filter(x=>x.seat!==target.seat);
    const teammate=others.find(x=>team(x.seat)===team(target.seat));
    const enemies=others.filter(x=>x!==teammate);
    action({...b,type:'trade',cards:{[teammate.seat]:ids.at(-1),[enemies[0].seat]:ids[0],[enemies[1].seat]:ids[1]}});
   }else if(phases==='dragon'){
    const opp=r.players.filter(x=>team(x.seat)!==team(target.seat)).sort((a,b)=>b.hand.length-a.hand.length)[0];
    action({...b,type:'dragon',seat:opp.seat});
   }else{
    const options=R.combinations(target.hand,r.table,!r.table,r.wish);
    let eligible=r.wish?options.filter(o=>o.fulfills):[];
    if(!eligible.length)eligible=options;
    const mateOwner=r.table&&team(r.table.owner)===team(target.seat);
    if(mateOwner&&r.table&&!eligible.some(x=>r.wish&&x.fulfills)){
     action({...b,type:'pass'});return;
    }
    eligible.sort((a,b)=>{
     const aScore=(r.table?0:-8)*a.cards.length + a.variant.bomb*45+a.variant.power*.12+(a.cards.includes('DG')?12:0)-(!r.table?a.cards.length*2:0);
     const bScore=(r.table?0:-8)*b.cards.length + b.variant.bomb*45+b.variant.power*.12+(b.cards.includes('DG')?12:0)-(!r.table?b.cards.length*2:0);
     return aScore-bScore;
    });
    if(!eligible.length){if(r.table)action({...b,type:'pass'});return}
    const best=eligible[0];
    action({...b,type:'play',cards:best.cards,variant:best.variant,wish:best.cards.includes('MJ')?14:undefined});
   }
  }catch(e){r.logs.push('봇 처리 오류: '+e.message);r.botKey='';setTimeout(()=>scheduleBot(r),2000)}
 },phases==='grand'||phases==='trade'?550:950);
}
module.exports={rooms,create,find,auth,action,state,newRound,settle,play,closeTrick,scheduleBot};
