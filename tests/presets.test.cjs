'use strict';
const assert=require('assert');const {harness,root}=require('./simulation-harness.cjs');const E=require(root+'/game-engine.js');
for(let n=3;n<=10;n++)for(const mode of ['beginner','chaos']){
 const h=harness(n),host=h.client(),guest=h.client();const code=host.call('room:create',{name:'H'}).code;
 host.call('room:setPlayerCount',{count:n});guest.call('room:join',{code,name:'G'});
 assert(!guest.call('room:setPreset',{mode}).ok);assert(!host.call('room:setPreset',{mode:'invalid'}).ok);
 assert(host.call('room:setPreset',{mode}).ok);const room=h.room(code);assert(E.validateRoleSelection([...room.selectedRoles],n).ok);assert.equal(room.selectedRoles.length,n+3);
 host.call('room:addBot',{fill:true});assert(host.call('game:start').ok);assert(!host.call('room:setPreset',{mode}).ok);
}
console.log('Preset checks passed: both modes, 3–10 players, permissions and phase limits.');
