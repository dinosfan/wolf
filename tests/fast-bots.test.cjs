'use strict';
const assert=require('assert');const {harness}=require('./simulation-harness.cjs');
for(let n=3;n<=10;n++){
 const h=harness(n),host=h.client(),code=host.call('room:create',{name:'Host'}).code;
 host.call('room:setPlayerCount',{count:n});host.call('room:addBot',{fill:true});host.call('room:setPreset',{mode:'chaos'});
 const r=h.room(code);assert(host.take('room:update').fastBotGame);assert(host.call('game:start').ok);host.call('role:ready');let ticks=0;
 while(r.phase==='night'){
  assert(++ticks<2000);
  if(r.awaitingAck.has(host.id)){assert.equal(r.phase,'night');host.call('night:ack')}
  else if(r.actionWindowOpen&&r.pendingActors.has(host.id)){
   const p=host.take('night:prompt'),role=p.actionRole;let payload={};
   if(p.stage==='copy'||role==='robber')payload={targets:[p.others[0].id]};
   else if(role==='seer')payload={type:'center',centerIndexes:[0,1]};
   else if(role==='troublemaker')payload={targets:p.others.slice(0,2).map(x=>x.id)};
   else if(role==='drunk'||role==='werewolf'&&p.solo&&p.loneWolfCenter)payload={centerIndexes:[0]};
   assert(host.call('night:action',payload).ok);
  }else h.advance(20);
 }
 assert.equal(r.phase,'discussion');assert(h.now()<7000,'Quick night completes in under seven virtual seconds');assert.equal(r.discussionEndsAt-h.now(),3000);
 assert(!h.events.some(e=>e.event==='narration:say'&&!e.data.fast));h.advance(3200);assert.equal(r.phase,'voting');assert(r.players.filter(p=>p.bot).every(p=>p.vote));assert(host.call('vote:cast',{targetId:r.players[1].id}).ok);assert.equal(r.phase,'result');
 host.call('game:restart');assert(host.call('room:setFastBots',{enabled:false}).ok);assert(!host.take('room:update').fastBotGame);
}
{
 const h=harness(),host=h.client(),guest=h.client(),code=host.call('room:create',{name:'H'}).code;
 guest.call('room:join',{code,name:'G'});host.call('room:addBot');const r=h.room(code);assert(!host.take('room:update').fastBotGame);assert(!guest.call('room:setFastBots',{enabled:false}).ok);
 host.call('game:start');assert(!host.call('room:setFastBots',{enabled:false}).ok);host.call('role:ready');guest.call('role:ready');assert(r.narrationCue);assert(!r.narrationCue.payload.fast);
}
console.log('Fast bot checks passed: 3–10 players, night under 7 seconds, automatic 3-second discussion, manual human actions, multiplayer keeps normal timing.');
