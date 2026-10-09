'use strict';
function replayFrames(result){
 const initial=[...(result.players||[]).map(p=>({key:p.id,name:p.name,card:{...p.initial}})),...(result.initialCenter||[]).map((c,i)=>({key:'center'+i,name:'가운데 '+(i+1),card:{...c}}))];
 const frames=[],snapshot=(title,caption,seats)=>frames.push({title,caption,seats:seats.map(s=>({...s,card:{...s.card}}))});
 snapshot('처음 카드','밤이 시작되기 전 배분된 카드입니다.',initial);
 for(const [i,h] of (result.history||[]).entries()){
  if(h.kind==='swap'){const a=initial.find(s=>s.card.id===h.cardA?.id),b=initial.find(s=>s.card.id===h.cardB?.id);if(a&&b)[a.card,b.card]=[b.card,a.card];snapshot('밤 이동 '+(i+1),h.actor+' · '+h.role+' · '+h.a+' ↔ '+h.b,initial);}
  if(h.kind==='copy'){const seat=initial.find(s=>s.card.id===h.cardId);if(seat)seat.card={...seat.card,displayName:'도플갱어 → '+h.role,copiedRole:h.role};snapshot('밤 행동 '+(i+1),h.actor+' · '+h.target+'의 '+h.role+' 역할 복사 (카드 위치 유지)',initial);}
 }
 if(!(result.history||[]).length)snapshot('밤 이동 없음','이번 밤에는 카드 교환이나 역할 복사가 없었습니다.',initial);
 snapshot('최종 카드','밤이 끝난 뒤 이 역할로 승패를 판정합니다.',[...(result.players||[]).map(p=>({key:p.id,name:p.name,card:p.final})),...(result.center||[]).map((c,i)=>({key:'center'+i,name:'가운데 '+(i+1),card:c}))]);
 frames.push({title:'투표 · 승패',caption:result.winnerText,seats:null});return frames;
}
if(typeof module!=='undefined')module.exports={replayFrames};
