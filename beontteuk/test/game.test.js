'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createApp,handle,ROOMS,makeDeck,isMatch,TOPICS,drawCard,resolveDuel,scheduleBot}=require('../server');

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


test('연습봇: 방장만 추가/제거, 자리 제한, 가짜 접속, 단독 시작',()=>{
 const host=handle('create',{name:'혼자',seats:3,cards:60});
 const room=ROOMS.get(host.code);room.players[0].online=true;
 const guest=handle('join',{code:host.code,name:'친구'});
 assert.throws(()=>handle('addBot',{...guest,count:1}),/방장/);
 handle('leave',guest);
 assert.deepEqual(handle('addBot',{...host,count:2}),{ok:true});
 const state=handle('state',host);
 assert.equal(state.players.length,3);
 assert.ok(state.players.slice(1).every(p=>p.isBot&&p.online&&p.ready));
 assert.ok(state.players.every(p=>p.token===undefined));
 assert.throws(()=>handle('addBot',{...host,count:1}),/자리가 부족/);
 assert.throws(()=>handle('removeBot',{...host,botId:host.playerId}),/해당 봇/);
 const botId=room.players[1].id;
 handle('removeBot',{...host,botId});assert.equal(room.players.length,2);
 handle('addBot',{...host,count:1});
 handle('start',host);assert.equal(room.phase,'playing');
 assert.throws(()=>handle('addBot',{...host,count:1}),/대기실/);
 assert.throws(()=>handle('removeBot',{...host,botId:room.players[1].id}),/대기실/);
 const bot=room.players.find(p=>p.isBot);
 assert.throws(()=>handle('draw',{code:room.code,playerId:bot.id,token:'wrong'}),/유효하지/);
 if(room.botTimer)clearTimeout(room.botTimer);
 ROOMS.delete(room.code);
});

test('연습봇: 봇 차례/봇끼리 판정 포함 게임 완주 및 재대결 준비',()=>{
 const host=handle('create',{name:'혼자',seats:6,cards:60});
 const room=ROOMS.get(host.code);room.players[0].online=true;
 handle('addBot',{...host,count:2});handle('start',host);
 let turns=0,botTurns=0,duels=0,bothBots=0;
 while(room.phase!=='finished'&&turns++<400){
   if(room.phase==='playing') {
     const p=room.players[room.turnIndex];
     if(p.isBot)botTurns++;
     drawCard(room,p);
   } else if(room.phase==='duel') {
     const d=room.duel,a=room.players.find(p=>p.id===d.aId),b=room.players.find(p=>p.id===d.bId);
     if(a.isBot&&b.isBot)bothBots++;
     resolveDuel(room,d.aId);duels++;
   } else assert.fail('알 수 없는 phase');
 }
 assert.equal(room.phase,'finished');
 assert.ok(botTurns>10);
 assert.ok(duels>0);
 assert.equal(room.players.reduce((sum,p)=>sum+p.score,0),duels);
 handle('restart',host);
 assert.equal(room.phase,'lobby');
 assert.ok(room.players.every(p=>p.ready));
 handle('start',host);assert.equal(room.phase,'playing');
 if(room.botTimer)clearTimeout(room.botTimer);
 ROOMS.delete(room.code);
});

test('연습봇: 실제 타이머로 봇 턴 자동 공개, 봇 vs 봇 대결 자동 승자',async()=>{
 const host=handle('create',{name:'혼자',seats:3,cards:60});
 const room=ROOMS.get(host.code);room.players[0].online=true;
 handle('addBot',{...host,count:2});handle('start',host);
 room.deck=[{id:'c1',kind:'normal',symbol:1,topic:'과일'}, {id:'c2',kind:'normal',symbol:2,topic:'채소'}, {id:'c3',kind:'normal',symbol:3,topic:'나라'}];
 handle('draw',host); // 첫 장 정상 공개
 assert.equal(room.phase,'playing');
 assert.equal(room.turnIndex,1);
 await new Promise(resolve=>setTimeout(resolve,1000));
 assert.equal(room.players[1].playPile.length,1);
 assert.equal(room.turnIndex,2);
 // 봇끼리 동일한 심볼을 강제로 만들고 대결 자동 결과 확인
 if(room.botTimer)clearTimeout(room.botTimer);
 room.phase='duel';room.players[2].playPile=[{id:'forced',kind:'normal',symbol:room.players[1].playPile[0].symbol,topic:'영화'}];
 room.duel={aId:room.players[1].id,bId:room.players[2].id,index:123,startedAt:Date.now()};
 scheduleBot(room);
 await new Promise(resolve=>setTimeout(resolve,1350));
 assert.equal(room.players[1].score+room.players[2].score,1);
 assert.notEqual(room.duel?.index,123);
 if(room.botTimer)clearTimeout(room.botTimer);
 ROOMS.delete(room.code);
});

test('연습봇: 방장이 나가면 사람이 승계하고 봇만 남으면 방 제거',()=>{
 const host=handle('create',{name:'사람1',seats:4,cards:60});
 const room=ROOMS.get(host.code);
 handle('addBot',{...host,count:2});
 const guest=handle('join',{code:host.code,name:'사람2'});
 handle('leave',host);
 assert.equal(room.hostId,guest.playerId);
 assert.equal(room.players.find(p=>p.id===guest.playerId).ready,true);
 handle('leave',guest);
 assert.equal(ROOMS.has(host.code),false);
});