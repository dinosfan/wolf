'use strict';
const SUITS = ['구름','별','달','해'];
const SYMBOLS = ['☁','★','☾','☀'];
const HANDS = ['싱글','페어','트리플',null,'스트레이트','플러시','풀하우스','포카드','스트레이트 플러시'];
function tile(id){
 if(!Number.isInteger(id)||id<0||id>=60) throw Error('잘못된 타일입니다.');
 return {id,n:Math.floor(id/4)+1,s:id%4};
}
function rank(n,maxNum=13){return n===2?maxNum-1:n===1?maxNum-2:n-3;}
function sortTiles(ids,maxNum=13){return [...ids].sort((a,b)=>{let x=tile(a),y=tile(b);return rank(x.n,maxNum)-rank(y.n,maxNum)||x.s-y.s;});}
function straightScore(cards,maxNum=13){
 if(cards.length!==5)return null;
 const nums=cards.map(t=>t.n),set=new Set(nums);
 if(set.size!==5||nums.some(n=>n>maxNum||n<1))return null;
 const contains=seq=>seq.every(n=>set.has(n));
 let score=-1,high=0;
 for(let start=3;start<=maxNum-4;start++){
  if(contains([start,start+1,start+2,start+3,start+4])){score=start-3;high=start+4;}
 }
 if(contains([maxNum-3,maxNum-2,maxNum-1,maxNum,1])){score=maxNum-6;high=1;}
 if(contains([2,3,4,5,6])){score=maxNum-5;high=2;}
 if(contains([1,2,3,4,5])){score=maxNum-4;high=2;}
 if(score<0)return null;
 return [score,cards.find(t=>t.n===high).s];
}
function evaluate(ids,maxNum=13){
 if(!Array.isArray(ids)||![1,2,3,5].includes(ids.length)||new Set(ids).size!==ids.length)return null;
 let a;try{a=ids.map(tile);if(a.some(t=>t.n>maxNum))return null}catch{return null}
 const counts=new Map();
 for(const t of a)counts.set(t.n,(counts.get(t.n)||0)+1);
 const sorted=[...a].sort((x,y)=>rank(y.n,maxNum)-rank(x.n,maxNum));
 const repeated=count=>[...counts].find(([,n])=>n===count)?.[0];
 if(a.length===1)return {name:'싱글',size:1,strength:[rank(a[0].n,maxNum),a[0].s],level:0};
 if(a.length===2)return counts.size===1?{name:'페어',size:2,strength:[rank(a[0].n,maxNum),Math.max(...a.map(t=>t.s))],level:0}:null;
 if(a.length===3)return counts.size===1?{name:'트리플',size:3,strength:[rank(a[0].n,maxNum)],level:0}:null;
 const flush=a.every(t=>t.s===a[0].s),straight=straightScore(a,maxNum);
 if(straight&&flush)return {name:'스트레이트 플러시',size:5,level:4,strength:[...straight]};
 if(repeated(4)!==undefined)return {name:'포카드',size:5,level:3,strength:[rank(repeated(4),maxNum)]};
 if(counts.size===2&&repeated(3)!==undefined&&repeated(2)!==undefined)return {name:'풀하우스',size:5,level:2,strength:[rank(repeated(3),maxNum)]};
 if(flush)return {name:'플러시',size:5,level:1,strength:[...sorted.map(t=>rank(t.n,maxNum)),a[0].s]};
 if(straight)return {name:'스트레이트',size:5,level:0,strength:straight};
 return null;
}
function compare(a,b){
 if(!a||!b||a.size!==b.size)return null;
 if(a.level!==b.level)return Math.sign(a.level-b.level);
 for(let i=0;i<Math.max(a.strength.length,b.strength.length);i++){
  const v=(a.strength[i]||0)-(b.strength[i]||0);
  if(v!==0)return Math.sign(v);
 }
 return 0;
}
function calculateScores(hands){
 const effective=hands.map(h=>h.length * (2 ** h.map(tile).filter(t=>t.n===2).length));
 const delta=effective.map((v,i)=>effective.reduce((sum,w,j)=>sum+(i===j?0:w-v),0));
 return {effective,delta};
}
module.exports={SUITS,SYMBOLS,HANDS,tile,rank,sortTiles,straightScore,evaluate,compare,calculateScores};
