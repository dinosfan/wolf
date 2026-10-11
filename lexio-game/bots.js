'use strict';
const R=require('./rules');
function allLegal(hand,maxNum,target){
 const out=[];
 const lengths=target?[target.size]:[1,2,3,5];
 for(const n of lengths){
  if(n>hand.length)continue;
  const comb=[];
  function pick(start){
   if(comb.length===n){
    const ids=[...comb],ev=R.evaluate(ids,maxNum);
    if(ev&&(!target||R.compare(ev,target)>0))out.push({ids,ev});
    return;
   }
   for(let i=start;i<=hand.length-(n-comb.length);i++){
    comb.push(hand[i]);pick(i+1);comb.pop();
   }
  }
  pick(0);
 }
 return out;
}
function strengthScore(ev){
 let score=ev.level*100000;
 for(let i=0;i<ev.strength.length;i++)score+=ev.strength[i]*Math.pow(15,Math.max(0,ev.strength.length-i-1));
 return score;
}
function botMove(hand,maxNum,target,remainingOpponents=[]){
 const all=allLegal(hand,maxNum,target);
 if(!all.length)return {type:'pass'};
 // On the lead, shed larger valid sets whenever possible. Preserve a bit of strength.
 if(!target){
  const priority={5:0,3:1,2:2,1:3};
  all.sort((a,b)=>priority[a.ev.size]-priority[b.ev.size]||a.ev.level-b.ev.level||strengthScore(a.ev)-strengthScore(b.ev));
  return {type:'play',ids:all[0].ids};
 }
 all.sort((a,b)=>strengthScore(a.ev)-strengthScore(b.ev));
 const candidate=all[0];
 // A high two should be conserved unless a rival is close to going out.
 const emergency=remainingOpponents.some(n=>n<=2);
 if(!emergency&&target.size===1&&candidate.ids.length===1){
  const t=R.tile(candidate.ids[0]);
  if(t.n===2&&hand.length>4&&remainingOpponents.every(n=>n>=5))return {type:'pass'};
 }
 return {type:'play',ids:candidate.ids};
}
module.exports={allLegal,botMove};
