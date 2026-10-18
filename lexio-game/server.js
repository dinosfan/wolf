'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const R=require('./rules');
const B=require('./bots');
const S=require('./special');
const rooms=new Map();
const DEFAULT_ROUNDS=5;
// The official set has 18 cards; this game clearly labels its 17 verified-card adaptation.
const rand=n=>crypto.randomInt(n);
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function code(){return Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');}
function assert(ok,msg){if(!ok)throw Error(msg);}
function room(s){const r=rooms.get(String(s||'').toUpperCase());assert(r,'방을 찾지 못했습니다. 새 방을 만드세요.');return r;}
function auth(b){const r=room(b.code),p=r.players.find(p=>p.token===b.token);assert(p,'플레이어 인증이 만료되었습니다.');return [r,p];}
function notify(r){for(const res of [...r.clients]){try{res.write('data: refresh\n\n')}catch{r.clients.delete(res)}}}
function touch(r,msg){if(msg)r.history.push(msg);r.history=r.history.slice(-20);r.updated=Date.now();notify(r);scheduleBot(r);}
const REACTIONS=['😂','🔥','😭','⏰','😎','😱'];
function emitFx(r,type,seat,details={}){
 const event={id:++r.fxSeq,type,seat,ts:Date.now(),round:r.round,...details};
 r.fxEvents.push(event);
 if(r.fxEvents.length>24)r.fxEvents.splice(0,r.fxEvents.length-24);
}
function newBot(r){
 const numbers=new Set(r.players.filter(p=>p.isBot).map(p=>p.botNum));
 let botNum=1;while(numbers.has(botNum))botNum++;
 return {seat:r.players.length,name:'🤖 봇 '+botNum,botNum,isBot:true,token:crypto.randomUUID(),ready:true,hand:[],chips:64,special:[],usedSpecial:false,settled:false};
}
function fillBots(r){
 while(r.players.length<r.size)r.players.push(newBot(r));
}
function scheduleBot(r){
 if(r.botTimer||r.stage!=='playing'||!r.players[r.turn]?.isBot)return;
 const round=r.round,code=r.code;
 r.botTimer=setTimeout(()=>{
  r.botTimer=null;
  if(!rooms.has(code)||r.stage!=='playing'||r.round!==round)return;
  const p=r.players[r.turn];
  if(!p?.isBot)return;
  if(r.mode==='official'&&!p.usedSpecial&&!r.fairGame){
   const targets=r.players.filter(q=>q.seat!==p.seat);
   try{
    if(p.special.includes('gift')&&p.hand.length===1){
     const t=[...targets].sort((a,b)=>a.hand.length-b.hand.length)[0];
     action({code:r.code,token:p.token,type:'useSpecial',card:'gift',tile:p.hand[0],target:t.seat});return;
    }
    if(p.special.includes('mortal')&&p.hand.length>0&&p.hand.length<=4){
     const n=R.tile(p.hand[0]).n;
     if(p.hand.every(id=>R.tile(id).n===n)){
      action({code:r.code,token:p.token,type:'useSpecial',card:'mortal',number:n});return;
     }
    }
    if(p.special.includes('skip')&&r.skipSeat==null){
     const target=[...targets].filter(q=>q.hand.length<=2).sort((a,b)=>a.hand.length-b.hand.length)[0];
     if(target){
      action({code:r.code,token:p.token,type:'useSpecial',card:'skip',target:target.seat});return;
     }
    }
   }catch(e){r.history.push('봇 특수카드 오류: '+String(e.message));}
  }
  const rivals=r.players.filter(x=>x.seat!==p.seat).map(x=>x.hand.length);
  const decision=B.botMove(p.hand,r.maxNum,r.trick?.ev||null,rivals);
  try{
   action({code:r.code,token:p.token,type:decision.type,ids:decision.ids});
  }catch(e){
   // If a generated move is rejected, fall back to a safe legal single or pass.
   try{
    if(r.trick)action({code:r.code,token:p.token,type:'pass'});
    else action({code:r.code,token:p.token,type:'play',ids:[p.hand[0]]});
   }catch(err){r.history.push('봇 진행 중 오류: '+String(err.message));notify(r);}
  }
 },750);
}
function stopRoomTimers(r){
 if(r.botTimer){clearTimeout(r.botTimer);r.botTimer=null;}
 if(r.settleTimer){clearTimeout(r.settleTimer);r.settleTimer=null;}
}
function publicState(r,p){
 return {code:r.code,stage:r.stage,round:r.round,maxRounds:r.maxRounds,mode:r.mode,expansionAvailable:false,seat:p.seat,size:r.size,tilesPerPlayer:r.size===4?13:r.size===6?10:12,maxNum:r.maxNum,
 isHost:p.token===r.hostToken,
 specialCards:S.publicCards(r,p),usedSpecial:!!p.usedSpecial,armedScore:p.armedScore||null,fairGame:!!r.fairGame,skipSeat:r.skipSeat??null,
 settlement:r.stage==='settlement'?{done:r.players.map(q=>!!q.settled),deadline:r.settleEnds,winner:r.winner}:null,
 players:r.players.map(q=>({seat:q.seat,name:q.name,ready:q.ready,count:q.hand.length,chips:q.chips,isBot:!!q.isBot})),
 hand:[...p.hand],turn:r.turn,leader:r.leader,passes:r.passes,fxSeq:r.fxSeq,effects:r.fxEvents.slice(-16),
 trick:r.trick?{by:r.trick.by,ids:r.trick.ids,name:r.trick.ev.name,joker:r.trick.joker||null}:null,
 history:r.history,results:r.results,winner:r.winner,winnerName:r.winnerName||null};
}
function begin(r){
 if(r.mode==='official'&&r.round===0)S.deal(r,shuffle);
 r.players.forEach(p=>{p.usedSpecial=false;p.settled=false;p.armedScore=null});r.fairGame=false;r.skipSeat=null;
 const deck=shuffle(Array.from({length:r.maxNum*4},(_,i)=>i));
 const per=r.size===4?13:r.size===6?10:12;
 r.players.forEach((p,i)=>{p.hand=R.sortTiles(deck.slice(i*per,(i+1)*per),r.maxNum);p.ready=false;});
 const p=r.players.find(x=>x.hand.includes((3-1)*4+0));
 r.turn=p.seat;r.leader=p.seat;r.trick=null;r.passes=0;r.round++;r.stage='playing';r.results=null;r.winner=null;
 r.winnerName=null;
 r.history=[r.players[r.turn].name+'님이 구름 3을 가져 선이 됐습니다.'];
 emitFx(r,'round',p.seat);touch(r);
}
function finalizeRound(r){
 if(r.stage!=='settlement')return;
 const {effective,delta}=r.mode==='official'?S.settlementScores(r):R.calculateScores(r.players.map(p=>p.hand));
 r.players.forEach((p,i)=>p.chips+=delta[i]);
 r.results=r.players.map((p,i)=>({seat:p.seat,name:p.name,left:p.hand.length,twos:p.hand.filter(id=>R.tile(id).n===2).length,
   effective:effective[i],delta:delta[i],chips:p.chips}));
 r.stage=(r.round>=r.maxRounds||r.players.some(p=>p.chips<=0))?'matchEnd':'roundEnd';
 if(r.settleTimer){clearTimeout(r.settleTimer);r.settleTimer=null;}
 touch(r,r.round+'라운드 점수 정산 완료!');
}
function scoring(r,winner){
 r.winner=winner;r.winnerName=r.players[winner].name;emitFx(r,'win',winner);
 r.stage='settlement';
 if(r.mode==='official'){
  r.settleCards=[];r.settleEnds=Date.now()+60000;
  r.players.forEach(p=>p.settled=false);
  for(const q of r.players.filter(x=>!x.isBot)){
   const card=q.armedScore;
   q.armedScore=null;
   if(card&&S.eligibleSettlement(r,q,card)){
    S.useSettlement(r,q,card);
    r.history.push(q.name+'님이 예약한 ['+S.cards[card].name+']를 자동 사용했습니다.');
   }
  }
  for(const bot of r.players.filter(p=>p.isBot)){
   const candidates=bot.seat===winner?['winner','underdog']:['silver'];
   const chosen=candidates.find(id=>S.eligibleSettlement(r,bot,id));
   if(chosen)S.useSettlement(r,bot,chosen);
   else bot.settled=true;
  }
  r.settleTimer=setTimeout(()=>{if(r.stage==='settlement')finalizeRound(r)},60000);
  touch(r,r.players[winner].name+'님이 '+r.round+'라운드 승리! 정산 특수카드를 확인하고 60초 안에 확정하세요.');
 }else finalizeRound(r);
}
function applySkippedTurn(r){
 if(r.skipSeat==null||r.stage!=='playing'||r.turn!==r.skipSeat)return;
 const seat=r.skipSeat;r.skipSeat=null;
 if(r.trick){
  r.passes++;
  if(r.passes>=r.size-1){
   const last=r.trick.by;r.turn=last;r.leader=last;r.trick=null;r.passes=0;
  }else r.turn=(seat+1)%r.size;
 }else r.turn=(seat+1)%r.size;
 r.history.push(r.players[seat].name+'님이 특수카드로 강제 패스했습니다.');
}

function action(b){
 const [r,p]=auth(b),host=()=>assert(p.token===r.hostToken,'방장만 할 수 있어요.');
 const next=i=>(i+1)%r.size;
 if(b.type==='configure'){
  host();assert(r.stage==='lobby','대기실에서만 경기 설정을 바꿀 수 있어요.');
  const size=Number(b.size),maxRounds=Number(b.maxRounds),mode=String(b.mode||'');
  assert(Number.isInteger(size)&&size>=3&&size<=6,'인원은 3~6명으로 설정하세요.');
  assert([3,5].includes(maxRounds),'라운드는 3 또는 5만 선택할 수 있어요.');
  assert(['basic','official'].includes(mode),'기본 또는 공식 확장 중 선택하세요.');
  assert(mode!=='official'||size<=5,'공식 확장 확인판은 3~5명만 지원합니다.');
  const humans=r.players.filter(q=>!q.isBot).length;
  assert(size>=humans,'입장한 사람 수보다 작게 설정할 수 없어요.');
  const changed=size!==r.size||maxRounds!==r.maxRounds||mode!==r.mode;
  while(r.players.length>size){const idx=r.players.findLastIndex(q=>q.isBot);assert(idx!==-1,'인원 변경을 할 수 없어요.');r.players.splice(idx,1);}
  r.players.forEach((q,i)=>{q.seat=i;if(changed)q.ready=!!q.isBot});
  r.size=size;r.maxNum=size===3?9:size===4?13:15;r.maxRounds=maxRounds;r.mode=mode;
  touch(r,changed?'방장이 설정을 변경했어요. 모두 다시 준비해 주세요.':null);
 }else if(b.type==='armScore'){
  assert(r.mode==='official'&&r.stage==='playing'&&!p.isBot,'경기 중 사람 플레이어만 정산 카드를 예약할 수 있어요.');
  const card=String(b.card||'');
  if(!card||card===p.armedScore){p.armedScore=null;touch(r);}
  else{
   assert(S.cards[card]?.kind==='score'&&p.special?.includes(card),'보유 중인 정산용 특수카드를 선택해 주세요.');
   assert(!p.usedSpecial&&!r.fairGame,'이번 라운드에는 특수카드 사용이 제한되어 있어요.');
   p.armedScore=card;
   touch(r,p.name+'님이 정산용 특수카드를 예약했습니다.');
  }
 }else if(b.type==='useSpecial'){
  assert(r.mode==='official','기본판에서는 특수카드를 사용할 수 없어요.');
  S.useTurn(r,p,b,{rand,touch,emitFx,scheduleBot,scoring,applySkippedTurn});applySkippedTurn(r);
 }else if(b.type==='settleCard'){
  assert(r.mode==='official','기본판에서는 사용할 수 없어요.');
  S.useSettlement(r,p,String(b.card||''));touch(r,p.name+'님이 정산 특수카드를 선택했어요.');
  if(r.players.every(q=>q.settled))finalizeRound(r);
 }else if(b.type==='settlePass'){
  assert(r.stage==='settlement'&&!p.settled,'이미 정산을 마쳤어요.');
  p.settled=true;touch(r,p.name+'님이 정산을 확정했습니다.');
  if(r.players.every(q=>q.settled))finalizeRound(r);
 }else if(b.type==='ready'){ 
  assert(r.stage==='lobby'&&!p.isBot,'대기실에서 사람만 준비할 수 있어요.');p.ready=!!b.ready;touch(r);
 }else if(b.type==='addBot'){
  host();assert(r.stage==='lobby'&&r.players.length<r.size,'대기실에 빈 자리가 있어야 봇을 넣을 수 있어요.');
  const bot=newBot(r);r.players.push(bot);touch(r,bot.name+'님이 참가했습니다.');
 }else if(b.type==='fillBots'){
  host();assert(r.stage==='lobby'&&r.players.length<r.size,'봇을 추가할 빈 자리가 없어요.');
  const count=r.size-r.players.length;fillBots(r);touch(r,'빈자리 '+count+'개를 봇으로 채웠습니다.');
 }else if(b.type==='removeBot'){
  host();assert(r.stage==='lobby','대기실에서만 봇을 제거할 수 있어요.');
  const seat=Number(b.seat),bot=r.players.find(q=>q.seat===seat&&q.isBot);
  assert(bot,'제거할 봇을 찾지 못했어요.');
  r.players=r.players.filter(q=>q!==bot);r.players.forEach((q,i)=>q.seat=i);
  touch(r,bot.name+'님을 내보냈습니다.');
 }else if(b.type==='shuffle'){
  host();assert(r.stage==='lobby','게임 시작 전만 자리를 섞을 수 있어요.');
  shuffle(r.players).forEach((q,i)=>q.seat=i);
  r.players.sort((a,b)=>a.seat-b.seat);r.players.forEach(q=>q.ready=!!q.isBot);touch(r,'좌석 순서를 섞었습니다.');
 }else if(b.type==='start'){
  host();assert(r.stage==='lobby'&&r.players.length===r.size&&r.players.every(p=>p.ready),'설정된 인원 모두 준비해야 시작할 수 있어요.');
  assert(r.mode==='basic'||r.size<=5,'공식 확장 확인판은 3~5명만 지원합니다.');
  begin(r);
 }else if(b.type==='nextRound'){
  host();assert(r.stage==='roundEnd','라운드 종료 후에 가능합니다.');begin(r);
 }else if(b.type==='newMatch'){
  host();assert(r.stage==='matchEnd','최종 결과 화면에서 가능합니다.');
  r.stage='lobby';r.round=0;r.trick=null;r.history=[];r.results=null;r.winner=null;r.winnerName=null;r.settleCards=[];r.skipSeat=null;r.fairGame=false;
  r.players.forEach(q=>{q.chips=64;q.hand=[];q.special=[];q.usedSpecial=false;q.armedScore=null;q.settled=false;q.ready=!!q.isBot;});touch(r);
 }else if(b.type==='pass'){
  assert(r.stage==='playing'&&p.seat===r.turn,'내 차례에만 패스할 수 있어요.');
  assert(r.trick,'선 플레이어는 패스할 수 없어요.');
  r.passes++;
  emitFx(r,'pass',p.seat);
  if(r.passes>=r.size-1){
   const last=r.trick.by;r.turn=last;r.leader=last;r.trick=null;r.passes=0;
   applySkippedTurn(r);touch(r,p.name+'님 패스 · 모두 패스하여 '+r.players[last].name+'님이 새로 선이 됐습니다.');
  }else{r.turn=next(r.turn);applySkippedTurn(r);touch(r,p.name+'님이 패스했습니다.');}
 }else if(b.type==='play'){
  assert(r.stage==='playing'&&p.seat===r.turn,'지금은 내 차례가 아니에요.');
  const ids=b.ids;
  assert(Array.isArray(ids)&&ids.length>=0&&ids.length<=5&&ids.every(Number.isInteger)&&new Set(ids).size===ids.length,'선택한 타일을 확인해 주세요.');
  assert(ids.every(id=>p.hand.includes(id)),'내 패에 없는 타일은 낼 수 없어요.');
  const withJoker=r.mode==='official'&&b.jokerCard!=null;
  assert(ids.length||withJoker,'타일을 선택해 주세요.');
  const joker=withJoker?S.handEvalWithJoker(r,p,ids,String(b.jokerCard),Number(b.jokerNum)):null;
  const ev=joker?joker.ev:R.evaluate(ids,r.maxNum);assert(ev,'허용되는 조합이 아니에요. (1·2·3·5장만 가능)');
  if(r.trick){
   assert(ev.size===r.trick.ev.size,'앞사람과 같은 개수로 내야 해요.');
   assert(R.compare(ev,r.trick.ev)>0,'더 높은 족보를 내야 해요.');
  }
  p.hand=p.hand.filter(id=>!ids.includes(id));
  if(joker)S.spend(r,p,String(b.jokerCard));
  r.trick={by:p.seat,ids:R.sortTiles(joker?joker.full:ids,r.maxNum),ev,joker:joker?{tile:joker.tileId,name:S.cards[b.jokerCard].name}:null};r.passes=0;r.leader=p.seat;
  r.turn=next(p.seat);applySkippedTurn(r);
  emitFx(r,'play',p.seat,{ids:[...r.trick.ids],name:ev.name});
  touch(r,p.name+'님이 '+ev.name+' '+(ids.length+(joker?1:0))+'장을 냈습니다.');
  if(!p.hand.length)scoring(r,p.seat);
 }else if(b.type==='react'){
  assert((r.stage==='playing'||r.stage==='roundEnd'||r.stage==='matchEnd')&&!p.isBot,'게임 중인 플레이어만 반응할 수 있어요.');
  const emoji=String(b.emoji||'');
  assert(REACTIONS.includes(emoji),'지원하지 않는 이모지예요.');
  const hurry=emoji==='⏰';
  assert(!hurry||(r.stage==='playing'&&r.turn!==p.seat),'재촉은 상대 차례에만 보낼 수 있어요.');
  const now=Date.now();
  assert(!p.lastReactionAt||now-p.lastReactionAt>=1100,'이모지는 잠깐 간격을 두고 보내주세요.');
  assert(!hurry||!p.lastHurryAt||now-p.lastHurryAt>=5000,'재촉은 5초에 한 번 보낼 수 있어요.');
  p.lastReactionAt=now;
  if(hurry)p.lastHurryAt=now;
  emitFx(r,'emoji',p.seat,hurry?{emoji,targetSeat:r.turn}:{emoji});touch(r);
 }else if(b.type==='leave'){
  // Never change seats during a running game: trick ownership, turn, score, and
  // private hands must continue to point at the same seat.
  const remainingHumans=r.players.filter(q=>!q.isBot&&q.token!==p.token);
  if(!remainingHumans.length){
   stopRoomTimers(r);
   rooms.delete(r.code);
   for(const client of r.clients){try{client.end()}catch{}}
   r.clients.clear();
   return {left:true};
  }
  if(r.hostToken===p.token)r.hostToken=remainingHumans[0].token;
  if(r.stage==='lobby'){
   r.players=r.players.filter(q=>q!==p);
   r.players.forEach((q,i)=>q.seat=i);
  }else{
   // Bot inherits the seat and all round/match state, but NOT the departed
   // player's authentication token. It can play or settle for the old seat.
   const bot=newBot(r);
   bot.seat=p.seat;
   bot.name='🤖 '+p.name.slice(0,10)+' 자리';
   bot.hand=[...p.hand];bot.chips=p.chips;bot.special=[...(p.special||[])];
   bot.usedSpecial=!!p.usedSpecial;bot.settled=!!p.settled;
   bot.ready=true;
   r.players[p.seat]=bot;
   if(r.stage==='settlement'&&!bot.settled){
    // Explicit exit forfeits any optional settlement card decision.
    bot.settled=true;
   }
  }
  touch(r,p.name+'님이 방을 나갔습니다.'+(r.stage==='lobby'?'':' 남은 자리는 봇이 이어받습니다.'));
  if(r.stage==='settlement'&&r.players.every(q=>q.settled))finalizeRound(r);
  return {left:true};
 }else assert(false,'잘못된 요청입니다.');
 return publicState(r,p);
}
function practiceSize(b){return b.practice===true?Number(b.size??4):4;}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function data(req){
 return new Promise((resolve,reject)=>{let b='',closed=false;
 req.on('data',v=>{b+=v;if(b.length>12000&&!closed){closed=true;reject(Error('요청 데이터가 너무 커요.'));}});
 req.on('end',()=>{if(closed)return;try{resolve(JSON.parse(b||'{}'))}catch{reject(Error('요청 형식이 잘못됐어요.'))}});
 req.on('error',reject);
 });
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,name:'Lexio 3-6 with bots'});
  if(req.method==='POST'&&url.pathname==='/api/create'){
   const b=await data(req),name=String(b.name||'').trim().slice(0,14),size=practiceSize(b),practice=b.practice===true;
   assert(name,'닉네임을 적어 주세요.');assert(Number.isInteger(size)&&size>=3&&size<=6,'게임 인원은 3~6명만 가능합니다.');let c=code();while(rooms.has(c))c=code();
   const p={seat:0,name,token:crypto.randomUUID(),ready:false,hand:[],chips:64,special:[],usedSpecial:false,settled:false};
   const r={code:c,size,maxNum:size===3?9:size===4?13:15,maxRounds:DEFAULT_ROUNDS,mode:'basic',settleCards:[],skipSeat:null,fairGame:false,players:[p],hostToken:p.token,stage:'lobby',round:0,clients:new Set(),trick:null,history:[],fxSeq:0,fxEvents:[],updated:Date.now()};
   rooms.set(c,r);if(practice){fillBots(r);begin(r);}return json(res,200,{code:c,token:p.token,state:publicState(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/join'){
   const b=await data(req),r=room(b.code),name=String(b.name||'').trim().slice(0,14);
   assert(r.stage==='lobby'&&r.players.length<r.size,'참가할 수 없는 방이에요.');
   assert(name&&!r.players.some(p=>p.name===name),'이미 쓰는 닉네임이거나 이름이 비어 있어요.');
   const p={seat:r.players.length,name,token:crypto.randomUUID(),ready:false,hand:[],chips:64,special:[],usedSpecial:false,settled:false};
   r.players.push(p);touch(r,name+'님이 참가했습니다.');
   return json(res,200,{code:r.code,token:p.token,state:publicState(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/action')return json(res,200,action(await data(req)));
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const [r,p]=auth(Object.fromEntries(url.searchParams));return json(res,200,publicState(r,p));
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   const [r,p]=auth(Object.fromEntries(url.searchParams));
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return json(res,405,{error:'허용하지 않는 요청'});
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.js','style.css'].includes(name))return json(res,404,{error:'찾을 수 없는 경로'});
  const file=path.join(__dirname,'public',name);
  return fs.readFile(file,(err,b)=>{
   if(err)return json(res,404,{error:'파일을 찾지 못했습니다.'});
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(b);
  });
 }catch(e){return json(res,400,{error:e.message||'요청 처리 오류'});}
});
server.listen(process.env.PORT||3000,'0.0.0.0');
