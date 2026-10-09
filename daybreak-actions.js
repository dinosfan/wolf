'use strict';
const {DAYBREAK_ROLES,ARTIFACTS}=require('./public/daybreak-info');
module.exports=function createDaybreak(H){
 const {ROLE_INFO,cardFaceView,finalRoleView,isWerewolf,finishWithReveal,finishWithoutReveal,recordSwap}=H;
 const history=(r,event)=>(r.actionHistory ||= []).push(event);
 const shielded=(r,id)=>r.shields?.has(id);
 const legalPlayers=(r,p,role,wrapper)=>r.players.filter(x=>!shielded(r,x.id)&&(x.id!==p.id||(role==='witch')||(role==='curator'&&wrapper==='doppelganger'))).filter(x=>role!=='curator'||!r.artifacts.has(x.id)).filter(x=>role!=='alpha_wolf'||!H.werewolfActors(r).some(w=>w.id===x.id)).filter(x=>role!=='investigator'||!(p.nightState?.investigatorSeen||[]).includes(x.id));
 function prompt(r,p,role,wrapper){
  const list=legalPlayers(r,p,role,wrapper),info=DAYBREAK_ROLES[role];
  const phase=role==='witch'&&Number.isInteger(p.nightState?.witchIndex)?'exchange':role==='investigator'&&(p.nightState?.investigatorSeen?.length)?'second':'action';
  let instructions=info.desc,input='player';
  if(role==='apprentice_seer')input='center';
  if(role==='witch')input=phase==='exchange'?'player':'center';
  if(role==='village_idiot')input='direction';
  const blocked=(['robber','drunk','insomniac'].includes(role)&&shielded(r,p.id))||(input==='player'&&list.length===0)||(role==='alpha_wolf'&&!r.centerCards[3]);
  if(role==='witch'&&phase==='exchange')instructions='今確認した 가운데 카드와 교환할 플레이어를 선택하세요. 자신의 카드도 가능합니다.'.replace('今確認した','방금 확인한');
  return {others:list.map(x=>({id:x.id,name:x.name})),center:r.centerCards.map((_,i)=>i),instructions,phase,input,blocked,skipAllowed:role!=='alpha_wolf'&&!(role==='witch'&&phase==='exchange'),roleName:wrapper==='doppelganger'?`도플갱어 → ${info.name}`:info.name,actionRole:role,role:wrapper,emoji:wrapper==='doppelganger'?'🪞':info.emoji,copiedEmoji:wrapper==='doppelganger'?info.emoji:null};
 }
 function follow(r,p,role,wrapper){const data=H.genericActionPrompt(r,p,role,wrapper);return {...data,stage:wrapper==='doppelganger'?'followup':'action'};}
 function perform(r,p,role,payload,cb,wrapper){
  const view=prompt(r,p,role,wrapper),targets=Array.isArray(payload.targets)?payload.targets:[],skip=!!payload.skip;
  if(view.blocked||(skip&&view.skipAllowed))return finishWithoutReveal(r,p,cb,{skipped:true});
  const tid=targets[0],legal=view.others.some(x=>x.id===tid),idx=Number(payload.centerIndexes?.[0]);
  if(role==='sentinel'){
   if(!legal)throw Error('보호할 다른 플레이어를 선택하세요.');r.shields.add(tid);history(r,{kind:'shield',actor:p.name,role:ROLE_INFO[role].name,target:r.players.find(x=>x.id===tid).name});return finishWithoutReveal(r,p,cb);
  }
  if(role==='alpha_wolf'){
   if(!legal)throw Error('우두머리 늑대가 교환할 수 있는 플레이어를 선택하세요.');const old=r.currentCards.get(tid),extra=r.centerCards[3];r.currentCards.set(tid,extra);r.centerCards[3]=old;recordSwap(r,p,role,r.players.find(x=>x.id===tid).name,'추가 가운데 늑대',old,extra);return finishWithoutReveal(r,p,cb);
  }
  if(role==='mystic_wolf'){
   if(!legal)throw Error('확인할 플레이어를 선택하세요.');return finishWithReveal(r,p,cb,{seen:[cardFaceView(r.currentCards.get(tid))]});
  }
  if(role==='apprentice_seer'){
   if(!view.center.includes(idx))throw Error('가운데 카드 한 장을 선택하세요.');return finishWithReveal(r,p,cb,{seen:[cardFaceView(r.centerCards[idx])]});
  }
  if(role==='investigator'){
   if(!legal)throw Error('아직 확인하지 않은 다른 플레이어를 선택하세요.');const card=r.currentCards.get(tid),seen=[cardFaceView(card)],examined=[...(p.nightState?.investigatorSeen||[]),tid];p.nightState={...(p.nightState||{}),investigatorSeen:examined};
   if(isWerewolf(card.role)||card.role==='tanner'){
    const transformed=isWerewolf(card.role)?'werewolf':'tanner';p.initialCard.piRole=transformed;history(r,{kind:'transform',actor:p.name,role:ROLE_INFO[role].name,target:r.players.find(x=>x.id===tid).name,toRole:ROLE_INFO[transformed].name});return finishWithReveal(r,p,cb,{seen,extraText:`당신은 ${ROLE_INFO[transformed].name} 승리 조건으로 변했습니다. 더 확인할 수 없습니다.`});
   }
   const next=examined.length<2&&legalPlayers(r,p,role,wrapper).length?follow(r,p,role,wrapper):null;
   return finishWithReveal(r,p,cb,{seen,extraText:next?'원하면 한 명 더 확인할 수 있습니다.':'최대 두 명 확인을 완료했습니다.'},{nextPrompt:next});
  }
  if(role==='witch'){
   if(view.phase!=='exchange'){
    if(!view.center.includes(idx))throw Error('가운데 카드 한 장을 선택하세요.');p.nightState={...(p.nightState||{}),witchIndex:idx};const next=follow(r,p,role,wrapper);return finishWithReveal(r,p,cb,{seen:[cardFaceView(r.centerCards[idx])],extraText:'확인한 가운데 카드를 반드시 플레이어 한 명과 바꿔야 합니다.'},{nextPrompt:next});
   }
   if(!legal)throw Error('교환할 플레이어를 선택하세요.');const centerIndex=p.nightState.witchIndex,old=r.currentCards.get(tid),center=r.centerCards[centerIndex];r.currentCards.set(tid,center);r.centerCards[centerIndex]=old;recordSwap(r,p,role,r.players.find(x=>x.id===tid).name,centerIndex===3?'추가 가운데 늑대':`가운데 ${centerIndex+1}`,old,center);return finishWithoutReveal(r,p,cb);
  }
  if(role==='village_idiot'){
   if(!['left','right'].includes(payload.direction))throw Error('왼쪽 또는 오른쪽을 선택하세요.');const movable=r.players.filter(x=>x.id!==p.id&&!shielded(r,x.id)),old=movable.map(x=>r.currentCards.get(x.id));
   if(movable.length>1){const delta=payload.direction==='right'?1:-1,moves=movable.map((x,i)=>({from:x.name,to:movable[(i+delta+movable.length)%movable.length].name,card:finalRoleView(old[i])}));movable.forEach((x,i)=>r.currentCards.set(movable[(i+delta+movable.length)%movable.length].id,old[i]));history(r,{kind:'rotate',actor:p.name,role:ROLE_INFO[role].name,direction:payload.direction,moves});}
   return finishWithoutReveal(r,p,cb);
  }
  if(role==='revealer'){
   if(!legal)throw Error('공개할 다른 플레이어를 선택하세요.');const card=r.currentCards.get(tid),hidden=isWerewolf(card.role)||card.role==='tanner';if(!hidden)r.revealedCards.set(tid,cardFaceView(card));history(r,{kind:'reveal',actor:p.name,role:ROLE_INFO[role].name,target:r.players.find(x=>x.id===tid).name,hidden,card:cardFaceView(card)});return finishWithReveal(r,p,cb,{seen:[cardFaceView(card)],extraText:hidden?'늑대 또는 무두장이 카드라 다시 덮었습니다.':'이 카드는 낮에 모두에게 공개됩니다.'});
  }
  if(role==='curator'){
   if(!legal)throw Error('아직 유물이 없는 다른 플레이어를 선택하세요.');const key=r.artifactDeck.pop();if(!key)return finishWithoutReveal(r,p,cb,{skipped:true});r.artifacts.set(tid,key);history(r,{kind:'artifact',actor:p.name,role:ROLE_INFO[role].name,target:r.players.find(x=>x.id===tid).name,artifact:ARTIFACTS[key].name});return finishWithoutReveal(r,p,cb);
  }
  throw Error('알 수 없는 확장 역할입니다.');
 }
 function botPayload(p){
  const pick=list=>list[Math.floor(Math.random()*list.length)];if(p.blocked)return {};
  if(p.input==='direction')return {direction:Math.random()<.5?'left':'right'};
  if(p.input==='center')return {centerIndexes:[pick(p.center)]};
  if(p.others?.length)return {targets:[pick(p.others).id]};return {skip:true};
 }
 return {prompt,perform,botPayload,shielded,roles:DAYBREAK_ROLES,artifacts:ARTIFACTS};
};
