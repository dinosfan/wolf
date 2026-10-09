'use strict';
const crypto = require('node:crypto');
const C = ['w','b','g','r','k'];
const COLORS = [...C,'p','y'];
const ROYALS=[{id:1,p:2,a:'steal'},{id:2,p:2,a:'again'},{id:3,p:2,a:'priv'},{id:4,p:3,a:''}];
// Jewel costs, bonuses, points, crowns, powers: faithfully transcribed from the
// 67-card data for the original (not expansion) game. x = grey/multicolor.
// Raw entries are tier|base color|cost|bonus|points|crowns|powers.
const RAW=`
1|w|b1g1r1k1|w1|0|0|
1|w|b3|w1|0|1|
1|w|b2g2p1|w1|0|0|again
1|w|r2k2|w1|0|0|gem
1|w|g2r3|w1|1|0|
1|b|w1g1r1k1|b1|0|0|
1|b|g3|b1|0|1|
1|b|g2r2p1|b1|0|0|again
1|b|w2k2|b1|0|0|gem
1|b|r2k3|b1|1|0|
1|g|w1b1r1k1|g1|0|0|
1|g|r3|g1|0|1|
1|g|r2k2p1|g1|0|0|again
1|g|w2b2|g1|0|0|gem
1|g|w3k2|g1|1|0|
1|k|w1b1g1r1|k1|0|0|
1|k|w3|k1|0|1|
1|k|w2b2p1|k1|0|0|again
1|k|g2r2|k1|0|0|gem
1|k|b2g3|k1|1|0|
1|r|w1b1g1k1|r1|0|0|
1|r|k3|r1|0|1|
1|r|w2k2p1|r1|0|0|again
1|r|b2g2|r1|0|0|gem
1|r|w2b3|r1|1|0|
1|x|k4p1|x1|1|0|copy
1|x|w4p1|x1|0|1|copy
1|x|r4p1||3|0|
1|x|b2r2k1p1|x1|1|0|copy
1|x|w2g2k1p1|x1|1|0|copy
2|w|g2r2k2p1|w1|2|1|
2|w|b4r3|w1|1|0|steal
2|w|w4k2p1|w1|2|0|priv
2|w|b5g2|w2|1|0|
2|b|w2r2k2p1|b1|2|1|
2|b|g4k3|b1|1|0|steal
2|b|w2b4p1|b1|2|0|priv
2|b|g5r2|b2|1|0|
2|g|w2b2k2p1|g1|2|1|
2|g|w3r4|g1|1|0|steal
2|g|b2g4p1|g1|2|0|priv
2|g|r5k2|g2|1|0|
2|k|b2g2r2p1|k1|2|1|
2|k|w4g3|k1|1|0|steal
2|k|r2k4p1|k1|2|0|priv
2|k|w5b2|k2|1|0|
2|r|w2b2g2p1|r1|2|1|
2|r|b3k4|r1|1|0|steal
2|r|g2r4p1|r1|2|0|priv
2|r|w2k5|r2|1|0|
2|x|g6p1|x1|2|0|copy
2|x|g6p1|x1|0|2|copy
2|x|b6p1|x1|0|2|copy
2|x|b6p1||5|0|
3|w|b3r5k3p1|w1|3|2|
3|w|w6b2k2|w1|4|0|
3|b|w3g3k5p1|b1|3|2|
3|b|w2b6g2|b1|4|0|
3|g|w5b3r3p1|g1|3|2|
3|g|b2g6r2|g1|4|0|
3|k|w3g5r3p1|k1|3|2|
3|k|w2r2k6|k1|4|0|
3|r|b5g3k3p1|r1|3|2|
3|r|g2r6k2|r1|4|0|
3|x|r8|x1|3|0|copy,again
3|x|k8|x1|0|3|copy
3|x|w8||6|0|
`;
const bagMap=s=>Object.fromEntries([...s.matchAll(/([wbg rkpxy])(\d+)/g)].map(m=>[m[1],Number(m[2])]));
const cards=[]; const levels={1:[],2:[],3:[]};
RAW.trim().split('\n').forEach((line)=>{let [l,c,k,b,p,n,a]=line.trim().split('|');let card={id:`${l}-${levels[l].length+1}`,l:+l,c,k:bagMap(k),b:bagMap(b),p:+p,n:+n,a:a?a.split(','):[]};cards.push(card);levels[l].push(card.id)});
const CARD=Object.fromEntries(cards.map(c=>[c.id,c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const shuffled=arr=>{arr=[...arr];for(let i=arr.length-1;i>0;i--){const j=crypto.randomInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
function spiral(){const out=[],seen=new Set();let r=2,c=2,step=1;const add=()=>{if(r>=0&&r<5&&c>=0&&c<5&&!seen.has(r*5+c)){let ix=r*5+c;out.push(ix);seen.add(ix)}};add();while(out.length<25){for(let i=0;i<step;i++){c++;add()}for(let i=0;i<step;i++){r++;add()}step++;for(let i=0;i<step;i++){c--;add()}for(let i=0;i<step;i++){r--;add()}step++}return out}
const SPIRAL=spiral();
const emptyTokens=()=>Object.fromEntries(COLORS.map(c=>[c,0]));
function newPlayer(name,token){return {name,token,tokens:emptyTokens(),priv:0,owned:[],reserved:[],royals:[]}}
function newRoom(code,name,token){return {code,players:[newPlayer(name,token)],started:false,board:[],bag:[],decks:{1:[],2:[],3:[]},market:{1:[],2:[],3:[]},royals:[],turn:0,first:0,phase:'main',queue:[],extra:false,refilled:false,logs:[],winner:null,updated:Date.now(),version:0}}
function addLog(s,msg){s.logs.unshift(msg);s.logs=s.logs.slice(0,22)}
function startGame(s){if(s.started||s.players.length!==2)throw Error('두 명이 모여야 게임을 시작할 수 있어요.');
 s.started=true;s.bag=[];s.board=shuffled([...C.flatMap(v=>Array(4).fill(v)),'p','p','y','y','y']);
 for(const l of [1,2,3]){s.decks[l]=shuffled(levels[l]);s.market[l]=Array.from({length:({1:5,2:4,3:3})[l]},()=>s.decks[l].pop())}
 s.royals=[1,2,3,4];s.first=crypto.randomInt(2);s.turn=s.first;s.players[1-s.first].priv=1;s.phase='main';s.queue=[];s.extra=false;s.refilled=false;
 addLog(s,`${s.players[s.turn].name}님 선공! 상대는 특권 1개를 획득했어요.`)}
const total=p=>COLORS.reduce((n,c)=>n+p.tokens[c],0);
const points=p=>p.owned.reduce((s,x)=>s+CARD[x.id].p,0)+p.royals.reduce((s,id)=>s+ROYALS[id-1].p,0);
const crowns=p=>p.owned.reduce((s,x)=>s+CARD[x.id].n,0);
function bonuses(p){let b=emptyTokens();p.owned.forEach(x=>{const cd=CARD[x.id];Object.entries(cd.b).forEach(([c,n])=>{if(c==='x')c=x.color;if(c&&b[c]!==undefined)b[c]+=n})});return b}
function colorPoints(p){let b=Object.fromEntries(C.map(c=>[c,0]));p.owned.forEach(x=>{const cd=CARD[x.id];const color=cd.b.x?x.color:(Object.keys(cd.b)[0]||null);if(color&&b[color]!==undefined)b[color]+=cd.p});return b}
function due(p,cd){const bs=bonuses(p);const out={};for(const [c,n] of Object.entries(cd.k)){out[c]=Math.max(0,n-(c==='p'?0:bs[c]))}return out}
function defaultPayment(p,cd){const req=due(p,cd),pay={};let gold=0;for(const [c,n] of Object.entries(req)){pay[c]=Math.min(n,p.tokens[c]);gold+=n-pay[c]}pay.y=gold;return pay}
function canBuy(p,cd){if(!cd)return false;if(cd.b.x&&!C.some(c=>bonuses(p)[c]))return false;return defaultPayment(p,cd).y<=p.tokens.y}
function replenish(s){if(!s.bag.length)throw Error('주머니에 토큰이 없어요.');if(!s.board.includes(null))throw Error('빈 칸이 없어요.');let bag=shuffled(s.bag);for(const i of SPIRAL){if(s.board[i]===null&&bag.length)s.board[i]=bag.pop()}s.bag=bag}
function gainPrivilege(s,idx){const p=s.players[idx],opp=s.players[1-idx];const pool=3-s.players[0].priv-s.players[1].priv;if(p.priv===3)return;if(pool>0)p.priv++;else if(opp.priv){opp.priv--;p.priv++}}
function lineLegal(indices,board){if(!Array.isArray(indices)||indices.length<1||indices.length>3||new Set(indices).size!==indices.length)return false;if(indices.some(i=>!Number.isInteger(i)||i<0||i>=25||!board[i]||board[i]==='y'))return false;if(indices.length===1)return true;const pos=indices.map(i=>[Math.floor(i/5),i%5]);for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){for(const [r,c] of pos){let matching=true;for(let n=0;n<indices.length;n++){if(!indices.includes((r+dr*n)*5+(c+dc*n))||(r+dr*n)<0||(r+dr*n)>4||(c+dc*n)<0||(c+dc*n)>4){matching=false;break}}if(matching)return true}}return false}
function phaseAdd(s,task){s.queue.push(task)}
function popNext(s){while(s.queue.length){const task=s.queue.shift();if(task==='again'){s.extra=true;continue}if(task==='priv'){gainPrivilege(s,s.turn);continue}if(task==='steal'){if(COLORS.slice(0,6).some(c=>s.players[1-s.turn].tokens[c])){s.phase='steal';return}continue}if(task==='gem'){let card=s.lastPurchased;if(card&&s.board.includes(card.color)){s.phase='gem';return}continue}if(task==='royal'){if(s.royals.length){s.phase='royal';return}continue}}if(total(s.players[s.turn])>10){s.phase='discard';return}finish(s)}
function finish(s){const p=s.players[s.turn],cp=colorPoints(p);if(points(p)>=20||crowns(p)>=10||Object.values(cp).some(x=>x>=10)){s.winner=s.turn;s.phase='over';addLog(s,`🏆 ${p.name}님 승리! ${points(p)}점 · 왕관 ${crowns(p)}개`);return}
 if(!s.extra)s.turn=1-s.turn;s.extra=false;s.refilled=false;s.phase='main';s.lastPurchased=null;addLog(s,`${s.players[s.turn].name}님의 차례`)}
function pickCard(s,target){if(!target||!['market','reserved','deck'].includes(target.zone))throw Error('카드를 선택해 주세요.');if(target.zone==='reserved'){const i=target.index;const p=s.players[s.turn];if(!Number.isInteger(i)||i<0||i>=p.reserved.length)throw Error('예약 카드가 없어요.');return p.reserved[i]}
 const l=target.level,ix=target.index;if(![1,2,3].includes(l))throw Error('카드 단계를 확인해 주세요.');if(target.zone==='deck')return s.decks[l].length?s.decks[l][s.decks[l].length-1]:null;
 if(!Number.isInteger(ix)||ix<0||ix>=s.market[l].length)return null;return s.market[l][ix]}
function removeCard(s,target){const l=target.level;if(target.zone==='reserved')return s.players[s.turn].reserved.splice(target.index,1)[0];if(target.zone==='deck')return s.decks[l].pop();const id=s.market[l][target.index];s.market[l][target.index]=s.decks[l].length?s.decks[l].pop():null;return id}
function action(s,who,data){if(!s.started)throw Error('아직 게임 시작 전이에요.');if(s.winner!==null)throw Error('게임이 종료됐어요.');if(s.turn!==who)throw Error('상대방 차례입니다.');if(!data||typeof data.type!=='string')throw Error('동작을 선택해 주세요.');const type=data.type,p=s.players[who];
 if(s.phase==='main'){
  if(type==='priv') {if(s.refilled||p.priv<1)throw Error('지금 특권을 사용할 수 없어요.');let i=data.index;if(!Number.isInteger(i)||i<0||i>=25||!s.board[i]||s.board[i]==='y')throw Error('금은 특권으로 가져올 수 없어요.');p.priv--;p.tokens[s.board[i]]++;s.board[i]=null;addLog(s,`${p.name}님 특권 사용`);return}
  if(type==='refill'){if(s.refilled)throw Error('이 턴에는 이미 보드를 보충했어요.');replenish(s);s.refilled=true;gainPrivilege(s,1-who);addLog(s,`${p.name}님 보드를 보충했어요. 상대 특권 +1`);return}
  if(type==='take'){if(!lineLegal(data.indices,s.board))throw Error('연속된 가로·세로·대각선 토큰 1~3개만 가져올 수 있어요.');const ts=data.indices.map(i=>s.board[i]);for(const i of data.indices){p.tokens[s.board[i]]++;s.board[i]=null}if((ts.length===3&&ts.every(t=>t===ts[0]))||ts.filter(t=>t==='p').length>=2){gainPrivilege(s,1-who);addLog(s,`같은 보석 3개 / 진주 2개로 상대에게 특권 지급`)}addLog(s,`${p.name}님 토큰 ${ts.length}개 수집`);popNext(s);return}
  if(type==='reserve'){if(p.reserved.length>=3)throw Error('예약은 최대 3장이에요.');if(!Number.isInteger(data.gold)||s.board[data.gold]!=='y')throw Error('황금 토큰을 먼저 선택해 주세요.');let target=data.target;if(!target||target.zone==='reserved')throw Error('공개 카드나 덱을 선택하세요.');let id=pickCard(s,target);if(!id)throw Error('선택한 카드가 없어요.');s.board[data.gold]=null;p.tokens.y++;p.reserved.push(removeCard(s,target));addLog(s,`${p.name}님 카드 1장 비공개 예약`);popNext(s);return}
  if(type==='buy') {let target=data.target;if(target?.zone==='deck')throw Error('덱의 카드는 먼저 예약해야 구매할 수 있어요.');const id=pickCard(s,target);if(!id)throw Error('카드를 선택해 주세요.');const cd=CARD[id];if(!canBuy(p,cd))throw Error('보석이 부족하거나 복사 능력에 필요한 기존 카드가 없어요.');let chooseColor=null;if(cd.b.x){if(!C.includes(data.color)||bonuses(p)[data.color]<1)throw Error('복사할 보너스 색상을 선택해 주세요.');chooseColor=data.color}
   const req=due(p,cd),payment=data.payment;if(!payment||typeof payment!=='object')throw Error('지불할 토큰 구성을 선택해 주세요.');if(Object.keys(payment).some(c=>!Object.hasOwn(req,c)&&c!=='y'&&(payment[c]||0)!==0))throw Error('필요하지 않은 종류의 토큰은 낼 수 없어요.');let goldNeeds=0;for(const [c,n] of Object.entries(req)){const q=payment[c]||0;if(!Number.isInteger(q)||q<0||q>Math.min(n,p.tokens[c]))throw Error('지불 토큰 수량이 잘못됐어요.');goldNeeds+=n-q}
   if(payment.y!==goldNeeds||goldNeeds>p.tokens.y)throw Error('금 토큰을 포함한 결제 수량을 확인해 주세요.');for(const c of COLORS){const amount=payment[c]||0;if(amount){p.tokens[c]-=amount;for(let i=0;i<amount;i++)s.bag.push(c)}}
   const old=crowns(p);removeCard(s,target);p.owned.push({id,color:chooseColor});s.lastPurchased={color:cd.c};addLog(s,`${p.name}님 ${id} 카드 구매 (+${cd.p}점 / 왕관 ${cd.n})`);
   for(const effect of cd.a){if(effect==='copy')continue;phaseAdd(s,effect)}
   const newC=crowns(p);for(const milestone of [3,6])if(old<milestone&&newC>=milestone)phaseAdd(s,'royal');popNext(s);return}
  throw Error('토큰 획득, 예약 또는 구매를 선택해 주세요.')
 }
 if(s.phase==='gem'){if(type!=='gem'||!Number.isInteger(data.index)||s.board[data.index]!==s.lastPurchased?.color)throw Error('구매한 카드 색상과 같은 토큰을 선택해 주세요.');p.tokens[s.board[data.index]]++;s.board[data.index]=null;s.phase='main';addLog(s,`${p.name}님 카드 효과로 토큰 획득`);popNext(s);return}
 if(s.phase==='steal'){if(type!=='steal'||!COLORS.slice(0,6).includes(data.color)||s.players[1-who].tokens[data.color]<1)throw Error('상대의 금 이외 보석 또는 진주를 골라 주세요.');s.players[1-who].tokens[data.color]--;p.tokens[data.color]++;s.phase='main';addLog(s,`${p.name}님 상대 토큰 1개 획득`);popNext(s);return}
 if(s.phase==='royal'){if(type!=='royal'||!s.royals.includes(data.id))throw Error('남은 왕실 카드에서 선택해 주세요.');const chosen=ROYALS[data.id-1];s.royals=s.royals.filter(x=>x!==data.id);p.royals.push(data.id);s.phase='main';addLog(s,`${p.name}님 왕실 카드 획득 (+${chosen.p}점)`);if(chosen.a)s.queue.unshift(chosen.a);popNext(s);return}
 if(s.phase==='discard'){if(type!=='discard'||!COLORS.includes(data.color)||p.tokens[data.color]<1)throw Error('버릴 토큰을 골라 주세요.');p.tokens[data.color]--;s.bag.push(data.color);if(total(p)<=10){s.phase='main';popNext(s)}return}
 throw Error('지금은 해당 행동을 할 수 없어요.');}
function visible(s,seat){const me=s.players[seat];const players=s.players.map((p,i)=>({name:p.name,tokens:p.tokens,priv:p.priv,owned:p.owned,royals:p.royals,reserved:i===seat?p.reserved:p.reserved.map(()=>null),score:points(p),crowns:crowns(p),bonus:bonuses(p),colorPoints:colorPoints(p),connected:!!p.connected,isBot:!!p.isBot}));
 return {code:s.code,seat,players,started:s.started,turn:s.turn,phase:s.phase,board:s.board,bagCount:s.bag.length,effectColor:s.phase==='gem'?s.lastPurchased?.color:null,deckCounts:Object.fromEntries([1,2,3].map(l=>[l,s.decks[l].length])),market:s.market,royals:s.royals,winner:s.winner,refilled:s.refilled,extra:s.extra,logs:s.logs,version:s.version,cardData:CARD,royalData:ROYALS}}
module.exports={CARD,COLORS,C,ROYALS,SPIRAL,newRoom,newPlayer,startGame,action,visible,canBuy,due,defaultPayment,points,crowns,bonuses,colorPoints,lineLegal,shuffled,total,emptyTokens};