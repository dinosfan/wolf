'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createApp,handle,ROOMS,makeDeck,isMatch,TOPICS}=require('../server');

function players(num=3,cards=60) {
 const host=handle('create',{name:'호스트',seats:num,cards});
 const others=Array.from({length:num-1},(_,i)=>handle('join',{code:host.code,name:'친구'+(i+1)}));
 const all=[host,...others];for(let i=1;i<all.length;i++)handle('ready',all[i]);
 const room=ROOMS.get(host.code);room.players.forEach(p=>p.online=true);
 return {host,others,room,all};
}

test('덱: 기호 구성, 와일드카드, 카테고리, 카드 수',()=>{
 assert.ok(TOPICS.length>=150);
 for(const seats of [3,4,6,7,8]) for(const n of [60,96,120]) {
  const cards=makeDeck(n,seats), normals=cards.filter(c=>c.kind==='normal');
  assert.equal(normals.length,n);assert.equal(cards.length,n+Math.max(5,Math.round(n/12)));
  assert.equal(new Set(normals.map(c=>c.id)).size,n);
  assert.equal(new Set(normals.map(c=>c.topic)).size,n);
  assert.ok(normals.every(c=>c.symbol>=0&&c.symbol<(seats===3?6:seats>=7?10:8)));
  assert.ok(cards.filter(c=>c.kind==='wild').every(c=>c.symbols[0]!==c.symbols[1]));
 }
 assert.equal(isMatch({symbol:2},{symbol:2},null),true);
 assert.equal(isMatch({symbol:2},{symbol:4},{symbols:[2,4]}),true);
 assert.equal(isMatch({symbol:2},{symbol:5},{symbols:[2,4]}),false);
});

test('방 생성/입장/설정/권한/준비/시작',()=>{
 const {host,others,room}=players(4);
 const bad={...host,token:'fake'};
 assert.throws(()=>handle('state',bad),/유효하지/);
 assert.throws(()=>handle('settings',{...others[0],seats:4,cards:60}),/방장/);
 assert.throws(()=>handle('join',{code:host.code,name:'새로'}),/가득/);
 assert.throws(()=>handle('settings',{...host,seats:3,cards:96}),/확인/);
 assert.deepEqual(handle('settings',{...host,seats:4,cards:96}),{ok:true});
 handle('start',host);assert.equal(room.phase,'playing');
 assert.throws(()=>handle('start',host),/진행 중/);
 assert.throws(()=>handle('draw',others[0]),/내 차례/);
 assert.throws(()=>handle('join',{code:host.code,name:'늦게'}),/시작/);
});

test('전체 라운드: 순차 드로우, 와일드, 승리, 연쇄, 중복 방지, 재대결',()=>{
 const {host,room,all}=players(6,120);handle('start',host);
 let draws=0,duels=0,wild=0,chain=0,lastWasDuel=false;
 while(room.phase!=='finished' && draws+duels<2000){
  if(room.phase==='playing') {
   const before=room.deck.length,previousIndex=room.turnIndex,auth=all[previousIndex];
   handle('draw',auth);draws++;
   assert.equal(room.deck.length,before-1);
   if(room.turnIndex===previousIndex) wild++;
   lastWasDuel=false;
  }else if(room.phase==='duel'){
   if(lastWasDuel) chain++;
   const index=room.duel.index,winnerId=room.duel.aId;
   const before=room.players.find(p=>p.id===winnerId).score;
   handle('resolve',{...host,winnerId,duelIndex:index});duels++;
   assert.equal(room.players.find(p=>p.id===winnerId).score,before+1);
   assert.throws(()=>handle('resolve',{...host,winnerId,duelIndex:index}),/이미 처리|진행 중/);
   lastWasDuel=true;
  }else assert.fail('unknown phase '+room.phase);
 }
 assert.equal(room.phase,'finished');
 assert.equal(room.deck.length,0);
 assert.ok(draws>=120 && duels>0,`draws ${draws} duels ${duels}`);
 assert.ok(wild>0);
 assert.equal(room.players.reduce((s,p)=>s+p.score,0),duels);
 assert.ok(room.winners.length>=1);
 assert.equal(room.winners.every(id=>room.players.find(p=>p.id===id)?.score===Math.max(...room.players.map(p=>p.score))),true);
 handle('restart',host);assert.equal(room.phase,'lobby');
 assert.ok(room.players.filter(p=>p.ready).length===1);
 for(let i=1;i<all.length;i++)handle('ready',all[i]);
 handle('start',host);assert.equal(room.phase,'playing');
 console.log({draws,duels,wild,chain});
});

test('HTTP 기본 페이지/상태와 실시간 이벤트 스트림',async()=>{
 const server=createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const port=server.address().port, base=`http://127.0.0.1:${port}`;
  const html=await fetch(base).then(r=>r.text());assert.ok(html.includes('번뜩!'));
  assert.ok(html.includes('data-action="draw"'));
  assert.deepEqual(await fetch(base+'/health').then(r=>r.json()),{ok:true,rooms:ROOMS.size});
  const host=handle('create',{name:'호스트',seats:3,cards:60});
  const url='/api/events?'+new URLSearchParams(host);
  let bytes='',closeConnection;
  const first=await new Promise((resolve,reject)=>{
   const req=http.get(base+url,res=>{
    closeConnection=()=>{req.destroy();res.destroy();};
    assert.equal(res.headers['content-type'],'text/event-stream; charset=utf-8');
    res.on('data',chunk=>{bytes+=chunk.toString();if(bytes.includes('"code":"'+host.code+'"'))resolve(true);});
   });req.on('error',e=>{if(e.code!=='ECONNRESET')reject(e);});
   setTimeout(()=>reject(Error('SSE timed out')),1000).unref();
  });
  assert.equal(first,true);assert.ok(ROOMS.get(host.code).players[0].online);
  closeConnection();
  const wrong=await fetch(base+'/api/draw',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...host,token:'bad'})});
  assert.equal(wrong.status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('대기실 나가기: 자리 정리, 방장 승계, 재입장',()=>{
 const {host,others,room}=players(4,60);
 handle('leave',others[1]);assert.equal(room.players.length,3);
 const another=handle('join',{code:host.code,name:'새 친구'});
 handle('ready',another);room.players.find(p=>p.id===another.playerId).online=true;
 handle('leave',host);
 assert.equal(room.hostId,others[0].playerId);
 assert.equal(room.players[0].ready,true);
 assert.equal(room.players.length,3);
 handle('start',others[0]);assert.equal(room.phase,'playing');
 assert.throws(()=>handle('leave',others[0]),/진행 중/);
});

test('인원별/카드별 24회 랜덤 게임 완주 (교착·잘못된 카드 없음)',()=>{
 for(const seats of [3,4,5,6,7,8])for(const count of [60,96,120,60]) {
  const {host,room,all}=players(seats,count);handle('start',host);
  let total=0, wins=0;
  while(room.phase!=='finished'&&total++<400){
   if(room.phase==='playing')handle('draw',all[room.turnIndex]);
   else if(room.phase==='duel'){handle('resolve',{...host,duelIndex:room.duel.index,winnerId:room.duel.aId});wins++;}
   else assert.fail('Unexpected phase '+room.phase);
  }
  assert.equal(room.phase,'finished',`game stuck seats=${seats} cards=${count}`);
  assert.equal(room.players.reduce((s,p)=>s+p.score,0),wins);
  assert.equal(room.deck.length,0);
  ROOMS.delete(room.code);
 }
});