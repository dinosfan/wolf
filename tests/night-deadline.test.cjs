'use strict';const assert=require('assert');const {harness}=require('./simulation-harness.cjs');
for(let seed=1;seed<=20;seed++){
 const h=harness(seed),cs=[h.client(),h.client(),h.client()],deck=['doppelganger','drunk','robber','seer','troublemaker','werewolf'];h.setDeck(deck);const code=cs[0].call('room:create',{name:'P0'}).code;
 for(let i=1;i<3;i++)cs[i].call('room:join',{code,name:'P'+i});cs[0].call('room:setRoles',{roles:deck});cs[0].call('game:start');for(const c of cs)c.call('role:ready');const room=h.room(code);let windows=0,guard=0;
 while(room.phase==='night'){
  assert(++guard<80);
  if(room.narrationCue)cs[0].call('narration:done',{cueId:room.narrationCue.cueId});
  else if(room.actionWindowOpen){const step=room.activeNightRole;h.advance(9999);assert.equal(room.activeNightRole,step);assert(!room.minimumActionElapsed);h.advance(1);assert.equal(room.pendingActors.size,0);assert.equal(room.awaitingAck.size,0);assert(!room.actionWindowOpen);assert(!cs[0].call('night:action',{}).ok);windows++;}
  else h.advance(500);
 }
 assert.equal(room.phase,'discussion');assert.equal(windows,6);assert(room.actionHistory.some(x=>x.kind==='copy'));assert(room.actionHistory.some(x=>x.kind==='swap'&&x.role==='주정뱅이'));assert(!room.actionHistory.some(x=>x.kind==='swap'&&(x.role==='강도'||x.role==='말썽쟁이')));
}
console.log('Fixed night deadline passed: 20 unattended games, all six roles exactly 10 seconds, copy/drunk mandatory actions, optional skips, auto acknowledgement and late action rejection.');
