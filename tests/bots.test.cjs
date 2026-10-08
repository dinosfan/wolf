'use strict';
const assert=require('assert'),vm=require('vm');const {harness,root}=require('./simulation-harness.cjs');const E=require(root+'/game-engine.js');
let games=0;const copied=new Set();
function hostAction(h,host,room){
 if(room.awaitingAck.has(host.id)){host.call('night:ack');return}
 const p=host.take('night:prompt');assert(p);let payload={};const r=p.actionRole;
 if(p.stage==='copy'||r==='robber')payload={targets:[p.others[0].id]};
 else if(r==='seer')payload={type:'center',centerIndexes:[0,1]};
 else if(r==='troublemaker')payload={targets:p.others.slice(0,2).map(x=>x.id)};
 else if(r==='drunk'||r==='werewolf'&&p.solo&&p.loneWolfCenter)payload={centerIndexes:[0]};
 assert(host.call('night:action',payload).ok);
}
function play(seed,n,forced=null){
 const h=harness(seed),host=h.client();const code=host.call('room:create',{name:'Host'}).code;host.call('room:setPlayerCount',{count:n});
 assert(host.call('room:addBot',{fill:true}).ok);const room=h.room(code);assert.equal(room.players.length,n);assert.equal(room.players.filter(p=>p.bot).length,n-1);assert(!host.call('room:addBot').ok);
 if(forced){
  const deck=['villager','doppelganger',forced],pool=Object.keys(E.ROLE_INFO).filter(r=>forced==='mason'||r!=='mason').flatMap(r=>Array(E.ROLE_INFO[r].max).fill(r));
  for(const r of deck)pool.splice(pool.indexOf(r),1);while(deck.length<13)deck.push(pool.shift());
  assert(E.validateRoleSelection(deck,n).ok);h.setDeck(deck);host.call('room:setRoles',{roles:deck});
  h.ctx.forced=forced;h.ctx.r=room;vm.runInContext("const originalBotPayload=botNightPayload; botNightPayload = prompt => prompt.stage === 'copy' ? {targets:[prompt.others.find(p=>r.players.find(x=>x.id===p.id).initialCard.role===forced).id]} : originalBotPayload(prompt);",h.ctx);
 }
 assert(host.call('game:start').ok);assert.equal(room.ready.size,n-1);assert(!host.call('room:removeBot',{playerId:room.players[1].id}).ok);
 host.call('role:ready');assert.equal(room.phase,'night');let ticks=0;
 while(room.phase==='night'){
  assert(++ticks<200,'Bots must not stall the night');
  if(room.narrationCue)host.call('narration:done',{cueId:room.narrationCue.cueId});
  else if(room.actionWindowOpen&&room.pendingActors.has(host.id))hostAction(h,host,room);
  else h.advance(15000);
 }
 assert.equal(room.phase,'discussion');
 if(forced){const dop=room.players.find(p=>p.initialCard.role==='doppelganger');assert.equal(dop.initialCard.doppelRole,forced);copied.add(forced)}
 host.call('discussion:endEarly');h.advance(2000);assert(room.players.filter(p=>p.bot).every(p=>p.vote&&p.vote!==p.id));
 assert(host.call('vote:cast',{targetId:room.players[1].id}).ok);assert.equal(room.phase,'result');assert.equal(room.lastReveal.players.length,n);assert.equal(room.lastReveal.center.length,3);
 host.call('game:restart');assert.equal(room.phase,'lobby');assert.equal(room.botTimers.size,0);assert(room.players.filter(p=>p.bot).every(p=>!p.vote&&!p.nightState&&!p.pendingReveal));
 assert(host.call('room:removeBot',{playerId:room.players[1].id}).ok);assert.equal(room.players.length,n-1);assert(host.call('room:addBot').ok);
 assert(host.call('room:leave').ok);assert(!h.room(code),'No bot-only rooms remain');games++;
}
for(const r of Object.keys(E.ROLE_INFO).filter(r=>r!=='doppelganger'))play(games+1,10,r);
for(let i=0;i<200;i++)play(i+40,3+i%8);
{
 const h=harness(),host=h.client(),guest=h.client(),code=host.call('room:create',{name:'H'}).code;guest.call('room:join',{code,name:'G'});
 assert(!guest.call('room:addBot').ok);assert(host.call('room:addBot').ok);const r=h.room(code),bot=r.players.find(p=>p.bot);
 assert(!guest.call('room:removeBot',{playerId:bot.id}).ok);assert(!host.call('room:removeBot',{playerId:guest.id}).ok);
 assert(!h.client().call('room:resume',{code,resumeToken:null}).ok);host.call('room:leave');assert.equal(r.hostId,guest.id,'Bots never become host');guest.disconnect();h.advance(30000);assert(!h.room(code),'Disconnected last human leaves no bot-only room');
}
console.log(`Bot checks passed: ${games} complete solo games, ${copied.size} Doppelganger copy branches, add/fill/remove/permissions/host transfer/cleanup.`);
