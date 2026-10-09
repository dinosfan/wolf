'use strict';
const G=require('./game');
const COLORS=G.C;
const TOKEN_COLORS=G.COLORS;

function marketOptions(s,idx,includeReserved=true){
 const p=s.players[idx],out=[];
 for(const level of [1,2,3])for(let index=0;index<s.market[level].length;index++){
  const id=s.market[level][index];if(id)out.push({id,target:{zone:'market',level,index},cd:G.CARD[id]});
 }
 if(includeReserved)for(let index=0;index<p.reserved.length;index++){
  const id=p.reserved[index];if(id)out.push({id,target:{zone:'reserved',index},cd:G.CARD[id]});
 }
 return out;
}
function copyColor(p){const b=G.bonuses(p),points=G.colorPoints(p);
 return COLORS.slice().sort((a,b2)=>(b[b2]+points[b2]*0.2)-(b[a]+points[a]*0.2)).find(x=>b[x]>0)||null;
}
function targetValue(p,o){
 const cd=o.cd,req=G.due(p,cd);
 const lacking=Object.entries(req).reduce((v,[c,n])=>v+Math.max(0,n-(p.tokens[c]||0)),0);
 const distance=Math.max(0,lacking-(p.tokens.y||0));
 const b=G.bonuses(p);
 if(cd.b.x&&!COLORS.some(c=>b[c]>0))return -999;
 const bonus=Object.entries(cd.b).reduce((sum,[c,n])=>sum+n*(c==='x'?3.0:2.6)*(b[c]?0.85:1),0);
 const extra=cd.a.includes('again')?2.0:cd.a.includes('gem')?1.8:cd.a.includes('priv')?1.2:cd.a.includes('steal')?1.5:0;
 const rank=cd.p*1.8+cd.n*1.9+bonus+extra+(cd.l===1?1.0:0);
 return rank-distance*2.9-Object.values(req).reduce((a,x)=>a+x,0)*0.24;
}
function allTakeLines(board){
 const lines=[],seen=new Set();
 for(let row=0;row<5;row++)for(let col=0;col<5;col++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
  for(let n=1;n<=3;n++){
   const ids=[];
   for(let j=0;j<n;j++){
    const r=row+j*dr,c=col+j*dc;
    if(r<0||r>=5||c<0||c>=5)break;
    const ix=r*5+c;
    if(!board[ix]||board[ix]==='y')break;
    ids.push(ix);
   }
   if(ids.length!==n)continue;
   const key=ids.slice().sort((a,b)=>a-b).join(',');
   if(!seen.has(key)){seen.add(key);lines.push(ids)}
  }
 }
 return lines;
}
function preferredTarget(s,idx){
 const p=s.players[idx];return marketOptions(s,idx).sort((a,b)=>targetValue(p,b)-targetValue(p,a))[0]||null;
}
function urgency(p,c,s){
 const options=marketOptions(s,s.turn),ranked=options.filter(o=>o.cd.b.x?copyColor(p):true).sort((a,b)=>targetValue(p,b)-targetValue(p,a)).slice(0,4);
 const need=ranked.reduce((mx,o)=>Math.max(mx,Math.max(0,(G.due(p,o.cd)[c]||0)-(p.tokens[c]||0))),0);
 return need?Math.min(2.7,need*.85):0;
}
function takeChoice(s,idx){
 const p=s.players[idx],all=allTakeLines(s.board);
 if(!all.length)return null;
 const keep=Math.max(0,10-G.total(p));
 let best=null,bestScore=-Infinity;
 for(const indices of all){
  const cs=indices.map(i=>s.board[i]);
  const duplicate=cs.length===3&&cs.every(c=>c===cs[0]);
  const pearls=cs.filter(c=>c==='p').length;
  const counts={};for(const c of cs)counts[c]=(counts[c]||0)+1;
  let score=indices.length*5.9;
  for(const [c,n] of Object.entries(counts)){
   score+=n*urgency(p,c,s);
   if(c==='p')score+=n*(p.tokens.p<2?1.2:0.2);
   if(c==='w'||c==='g'||c==='b'||c==='r'||c==='k')score-=Math.max(0,p.tokens[c]+n-4)*1.4;
  }
  if(duplicate)score-=3.4;
  if(pearls>=2)score-=1.7;
  if(indices.length>keep)score-=(indices.length-keep)*6.3;
  if(score>bestScore){bestScore=score;best=indices}
 }
 return best;
}
function chooseAction(s,idx){
 const p=s.players[idx],opp=s.players[1-idx];
 if(!s.started||s.turn!==idx||s.winner!==null)return null;
 if(s.phase==='gem'){
  const ix=s.board.findIndex(c=>c===s.lastPurchased?.color);
  return ix>=0?{type:'gem',index:ix}:null;
 }
 if(s.phase==='steal'){
  const candidates=TOKEN_COLORS.filter(c=>c!=='y'&&opp.tokens[c]);
  candidates.sort((a,b)=>(b==='p'?1.8:0)+(urgency(p,b,s))-(a==='p'?1.8:0)-urgency(p,a,s));
  return candidates.length?{type:'steal',color:candidates[0]}:null;
 }
 if(s.phase==='royal'){
  const choice=[2,4,3,1].find(id=>s.royals.includes(id));
  return choice?{type:'royal',id:choice}:null;
 }
 if(s.phase==='discard'){
  const available=TOKEN_COLORS.filter(c=>p.tokens[c]>0);
  available.sort((a,b)=>{
   const va=(a==='y'?11:a==='p'?8:urgency(p,a,s)+2)-p.tokens[a]*0.45;
   const vb=(b==='y'?11:b==='p'?8:urgency(p,b,s)+2)-p.tokens[b]*0.45;
   return va-vb;
  });
  return available.length?{type:'discard',color:available[0]}:null;
 }
 if(s.phase!=='main')return null;
 const all=marketOptions(s,idx);
 const affordable=all.filter(o=>G.canBuy(p,o.cd));
 if(affordable.length){
  affordable.sort((a,b)=>targetValue(p,b)-targetValue(p,a));
  const chosen=affordable[0];
  return {type:'buy',target:chosen.target,payment:G.defaultPayment(p,chosen.cd),color:chosen.cd.b.x?copyColor(p):null};
 }
 // Use a privilege when taking one gem makes a visible card immediately buyable.
 if(!s.refilled&&p.priv>0){
  const valuable=all.slice().sort((a,b)=>targetValue(p,b)-targetValue(p,a)).slice(0,5);
  for(const o of valuable){
   for(const c of [...COLORS,'p']){
    const at=s.board.findIndex(x=>x===c);
    if(at<0||!(G.due(p,o.cd)[c]>(p.tokens[c]||0)))continue;
    const pseudo=G.newPlayer('test','');pseudo.tokens={...p.tokens,[c]:p.tokens[c]+1};pseudo.owned=p.owned;
    if(G.canBuy(pseudo,o.cd))return {type:'priv',index:at};
   }
  }
 }
 const gold=s.board.findIndex(c=>c==='y');
 if(gold>=0&&p.reserved.length<2&&G.total(p)>=3){
  const reservable=marketOptions(s,idx,false).filter(o=>!o.cd.b.x||copyColor(p))
   .sort((a,b)=>targetValue(p,b)-targetValue(p,a));
  const target=reservable[0];
  if(target&&targetValue(p,target)>-8&&(p.reserved.length===0||target.cd.p>=2)){
   return {type:'reserve',gold,target:target.target};
  }
 }
 const line=takeChoice(s,idx);
 if(line){
  if(!s.refilled&&s.bag.length>=5&&s.board.filter(x=>x!==null&&x!=='y').length<=4&&s.board.includes(null))return {type:'refill'};
  return {type:'take',indices:line};
 }
 if(!s.refilled&&s.bag.length&&s.board.includes(null))return {type:'refill'};
 if(gold>=0&&p.reserved.length<3){
  const fallback=marketOptions(s,idx,false).sort((a,b)=>targetValue(p,b)-targetValue(p,a))[0];
  if(fallback)return {type:'reserve',gold,target:fallback.target};
 }
 return null;
}
module.exports={chooseAction,marketOptions,allTakeLines,copyColor,targetValue};