'use strict';
const crypto=require('node:crypto'),{drawMonster,COUNT}=require('./monsters');
const rooms=new Map(),rand=n=>crypto.randomInt(n);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const ensure=(b,m)=>{if(!b)throw Error(m)};
const id=()=>crypto.randomUUID(),roomCode=()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');
const COLORS=['#5bd6d0','#efae69','#9a9cf8','#df8db9','#8bc879','#6daee6','#e0d279','#d19d80'];
function human(name,seat){return {seat,name,color:COLORS[seat],token:id(),ready:false,score:0,drawing:null,submitted:false,vote:null}}
function room(code){const r=rooms.get(String(code||'').toUpperCase());ensure(r,'방을 찾지 못했어.');return r}
function auth(b){const r=room(b.code),p=r.players.find(x=>x.token===b.token);ensure(p,'플레이어 인증이 만료됐어.');return [r,p]}
function announce(r,log){
 if(log)r.history.push(log);r.history=r.history.slice(-30);
 for(const response of [...r.clients])try{response.write('data: refresh\n\n')}catch{r.clients.delete(response)}
}
function deadline(r,seconds,fn){
 if(r.timer)clearTimeout(r.timer);
 r.deadline=Date.now()+seconds*1000;
 const round=r.round,phase=r.phase;
 r.timer=setTimeout(()=>{r.timer=null;if(r.round===round&&r.phase===phase)fn(r)},seconds*1000);
}
function makeRoom(name,size,cycles){
 ensure(name,'닉네임을 입력해줘.');ensure(Number.isInteger(size)&&size>=3&&size<=8,'3~8명만 참가할 수 있어.');
 ensure([1,2].includes(cycles),'목격자 차례는 1회 또는 2회야.');
 let c=roomCode();while(rooms.has(c))c=roomCode();
 const p=human(name,0);
 const r={code:c,players:[p],hostToken:p.token,size,cycles,stage:'lobby',phase:'lobby',round:0,witness:0,
  deck:[],used:[],current:null,deadline:null,timer:null,history:[],clients:new Set(),witnessPick:null};
 rooms.set(c,r);return {code:c,token:p.token,state:publicState(r,p)};
}
function chooseCard(r){
 const available=r.deck.length?r.deck: Array.from({length:COUNT},(_,i)=>({type:'builtin',seed:i+1,id:'built-'+(i+1)}));
 let options=available.filter(card=>!r.used.includes(card.id));
 if(!options.length){r.used=[];options=available}
 const choice=options[rand(options.length)];r.used.push(choice.id);return choice;
}
function cardImage(card){return card?.type==='builtin'?drawMonster(card.seed):card?.img||null}
function resetForRound(r){
 r.round++;r.witness=(r.round-1)%r.size;r.witnessPick=null;r.current=chooseCard(r);
 for(const p of r.players){p.drawing=null;p.submitted=false;p.vote=null}
 r.stage='playing';r.phase='observe';
 deadline(r,20,beginDrawing);announce(r,'👁️ '+r.players[r.witness].name+'님이 20초 동안 괴물을 관찰 중!');
}
function beginDrawing(r){r.phase='draw';deadline(r,120,beginWitnessVote);announce(r,'✏️ 괴물 설명과 그림 그리기 시작! 120초')}
function beginWitnessVote(r){r.phase='witnessVote';deadline(r,90,autoWitnessVote);announce(r,'🖼 그림 공개! 목격자가 원본을 보지 않고 선택할 차례야.')}
function tally(r){
 const artists=r.players.filter(p=>p.seat!==r.witness);
 if(r.size===3){artists.find(x=>x.seat===r.witnessPick).score++}
 else {
  const counts=new Map(artists.map(p=>[p.seat,0]));
  for(const p of artists)if(counts.has(p.vote))counts.set(p.vote,counts.get(p.vote)+1);
  const max=Math.max(...counts.values());
  for(const p of artists){if(counts.get(p.seat)===max)p.score++}
  artists.find(x=>x.seat===r.witnessPick).score++;
  if(counts.get(r.witnessPick)===max)r.players[r.witness].score++;
 }
 r.phase='result';r.stage=r.round===r.size*r.cycles?'finished':'playing';
 r.deadline=null;if(r.timer)clearTimeout(r.timer);r.timer=null;
 announce(r,'🏆 '+r.round+'라운드 정산 완료!');
}
function beginArtistVote(r){
 if(r.size===3){tally(r);return}
 r.phase='artistVote';deadline(r,80,autoArtistVote);announce(r,'👾 원본 공개! 화가들은 가장 비슷한 그림에 투표해.');
}
function autoWitnessVote(r){
 const artists=r.players.filter(p=>p.seat!==r.witness);
 r.witnessPick=artists[rand(artists.length)].seat;beginArtistVote(r);
}
function autoArtistVote(r){
 const artists=r.players.filter(p=>p.seat!==r.witness);
 for(const p of artists)if(p.vote===null){const others=artists.filter(x=>x!==p);p.vote=others[rand(others.length)].seat}
 tally(r);
}
function validDrawing(x){return typeof x==='string'&&x.length<360000&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(x)}
function act(b){
 const [r,p]=auth(b),host=()=>ensure(p.token===r.hostToken,'방장만 사용할 수 있어.');
 const live=phase=>ensure(r.phase===phase,'지금은 해당 단계가 아니야.');
 if(b.type==='ready'){
  live('lobby');p.ready=!!b.ready;announce(r);
 }else if(b.type==='start'){
  host();live('lobby');ensure(r.players.length===r.size&&r.players.every(x=>x.ready),'모든 사람이 준비해야 해.');
  resetForRound(r);
 }else if(b.type==='upload'){
  host();live('lobby');ensure(r.deck.length<100,'몬스터 사진은 최대 100장이야.');
  ensure(validDrawing(b.image)&&b.image.length<280000,'JPG/PNG/WEBP 이미지를 200KB 이하로 줄여서 올려줘.');
  r.deck.push({type:'custom',id:id(),img:b.image});announce(r,'📸 새 몬스터 카드 추가 · '+r.deck.length+'장');
 }else if(b.type==='clearDeck'){
  host();live('lobby');r.deck=[];r.used=[];announce(r,'추가한 이미지 덱을 비웠어.');
 }else if(b.type==='save'||b.type==='submit'){
  live('draw');ensure(p.seat!==r.witness,'목격자는 그림을 그릴 수 없어.');
  ensure(!p.submitted,'이미 제출했어.');
  if(b.image!==undefined){ensure(validDrawing(b.image),'그림 데이터가 잘못됐어.');p.drawing=b.image}
  if(b.type==='submit'){p.submitted=true;announce(r,p.name+'님 그림 제출 완료');}
  if(r.players.filter(x=>x.seat!==r.witness).every(x=>x.submitted))beginWitnessVote(r);
 }else if(b.type==='witnessPick'){
  live('witnessVote');ensure(p.seat===r.witness,'목격자만 선택할 수 있어.');
  const who=Number(b.seat);ensure(Number.isInteger(who)&&who>=0&&who<r.size&&who!==r.witness,'화가를 골라줘.');
  r.witnessPick=who;beginArtistVote(r);
 }else if(b.type==='artistVote'){
  live('artistVote');ensure(p.seat!==r.witness,'목격자는 투표할 수 없어.');
  ensure(p.vote===null,'이미 투표했어.');
  const who=Number(b.seat);ensure(Number.isInteger(who)&&who>=0&&who<r.size&&who!==r.witness&&who!==p.seat,'본인이나 목격자에게 투표할 수 없어.');
  p.vote=who;announce(r,p.name+'님 투표 완료');
  if(r.players.filter(x=>x.seat!==r.witness).every(x=>x.vote!==null))tally(r);
 }else if(b.type==='next'){
  host();live('result');ensure(r.stage!=='finished','게임이 이미 끝났어.');resetForRound(r);
 }else if(b.type==='again'){
  host();ensure(r.stage==='finished','최종 결과가 아니야.');
  if(r.timer)clearTimeout(r.timer);r.stage='lobby';r.phase='lobby';r.round=0;r.used=[];
  r.players.forEach(x=>{x.score=0;x.ready=false;x.drawing=null;x.vote=null});
  announce(r,'새 경기 준비!');
 }else if(b.type==='leave'){
  live('lobby');r.players=r.players.filter(x=>x!==p);r.players.forEach((x,i)=>{x.seat=i;x.color=COLORS[i]});
  if(r.hostToken===p.token&&r.players.length)r.hostToken=r.players[0].token;
  if(!r.players.length){rooms.delete(r.code)}else announce(r,p.name+'님 퇴장');return {left:true};
 }else ensure(false,'알 수 없는 행동이야.');
 return publicState(r,p);
}
function publicState(r,p){
 const revealDraw=['witnessVote','artistVote','result'].includes(r.phase),revealImage=['artistVote','result'].includes(r.phase);
 return {code:r.code,seat:p.seat,isHost:r.hostToken===p.token,size:r.size,cycles:r.cycles,round:r.round,totalRounds:r.size*r.cycles,
 stage:r.stage,phase:r.phase,deadline:r.deadline,serverNow:Date.now(),witness:r.witness,deckCount:r.deck.length,
 players:r.players.map(x=>({seat:x.seat,name:x.name,color:x.color,ready:x.ready,score:x.score,submitted:x.submitted,voted:x.vote!==null,
  drawing:revealDraw&&x.seat!==r.witness?x.drawing:null})),
 image:(r.phase==='observe'&&r.witness===p.seat||revealImage)?cardImage(r.current):null,
 myDrawing:r.phase==='draw'&&p.seat!==r.witness?p.drawing:null,
 witnessPick:r.phase==='result'?r.witnessPick:null,
 votes:r.phase==='result'?r.players.map(x=>({seat:x.seat,vote:x.vote})):null,history:r.history.slice(-20)};
}
module.exports={rooms,makeRoom,room,auth,act,publicState,beginDrawing,beginWitnessVote,beginArtistVote,tally,resetForRound};
