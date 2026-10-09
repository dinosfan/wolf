'use strict';const assert=require('assert');const {harness}=require('./simulation-harness.cjs');
for(const phase of ['lobby','roleReveal','night','discussion','voting','result']){
 const h=harness(),host=h.client(),guest=h.client(),code=host.call('room:create',{name:'H'}).code;guest.call('room:join',{code,name:'G'});host.call('room:addBot');const room=h.room(code);
 host.call('game:start');room.phase=phase;assert(!guest.call('room:close').ok);assert(h.room(code));assert(host.call('room:close').ok);assert(!h.room(code));assert(host.take('room:closed'));assert(guest.take('room:closed'));assert(!host.rooms.has(code));assert(!guest.rooms.has(code));assert(!h.client().call('room:join',{code,name:'X'}).ok);h.advance(300000);assert(!h.room(code));assert(host.call('room:create',{name:'H'}).ok);assert(guest.call('room:create',{name:'G'}).ok);
}
console.log('Room close checks passed in all six phases: host only, notify every human, remove membership, cleanup and immediate reuse.');
