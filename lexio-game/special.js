'use strict';
/*
 * New Lexio: independently confirmed card effects from Lexio Japan official posts.
 * Complete 18-card digital adaptation: 10 Changers + 8 Jokers.
 * New Beginning is usable in the first 3 seconds after the initial deal.
 * The exact digital timing of non-turn Changers and simultaneous settlements
 * is specified below as a transparent online adaptation.
 * References in IMPLEMENTATION_STATUS.md.
 */
const R=require('./rules');
const CHANGERS=[
 ['newBeginning','새로운 시작','첫 라운드 패 분배 직후 3초 안에 사용하면 모든 플레이어의 타일을 다시 섞어 배분합니다.','opening'],
 ['winner','승자 독식','라운드 1등이면 다른 사람이 받을 점수까지 모두 받습니다.','score'],
 ['silver','실버 라이닝','최하위일 때 각 상대에게 내는 점수를 최대 1점으로 줄입니다.','score'],
 ['underdog','하극상','내가 1등이면 2등과 꼴찌의 남은 패 환산 개수를 맞바꿉니다.','score'],
 ['double','더블샷','한 턴에 동일한 장수의 합법 족보 두 개를 연달아 냅니다.','turn'],
 ['barter','물물교환','내 타일 1개를 선택한 상대의 무작위 타일 1개와 교환합니다.','turn'],
 ['fair','공정한 게임','지금부터 이번 라운드의 모든 특수카드 사용을 막습니다.','turn'],
 ['gift','원치 않는 선물','내 타일 1개를 원하는 상대에게 건넵니다.','turn'],
 ['mortal','치명적 운명','숫자 하나를 지정해 모든 플레이어 손에서 해당 숫자를 버립니다.','turn'],
 ['skip','기회 박탈','상대 한 명의 다음 차례를 한 번 강제로 패스시킵니다.','turn']
];
const JOKERS=[['sun',3,'눈부신 태양'],['moon',2,'부드러운 달빛'],['star',1,'은은한 별빛'],['cloud',0,'폭신한 구름']];
const cards=Object.fromEntries([
 ...CHANGERS.map(([id,name,desc,kind])=>[id,{id,name,desc,kind}]),
 ...JOKERS.flatMap(([suit,s,name])=>[1,2].map(k=>['joker-'+suit+'-'+k,
    {id:'joker-'+suit+'-'+k,name,desc:'같은 문양의 정해진 저숫자 타일 한 장을 대신합니다.',kind:'joker',suit:s,copy:k}]))
]);
const deck=Object.keys(cards);
function deal(r,shuffle){
 const d=shuffle(deck);
 if(d.length<r.players.length*3)throw Error('공식 확장 확인판은 3~5인으로만 진행할 수 있어요.');
 r.players.forEach((p,i)=>{p.special=d.slice(i*3,i*3+3);p.usedSpecial=false;p.settled=false;});
}
function available(r,p,id){
 if(r.mode!=='official'||!cards[id]||!p.special?.includes(id)||p.usedSpecial||r.fairGame)return false;
 return true;
}
function spend(r,p,id){if(!available(r,p,id))throw Error('이 특수카드를 사용할 수 없어요. (라운드당 1장)');
 p.usedSpecial=true;p.armedScore=null;p.special=p.special.filter(x=>x!==id);}
function jokerTile(id,num,size){
 const card=cards[id],limit=size===3?5:size===4?6:7;
 if(!card||card.kind!=='joker'||!Number.isInteger(num)||num<3||num>limit)
  throw Error('조커는 현재 인원에 허용된 3~'+limit+' 숫자만 대신할 수 있어요.');
 return (num-1)*4+card.suit;
}
function handEvalWithJoker(r,p,ids,id,num){
 if(!available(r,p,id)||cards[id].kind!=='joker')throw Error('선택한 조커를 사용할 수 없어요.');
 const tileId=jokerTile(id,num,r.size),full=[...ids,tileId];
 if(ids.includes(tileId))throw Error('실제 타일과 조커를 같은 타일로 동시에 사용할 수 없어요.');
 const ev=R.evaluate(full,r.maxNum);
 if(!ev)throw Error('조커를 포함한 조합이 올바르지 않아요.');
 if(r.trick&&(ev.size!==r.trick.ev.size||R.compare(ev,r.trick.ev)<=0))throw Error('기존 조합을 이기는 조커 조합만 낼 수 있어요.');
 return {tileId,full,ev};
}
function useTurn(r,p,b,api){
 const id=String(b.card||'');
 if(!available(r,p,id))throw Error('보유하지 않거나 이미 사용한 특수카드예요.');
 if(r.stage!=='playing'||r.turn!==p.seat)throw Error('특수 행동 카드는 내 차례에만 사용할 수 있어요.');
 const own=id==='fair'||id==='mortal'||id==='gift'||id==='barter'||id==='skip'||id==='double';
 if(!own)throw Error('이 카드는 타일 제출 또는 라운드 정산 화면에서 사용하세요.');
 const target=r.players[Number(b.target)];
 if(['gift','barter','skip'].includes(id)){
  if(!target||target.seat===p.seat)throw Error('다른 플레이어를 선택해 주세요.');
  if(id==='barter'&&!target.hand.length)throw Error('교환 상대에게 타일이 없어요.');
 }
 let winner=null;
 if(id==='gift'||id==='barter'){
  const tile=Number(b.tile);
  if(!Number.isInteger(tile)||!p.hand.includes(tile))throw Error('넘길 타일은 내 손에서 골라 주세요.');
  p.hand=p.hand.filter(t=>t!==tile);
  if(id==='barter'){
   const idx=api.rand(target.hand.length),other=target.hand.splice(idx,1)[0];
   p.hand.push(other);
   target.hand.push(tile);
  }else target.hand.push(tile);
  p.hand=R.sortTiles(p.hand,r.maxNum);target.hand=R.sortTiles(target.hand,r.maxNum);
  if(!p.hand.length)winner=p.seat;
 }else if(id==='mortal'){
  const num=Number(b.number);
  if(!Number.isInteger(num)||num<1||num>r.maxNum)throw Error('현재 사용되는 숫자를 선택해 주세요.');
  for(const q of r.players)q.hand=q.hand.filter(t=>R.tile(t).n!==num);
  // Tie-break for simultaneous empty hands is an explicit online rule:
  // current card user first, then clockwise.
  winner=p.hand.length?null:p.seat;
  if(winner===null){
   for(let x=1;x<r.size;x++){const q=r.players[(p.seat+x)%r.size];if(!q.hand.length){winner=q.seat;break;}}
  }
 }else if(id==='skip'){
  if(r.skipSeat!==null&&r.skipSeat!==undefined)throw Error('이미 다음 차례 강제 패스가 예약되어 있어요.');
  r.skipSeat=target.seat;
 }else if(id==='double'){
  const ids=Array.isArray(b.ids)?b.ids:[],extra=Array.isArray(b.extraIds)?b.extraIds:[];
  if(!ids.length||ids.length!==extra.length||new Set([...ids,...extra]).size!==ids.length+extra.length)
   throw Error('같은 장수의 서로 다른 두 족보를 선택해 주세요.');
  if(![1,2,3,5].includes(ids.length))throw Error('각 족보는 1·2·3·5장이어야 해요.');
  if(![...ids,...extra].every(Number.isInteger)||![...ids,...extra].every(t=>p.hand.includes(t)))
   throw Error('내 타일만 두 족보에 한 번씩 넣어 주세요.');
  const one=R.evaluate(ids,r.maxNum),two=R.evaluate(extra,r.maxNum);
  if(!one||!two)throw Error('두 족보 모두 유효해야 해요.');
  if(r.trick&&(one.size!==r.trick.ev.size||R.compare(one,r.trick.ev)<=0||
        two.size!==r.trick.ev.size||R.compare(two,r.trick.ev)<=0))
   throw Error('두 조합 모두 앞사람의 패를 이겨야 해요.');
  if(R.compare(two,one)<=0)throw Error('온라인 적용 규칙: 두 번째 족보는 첫 번째 족보보다 높아야 해요.');
  p.hand=p.hand.filter(t=>!ids.includes(t)&&!extra.includes(t));
  r.trick={by:p.seat,ids:R.sortTiles(extra,r.maxNum),ev:two};
  r.passes=0;r.leader=p.seat;r.turn=(p.seat+1)%r.size;
  api.emitFx(r,'play',p.seat,{ids:[...r.trick.ids],name:'더블샷'});
  if(!p.hand.length)winner=p.seat;
 }
 spend(r,p,id);
 if(id==='fair')r.fairGame=true;
 api.touch(r,p.name+'님이 특수카드 ['+cards[id].name+']를 사용했습니다.');
 if(id==='double'&&winner===null)api.scheduleBot(r);
 if(winner!==null)api.scoring(r,winner);
}
function eligibleSettlement(r,p,id){
 if(!available(r,p,id)||r.stage!=='settlement'||p.settled)return false;
 const sizes=r.players.map(q=>q.hand.length),my=p.hand.length;
 if(id==='winner'||id==='underdog')return p.seat===r.winner;
 if(id==='silver')return my===Math.max(...sizes)&&my>0;
 return false;
}
function useSettlement(r,p,id){
 if(!eligibleSettlement(r,p,id))throw Error('현재 정산에서 사용할 수 없는 카드예요.');
 spend(r,p,id);p.settled=true;p.lastSettlementCard=id;
 r.settleCards.push({seat:p.seat,id});
}
function settlementScores(r){
 const effective=r.players.map(p=>p.hand.length*(2**p.hand.filter(t=>R.tile(t).n===2).length));
 const underdog=r.settleCards.find(x=>x.id==='underdog');
 if(underdog){
  const rank=effective.map((n,i)=>({n,i})).filter(x=>x.i!==r.winner).sort((a,b)=>a.n-b.n);
  if(rank.length>1){const low=rank[0].n,high=rank[rank.length-1].n;
   for(const a of rank)if(a.n===low)effective[a.i]=high;else if(a.n===high)effective[a.i]=low;}
 }
 const winnerAll=r.settleCards.some(c=>c.id==='winner');
 const silver=new Set(r.settleCards.filter(c=>c.id==='silver').map(c=>c.seat));
 const delta=Array(r.size).fill(0);
 for(let payer=0;payer<r.size;payer++)for(let receiver=0;receiver<r.size;receiver++){
  if(payer===receiver||effective[payer]<=effective[receiver])continue;
  let amount=effective[payer]-effective[receiver];
  if(silver.has(payer))amount=Math.min(1,amount); // 1-point online settlement of one chip
  const actualReceiver=winnerAll?r.winner:receiver;
  if(actualReceiver===payer)continue;
  delta[payer]-=amount;delta[actualReceiver]+=amount;
 }
 return {effective,delta};
}
function publicCards(r,p){return (p.special||[]).map(id=>({...cards[id]}));}
module.exports={cards,deck,deal,available,spend,jokerTile,handEvalWithJoker,useTurn,
 eligibleSettlement,useSettlement,settlementScores,publicCards};
