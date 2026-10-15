'use strict';
const crypto=require('node:crypto');
const rooms=new Map(),colors=['#ffb75b','#61ccef','#b999ff','#7ee0ac','#ff849b','#ffe086'];
const rand=n=>crypto.randomInt(n);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a};
const check=(ok,message)=>{if(!ok)throw Error(message)};
const uid=()=>crypto.randomUUID();
const roomCode=()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');
function player(name,seat,bot=false){return {name,seat,token:uid(),bot,ready:bot,color:colors[seat],pos:0,dir:'down',carry:[],bank:[],secured:[],home:false,lastReturn:0};}
function deck(){let chipId=0,all=[];for(let level=1;level<=4;level++){let group=[];for(let value=4*(level-1);value<level*4;value++)for(let k=0;k<2;k++)group.push({id:chipId++,value,level});all.push(...shuffle(group))}return all.map((chip,i)=>({id:'t'+i,chips:[chip]}))}
const lookup=code=>{const r=rooms.get(String(code||'').toUpperCase());check(r,'방을 찾지 못했어.');return r};
const auth=b=>{const r=lookup(b.code),p=r.players.find(x=>x.token===b.token);check(p,'방에 다시 참가해야 해.');return [r,p]};
function note(r,msg){if(msg)r.history.push(msg);r.history=r.history.slice(-20);r.updated=Date.now();for(const c of [...r.clients])try{c.write('data: refresh\n\n')}catch{r.clients.delete(c)};botSchedule(r)}
function newRoom(name,size,practice=false){
 check(Number.isInteger(size)&&size>=2&&size<=6,'2~6인만 가능해.');check(name,'닉네임을 입력해줘.');
 let code=roomCode();while(rooms.has(code))code=roomCode();
 const p=player(name,0),r={code,size,players:[p],hostToken:p.token,stage:'lobby',round:0,startSeat:0,turn:0,phase:null,oxygen:25,tiles:[],history:[],clients:new Set(),botTimer:null,returnSeq:0,endAfterTurn:false,results:null,turnNumber:0};
 rooms.set(code,r);
 if(practice){fillBots(r);begin(r)}
 return {code,token:p.token,state:publicState(r,p)};
}
function fillBots(r){while(r.players.length<r.size)r.players.push(player('🤖 봇 '+(r.players.filter(x=>x.bot).length+1),r.players.length,true))}
function score(p){return p.bank.reduce((a,b)=>a+b.value,0)}
function ranks(r){return r.players.map(p=>({seat:p.seat,name:p.name,score:score(p),levels:[4,3,2,1].map(l=>p.bank.filter(c=>c.level===l).length)}))
 .sort((a,b)=>b.score-a.score||b.levels[0]-a.levels[0]||b.levels[1]-a.levels[1]||b.levels[2]-a.levels[2]||b.levels[3]-a.levels[3])}
function publicState(r,p){
 return {code:r.code,size:r.size,stage:r.stage,round:r.round,oxygen:r.oxygen,turn:r.turn,phase:r.phase,
 isHost:p.token===r.hostToken,seat:p.seat,startSeat:r.startSeat,lastDice:r.lastDice,steps:r.steps,
 endAfterTurn:r.endAfterTurn,turnNumber:r.turnNumber,
 players:r.players.map(x=>({seat:x.seat,name:x.name,bot:x.bot,ready:x.ready,pos:x.pos,dir:x.dir,home:x.home,color:x.color,
 carrying:x.carry.length,bankCount:x.bank.length,securedCount:x.secured.reduce((n,b)=>n+b.chips.length,0),score:score(x)})),
 tiles:r.tiles.map((c,i)=>({id:c.id,index:i+1,blank:c.chips.length===0,level:c.chips.length?Math.max(...c.chips.map(x=>x.level)):0,stacked:c.chips.length>1,count:c.chips.length})),
 carry:p.carry.map(x=>({id:x.id,level:Math.max(...x.chips.map(c=>c.level)),count:x.chips.length})),
 bank:p.bank.map(c=>({level:c.level,value:c.value})),results:r.stage==='roundEnd'||r.stage==='matchEnd'?r.results:null,
 ranking:r.stage==='matchEnd'?ranks(r):null,history:r.history};
}
function startTurn(r){
 const p=r.players[r.turn];check(p&&!p.home,'순서 처리 오류');
 r.turnNumber++;r.oxygen=Math.max(0,r.oxygen-p.carry.length);r.endAfterTurn=r.oxygen===0;
 r.phase='choose';r.lastDice=null;r.steps=null;
 if(p.carry.length)r.history.push(p.name+' 산소 -'+p.carry.length+' (잔여 '+r.oxygen+')');
 if(r.endAfterTurn)r.history.push('🚨 산소 고갈! 현재 턴이 마지막이야.');
}
function begin(r){
 if(r.round===0)r.tiles=deck();
 r.round++;r.oxygen=25;r.stage='playing';r.turn=r.startSeat;r.endAfterTurn=false;r.lastDice=null;r.steps=null;r.history=[];
 r.players.forEach(x=>{x.pos=0;x.dir='down';x.carry=[];x.secured=[];x.home=false;x.lastReturn=0;x.ready=false});
 r.history.push('🌊 '+r.round+'라운드 시작! 산소 25');startTurn(r);note(r);
}
const busy=(r,pos,p)=>pos>0&&r.players.some(x=>x!==p&&!x.home&&x.pos===pos);
function move(r,p,n){
 let pos=p.pos,guard=0;
 while(n>0&&guard++<r.tiles.length+r.size+4){
  const next=pos+(p.dir==='down'?1:-1);
  if(next<0){pos=0;break}
  if(next>r.tiles.length)break;
  pos=next;if(!busy(r,pos,p))n--;
 }
 if(busy(r,pos,p))pos=p.pos;
 p.pos=pos;
}
function returned(r,p){p.home=true;p.pos=0;p.lastReturn=++r.returnSeq;p.secured=p.carry;p.carry=[];r.history.push('🚢 '+p.name+' 귀환 성공!')}
function finishRound(r){
 const fallen=r.players.filter(x=>!x.home).sort((a,b)=>a.pos-b.pos||a.seat-b.seat);
 const chips=[];for(const p of fallen){for(const b of p.carry)chips.push(...b.chips);p.carry=[]}
 r.tiles=r.tiles.filter(x=>x.chips.length);
 for(let i=0;i<chips.length;i+=3)r.tiles.push({id:'lost-'+r.round+'-'+i,chips:chips.slice(i,i+3)});
 const results=[];
 for(const p of r.players){
  const points=p.secured.flatMap(b=>b.chips).reduce((n,c)=>n+c.value,0);
  p.bank.push(...p.secured.flatMap(b=>b.chips));p.secured=[];
  results.push({seat:p.seat,name:p.name,points,score:score(p),home:p.home,levelCounts:[4,3,2,1].map(l=>p.bank.filter(c=>c.level===l).length)});
 }
 r.results=results;
 const home=r.players.filter(x=>x.home).sort((a,b)=>b.lastReturn-a.lastReturn);
 // House-rule fallback when nobody returned.
 r.startSeat=home.length?home[0].seat:(r.startSeat+1)%r.size;
 r.stage=r.round===3?'matchEnd':'roundEnd';r.phase='done';r.endAfterTurn=false;
 note(r,'🏁 잠수 종료! 심해에 남긴 보물 '+chips.length+'개');
}
function advance(r){
 if(r.endAfterTurn||r.players.every(x=>x.home)){finishRound(r);return}
 let next=r.turn;
 for(let k=0;k<r.size;k++){next=(next+1)%r.size;if(!r.players[next].home){r.turn=next;startTurn(r);note(r);return}}
 finishRound(r);
}
function action(b){
 const [r,p]=auth(b),host=()=>check(p.token===r.hostToken,'방장만 사용할 수 있어.');
 const active=()=>check(r.stage==='playing'&&r.players[r.turn]===p,'현재 차례가 아니야.');
 if(b.type==='ready'){check(r.stage==='lobby'&&!p.bot,'준비할 수 없어.');p.ready=!!b.ready;note(r)}
 else if(b.type==='fillBots'||b.type==='addBot'){host();check(r.stage==='lobby'&&r.players.length<r.size,'자리가 부족해.');if(b.type==='fillBots')fillBots(r);else r.players.push(player('🤖 봇 '+(r.players.filter(x=>x.bot).length+1),r.players.length,true));note(r,'봇 참가')}
 else if(b.type==='removeBot'){host();check(r.stage==='lobby','대기실에서만 가능해.');const x=r.players.find(x=>x.bot&&x.seat===Number(b.seat));check(x,'봇을 찾지 못했어.');r.players=r.players.filter(y=>y!==x);r.players.forEach((y,i)=>{y.seat=i;y.color=colors[i]});note(r)}
 else if(b.type==='start'){host();check(r.stage==='lobby'&&r.players.length===r.size&&r.players.every(x=>x.ready),'모두 준비해야 시작할 수 있어.');begin(r)}
 else if(b.type==='nextRound'){host();check(r.stage==='roundEnd','아직 라운드가 끝나지 않았어.');begin(r)}
 else if(b.type==='newMatch'){host();check(r.stage==='matchEnd','최종 종료 후 가능해.');r.stage='lobby';r.round=0;r.startSeat=0;r.tiles=[];r.history=[];r.players.forEach(x=>{x.bank=[];x.carry=[];x.secured=[];x.ready=x.bot;x.home=false;x.pos=0});note(r)}
 else if(b.type==='direction'){active();check(r.phase==='choose','방향 선택 차례가 아니야.');
  if(b.direction==='up'){check(p.dir==='up'||p.dir==='down'&&p.carry.length>0,'보물을 든 상태에서만 귀환할 수 있어.');p.dir='up'}
  else check(b.direction==='down'&&p.dir==='down','귀환 중에는 다시 내려갈 수 없어.');
  r.phase='roll';note(r,p.name+(p.dir==='up'?' ↗ 귀환 선택':' ↘ 잠수 선택'))}
 else if(b.type==='roll'){active();check(r.phase==='roll','먼저 방향을 골라줘.');
  const dice=[1+rand(3),1+rand(3)],dist=Math.max(0,dice[0]+dice[1]-p.carry.length);
  r.lastDice=dice;r.steps=dist;move(r,p,dist);
  r.history.push('🎲 '+p.name+' '+dice.join('+')+' - 보물 '+p.carry.length+' = '+dist+'칸');
  if(p.dir==='up'&&p.pos===0){returned(r,p);advance(r)}else{r.phase='loot';note(r)}}
 else if(['take','drop','skip'].includes(b.type)){active();check(r.phase==='loot','보물 행동 차례가 아니야.');
  const cell=r.tiles[p.pos-1];
  if(b.type==='take'){check(cell&&cell.chips.length,'이 칸에는 보물이 없어.');p.carry.push({id:cell.id,chips:cell.chips});cell.chips=[];r.history.push('💎 '+p.name+' 보물 줍기')}
  if(b.type==='drop'){check(cell&&!cell.chips.length&&p.carry.length,'빈칸에서만 보물을 놓을 수 있어.');const bundle=p.carry.find(x=>x.id===b.bundle);check(bundle,'운반 중인 보물을 선택해줘.');cell.chips=bundle.chips;p.carry=p.carry.filter(x=>x!==bundle);r.history.push(p.name+' 보물 내려놓기')}
  if(b.type==='skip')r.history.push(p.name+' 보물 행동 건너뜀');
  advance(r)}
 else if(b.type==='leave'){check(r.stage==='lobby','게임 중에는 나갈 수 없어.');r.players=r.players.filter(x=>x!==p);r.players.forEach((x,i)=>{x.seat=i;x.color=colors[i]});const humans=r.players.filter(x=>!x.bot);if(r.hostToken===p.token&&humans.length)r.hostToken=humans[0].token;if(!humans.length)rooms.delete(r.code);else note(r);return {left:true}}
 else check(false,'잘못된 요청이야.');
 return publicState(r,p);
}
function botSchedule(r){
 if(r.botTimer||r.stage!=='playing'||!r.players[r.turn]?.bot)return;
 const turn=r.turn,phase=r.phase,round=r.round;
 r.botTimer=setTimeout(()=>{
  r.botTimer=null;if(r.stage!=='playing'||turn!==r.turn||phase!==r.phase||round!==r.round)return;
  const p=r.players[r.turn];let b={code:r.code,token:p.token};
  if(phase==='choose'){const up=p.dir==='up'||(p.carry.length>0&&(r.oxygen<Math.max(8,p.pos+3)||p.pos>=13||p.carry.length>=3));b={...b,type:'direction',direction:up?'up':'down'}}
  else if(phase==='roll')b={...b,type:'roll'};
  else if(phase==='loot'){const cell=r.tiles[p.pos-1];b={...b,type:cell?.chips.length&&p.carry.length<3?'take':'skip'}}
  else return;
  try{action(b)}catch(e){r.history.push('봇 오류: '+e.message);note(r)}
 },480);
}
module.exports={rooms,newRoom,lookup,auth,player,action,publicState,score,ranks,begin,deck,move,finishRound};
