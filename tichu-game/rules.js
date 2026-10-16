'use strict';
const RANKS=['','1','2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS=['★','⚔','♣','◆'];
const DECK=[...Array.from({length:4},(_,s)=>Array.from({length:13},(_,i)=>({id:s+'-'+(i+2),rank:i+2,suit:s}))).flat(),
 {id:'MJ',rank:1,suit:-1},{id:'PH',rank:0,suit:-1},{id:'DG',rank:15,suit:-1},{id:'DO',rank:0,suit:-1}];
const BY_ID=Object.fromEntries(DECK.map(x=>[x.id,x]));
const team=seat=>seat%2;
const card=id=>BY_ID[id];
const scoreCard=id=>{const c=card(id);if(!c)return 0;return id==='DG'?25:id==='PH'?-25:c.rank===5?5:c.rank===10||c.rank===13?10:0};
const label=id=>id==='MJ'?'🀄':id==='PH'?'🔥':id==='DG'?'🐉':id==='DO'?'🐕':(RANKS[card(id)?.rank]||'?')+(SUITS[card(id)?.suit]||'');
function analyzePlain(cards){
 const n=cards.length;const counts=new Map,sorted=cards.map(x=>x.rank).sort((a,b)=>a-b);
 for(const v of sorted)counts.set(v,(counts.get(v)||0)+1);
 const groups=[...counts.entries()].sort((a,b)=>a[0]-b[0]),countList=groups.map(x=>x[1]).sort((a,b)=>a-b);
 let out=[];
 const push=(type,power,bomb=0)=>out.push({type,len:n,power,bomb});
 if(n===1)push('single',sorted[0]);
 if(n===2&&countList.join()==='2')push('pair',sorted[0]);
 if(n===3&&countList.join()==='3')push('triple',sorted[0]);
 if(n===5&&countList.join()==='2,3')push('full',groups.find(x=>x[1]===3)[0]);
 if(n>=4&&n%2===0&&groups.length===n/2&&groups.every(x=>x[1]===2)&&groups.at(-1)[0]-groups[0][0]===groups.length-1)push('steps',groups.at(-1)[0]);
 const straight=n>=5&&groups.length===n&&sorted.at(-1)-sorted[0]===n-1;
 const flush=straight&&cards.every(x=>x.suit>=0&&x.suit===cards[0].suit);
 if(straight&&!flush)push('straight',sorted.at(-1));
 if(n===4&&groups.length===1)push('fourBomb',sorted[0],1);
 if(flush)push('straightBomb',n*20+sorted.at(-1),2);
 return out;
}
function variants(ids,table=null){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!BY_ID[id]))return [];
 const special=ids.filter(x=>['MJ','PH','DG','DO'].includes(x));
 if(ids.length===1){
  const id=ids[0];
  if(id==='DO')return [{type:'dog',len:1,power:0,bomb:0}];
  if(id==='PH')return [{type:'single',len:1,power:table?.type==='single'&&table.power<15?table.power+.5:1.5,bomb:0,wild:1}];
  if(id==='DG')return [{type:'single',len:1,power:15,bomb:0}];
  return [{type:'single',len:1,power:BY_ID[id].rank,bomb:0}];
 }
 if(special.includes('DO')||special.includes('DG'))return [];
 const normal=ids.filter(x=>x!=='PH').map(x=>BY_ID[x]),hasMJ=special.includes('MJ');
 if(hasMJ&&ids.length<5)return [];
 let all=[];
 if(special.includes('PH')){
  for(let v=2;v<=14;v++){
   const fake={id:'PH',rank:v,suit:-1};
   let found=analyzePlain([...normal,fake]).filter(x=>!x.bomb);
   if(hasMJ)found=found.filter(x=>x.type==='straight');
   all.push(...found.map(x=>({...x,wild:v})));
  }
 }else{all=analyzePlain(normal);if(hasMJ)all=all.filter(x=>x.type==='straight')}
 const uniq=new Map;
 for(const v of all)uniq.set([v.type,v.len,v.power,v.bomb,v.wild||''].join(':'),v);
 return [...uniq.values()];
}
function beats(play,table){
 if(!play)return false;if(!table)return play.type!=='dog';
 if(play.type==='dog')return false;
 if(play.bomb&&(!table.bomb||play.bomb>table.bomb))return true;
 if(!!play.bomb!==!!table.bomb)return false;
 if(play.bomb&&table.bomb)return play.power>table.power;
 return play.type===table.type&&play.len===table.len&&play.power>table.power;
}
function validOptions(ids,table,lead){
 return variants(ids,table).filter(v=>v.type==='dog'?(lead&&!table):v.bomb?true:beats(v,table));
}
function combinations(hand,table,lead,wish){
 const arr=[],n=hand.length;
 for(let mask=1;mask<(1<<n);mask++){
  let ids=[];
  for(let i=0;i<n;i++)if(mask&(1<<i))ids.push(hand[i]);
  const choices=validOptions(ids,table,lead);
  for(const variant of choices)arr.push({cards:ids,variant,fulfills:!wish||ids.some(id=>BY_ID[id]?.rank===wish)});
 }
 return arr;
}
function comparePlay(a,b){return a.variant.bomb-b.variant.bomb||a.cards.length-b.cards.length||a.variant.power-b.variant.power}
module.exports={RANKS,SUITS,DECK,BY_ID,team,card,scoreCard,label,variants,beats,validOptions,combinations,comparePlay};
