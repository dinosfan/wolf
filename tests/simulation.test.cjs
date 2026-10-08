'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {harness,root}=require('./simulation-harness.cjs');
const E=require(root+'/game-engine.js');
let count=0;const coverage={roles:{},copied:{},steps:{},reconnect:0,teams:{}};
const roles=Object.keys(E.ROLE_INFO);
let seed=872412;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const pick=a=>a[Math.floor(random()*a.length)];
function shuffled(a){return [...a].sort(()=>random()-.5)}
function oracle(ps,cards){
 const role=id=>{const c=cards.get(id);return c.role==='doppelganger'&&c.doppelRole?c.doppelRole:c.role};
 const votes={};for(const p of ps)votes[p.vote]=(votes[p.vote]||0)+1;
 const max=Math.max(...Object.values(votes)),dead=new Set(max<2?[]:Object.keys(votes).filter(id=>votes[id]===max));
 let change=true;while(change){change=false;for(const p of ps)if(dead.has(p.id)&&role(p.id)==='hunter'&&!dead.has(p.vote)){dead.add(p.vote);change=true}}
 const wolves=ps.filter(p=>role(p.id)==='werewolf'),minions=ps.filter(p=>role(p.id)==='minion'),tanners=ps.filter(p=>role(p.id)==='tanner'&&dead.has(p.id));
 const village=ps.filter(p=>!['werewolf','minion','tanner','doppelganger'].includes(role(p.id)));
 const deadWolf=wolves.some(p=>dead.has(p.id));let teams=[],winners=[];
 if(tanners.length){teams=['tanner'];winners=tanners;if(deadWolf){teams.push('village');winners=winners.concat(village)}}
 else if(wolves.length){if(deadWolf){teams=['village'];winners=village}else{teams=['wolf'];winners=wolves.concat(minions)}}
 else if(!dead.size){teams=['village'];winners=village}
 else if(minions.length&&ps.some(p=>dead.has(p.id)&&role(p.id)!=='minion')){teams=['wolf'];winners=minions}
 return {dead:[...dead].sort(),teams:teams.sort(),winners:winners.map(p=>p.id).sort()};
}
function play(deck,copyRole=null,index=0){
 const h=harness(index+1);h.setDeck(deck);const n=deck.length-3,cs=Array.from({length:n},(_,i)=>h.client('P'+i));
 const created=cs[0].call('room:create',{name:'P0'}),code=created.code;
 assert(cs[0].call('room:setPlayerCount',{count:n}).ok);
 for(let i=1;i<n;i++)assert(cs[i].call('room:join',{code,name:'P'+i}).ok);
 assert(cs[0].call('room:setRoles',{roles:deck}).ok);assert(cs[0].call('game:start').ok);
 const room=h.room(code);let ref=new Map(room.players.map(p=>[p.id,{...p.initialCard}])),center=room.centerCards.map(c=>({...c}));
 for(const c of cs){assert(c.take('role:reveal'));c.call('role:ready')}
 assert.equal(room.phase,'night');let loops=0;
 function activeClient(id){return cs.find(c=>c.id===id)}
 function reconnect(i){const old=cs[i],p=room.players.find(p=>p.id===old.id),tok=p.resumeToken,card=ref.get(old.id);old.disconnect();const fresh=h.client(p.name);assert(fresh.call('room:resume',{code,resumeToken:tok}).ok);ref.delete(old.id);ref.set(fresh.id,card);cs[i]=fresh;coverage.reconnect++;return fresh}
 function action(c){const prompt=c.take('night:prompt');assert(prompt,'Actor must receive prompt');
  const r=prompt.actionRole,others=room.players.filter(p=>p.id!==c.id).map(p=>p.id),mine=ref.get(c.id);let payload={},expected=null,follow=false;
  coverage.roles[r]=(coverage.roles[r]||0)+1;
  if(prompt.stage==='copy'){
   const target=copyRole?others.find(id=>ref.get(id).role===copyRole):pick(others);assert(target);
   payload={targets:[target]};mine.doppelRole=ref.get(target).role;expected=[ref.get(target).role];follow=['seer','robber','troublemaker','drunk'].includes(mine.doppelRole);coverage.copied[mine.doppelRole]=(coverage.copied[mine.doppelRole]||0)+1;
  }else if(r==='seer'){
   if(random()<.4){payload={type:'center',centerIndexes:[0,2]};expected=[center[0].role,center[2].role]}
   else if(random()<.2)payload={skip:true};else{const id=pick(others);payload={type:'player',targets:[id]};expected=[ref.get(id).role]}
  }else if(r==='robber'){
   if(random()<.2)payload={skip:true};else{const id=pick(others),theirs=ref.get(id);ref.set(c.id,theirs);ref.set(id,mine);payload={targets:[id]};expected=[theirs.role]}
  }else if(r==='troublemaker'){
   if(random()<.2)payload={skip:true};else{const ids=shuffled(others).slice(0,2),a=ref.get(ids[0]),b=ref.get(ids[1]);ref.set(ids[0],b);ref.set(ids[1],a);payload={targets:ids}}
  }else if(r==='drunk'){
   const idx=Math.floor(random()*3);ref.set(c.id,center[idx]);center[idx]=mine;payload={centerIndexes:[idx]};
  }else if(r==='werewolf'&&prompt.solo&&prompt.loneWolfCenter){if(random()<.2)payload={skip:true};else{payload={centerIndexes:[1]};expected=[center[1].role]}}
  else if(r==='insomniac'){assert.equal(prompt.currentCard.role,mine.role)}
  const res=c.call('night:action',payload);assert(res?.ok,`${r}/${prompt.stage}: ${res?.error}`);
  if(expected)assert.deepEqual(res.seen.map(x=>x.role),expected);
  else assert(!res.seen,'Hidden card must stay hidden for swap-only roles');
  const repeated=c.call('night:action',payload);assert(!repeated.ok,'No repeated action allowed');
  if(res.requiresAck){
   if(index%7===0){const i=cs.indexOf(c);c=reconnect(i);assert.deepEqual(c.take('night:reveal').seen.map(x=>x.role),expected)}
   c.call('night:ack');
   if(follow){assert.equal(c.take('night:prompt').stage,'followup');action(c)}
  }
 }
 while(room.phase==='night'){
  assert(++loops<100,'Night terminates');
  if(room.narrationCue){
   const cue=room.narrationCue,at=h.now();
   if(cue.payload.kind==='role-start'){
    coverage.steps[cue.payload.role]=(coverage.steps[cue.payload.role]||0)+1;
    for(const id of room.pendingActors)assert(!activeClient(id).call('night:action',{}).ok,'No action before voice instruction ends');
   }
   if(index%13===0&&cue.payload.kind==='role-start'){const host=reconnect(0);assert.equal(host.take('narration:say').cueId,cue.cueId)}
   cs[1].call('narration:done',{cueId:cue.cueId});assert.equal(room.narrationCue?.cueId,cue.cueId,'Only host ends narration');
   cs[0].call('narration:done',{cueId:'stale'});assert.equal(room.narrationCue?.cueId,cue.cueId,'Stale audio callbacks ignored');
   cs[0].call('narration:done',{cueId:cue.cueId});
  }else if(room.pendingActors.size){for(const id of [...room.pendingActors])action(activeClient(id));}
  else h.advance(11000);
 }
 assert.equal(room.phase,'discussion');
 for(const p of room.players){const actual=room.currentCards.get(p.id),expected=ref.get(p.id);assert.equal(actual.id,expected.id);assert.equal(actual.doppelRole,expected.doppelRole)}
 for(let i=0;i<3;i++){assert.equal(room.centerCards[i].id,center[i].id);assert.equal(room.centerCards[i].doppelRole,center[i].doppelRole)}
 const cues=h.events.filter(e=>e.event==='narration:say'&&e.target===code).map(e=>e.data);
 const order=['doppelganger','werewolf','minion','mason','seer','robber','troublemaker','drunk','insomniac','doppel_insomniac'];
 const expected=order.filter(r=>r==='doppel_insomniac'?deck.includes('doppelganger')&&deck.includes('insomniac'):deck.includes(r));
 assert.deepEqual(cues.filter(x=>x.kind==='role-start').map(x=>x.role),expected);assert.deepEqual(cues.filter(x=>x.kind==='role-end').map(x=>x.role),expected);assert.equal(cues[0].kind,'sleep');assert.equal(cues.at(-1).kind,'wake');
 assert(!cs[1].call('room:setRoles',{roles:deck}).ok);
 cs[0].call('discussion:endEarly');assert.equal(room.phase,'voting');
 assert(!cs[0].call('vote:cast',{targetId:cs[0].id}).ok);assert(!cs[0].call('vote:cast',{targetId:'missing'}).ok);
 const target=pick(cs.slice(1)).id;assert(cs[0].call('vote:cast',{targetId:target}).ok);assert(!cs[0].call('vote:cast',{targetId:target}).ok);
 h.advance(240000);assert.equal(room.players[0].vote,target,'Early vote survives old discussion timer');
 for(let i=1;i<n;i++)assert(cs[i].call('vote:cast',{targetId:pick(cs.filter(c=>c!==cs[i])).id}).ok);
 assert.equal(room.phase,'result');const out=oracle(room.players,ref),reveal=cs[0].take('game:result');
 assert.deepEqual([...reveal.killedIds].sort(),out.dead);assert.deepEqual([...reveal.winningTeams].sort(),out.teams);assert.deepEqual([...reveal.winnerIds].sort(),out.winners);
 coverage.teams[out.teams.join('+')||'none']=(coverage.teams[out.teams.join('+')||'none']||0)+1;
 const win=room.lastReveal.winnerIds.includes(cs[0].id);const newHost=reconnect(0);assert.equal(room.lastReveal.winnerIds.includes(newHost.id),win,'Victory badge survives reconnect');
 const selection=[...room.selectedRoles];cs[0].call('game:restart');assert.equal(room.phase,'lobby');assert.equal(room.currentCards.size,0);assert(!room.lastReveal);assert.deepEqual([...room.selectedRoles],selection);
 assert(cs[0].call('game:start').ok);assert.equal(room.phase,'roleReveal');assert.equal(room.ready.size,0);assert(room.players.every(p=>!p.vote&&!p.pendingReveal));
 count++;
}
for(const role of roles.filter(r=>r!=='doppelganger')){
 let deck=['doppelganger',role,'werewolf','seer','robber','troublemaker','drunk','insomniac','hunter','tanner','villager','villager','villager'];
 if(role==='mason')deck=['doppelganger','mason','mason','werewolf','seer','robber','troublemaker','drunk','insomniac','hunter','tanner','villager','villager'];
 const counts={};deck=deck.filter(r=>{counts[r]=(counts[r]||0)+1;return counts[r]<=E.ROLE_INFO[r].max});
 while(deck.length<13){const r=roles.find(x=>x!=='mason'&&(counts[x]||0)<E.ROLE_INFO[x].max);deck.push(r);counts[r]=(counts[r]||0)+1}
 assert(E.validateRoleSelection(deck,10).ok);play(deck,role,count);
}
const pool=roles.flatMap(r=>Array(E.ROLE_INFO[r].max).fill(r));
for(let i=0;i<1000;i++){const n=3+i%8;let deck;do{deck=shuffled(pool).slice(0,n+3)}while(!E.validateRoleSelection(deck,n).ok);play(deck,null,i+100)}
let outcomes=0;
for(let i=0;i<100000;i++){
 const n=3+i%8,ps=Array.from({length:n},(_,j)=>({id:'p'+j,name:'P'+j})),cards=new Map();
 for(const p of ps){p.vote=pick(ps.filter(x=>x!==p)).id;const c=E.makeCard(pick(roles),p.id);if(c.role==='doppelganger')c.doppelRole=pick(roles.filter(r=>r!=='doppelganger'));cards.set(p.id,c)}
 const expected=oracle(ps,cards),actual=E.resolveOutcome(ps,id=>cards.get(id));assert.deepEqual(actual.killedIds.sort(),expected.dead);assert.deepEqual(actual.winningTeams.sort(),expected.teams);assert.deepEqual(actual.winnerIds.sort(),expected.winners);outcomes++;
}
const report={fullGames:count,outcomeCases:outcomes,coverage};if(process.env.SIM_REPORT)fs.writeFileSync(process.env.SIM_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
