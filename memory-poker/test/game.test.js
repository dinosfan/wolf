'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,cmp,deck,start,snapshot,server}=require('../server');
const card=(n,s)=>({n,s});
test('52 unique shuffled cards',()=>{
 const d=deck();assert.equal(d.length,52);
 assert.equal(new Set(d.map(x=>x.n+x.s)).size,52);
});
test('poker hand strength and wheel straight',()=>{
 const royal=evaluate([card(10,'H'),card(11,'H'),card(12,'H'),card(13,'H'),card(14,'H')]);
 assert.equal(royal.name,'로열 플러시');
 assert.equal(royal.value[0],8);
 const wheel=evaluate([card(14,'H'),card(2,'S'),card(3,'D'),card(4,'C'),card(5,'H')]);
 assert.deepEqual(wheel.value,[4,5]);
 const quads=evaluate([card(9,'S'),card(9,'C'),card(9,'D'),card(9,'H'),card(2,'C')]);
 const full=evaluate([card(13,'S'),card(13,'H'),card(13,'D'),card(2,'D'),card(2,'S')]);
 assert.ok(cmp(quads.value,full.value)>0);
 const twoPair=evaluate([card(7,'H'),card(7,'S'),card(6,'D'),card(6,'C'),card(14,'S')]);
 assert.deepEqual(twoPair.value,[2,7,6,14]);
 const a=evaluate([card(8,'H'),card(8,'S'),card(4,'D'),card(3,'C'),card(2,'S')]);
 const b=evaluate([card(8,'D'),card(8,'C'),card(5,'D'),card(3,'S'),card(2,'H')]);
 assert.ok(cmp(b.value,a.value)>0);
});
test('round timer reveals exactly 16 while memorizing and hides after 20s',()=>{
 const room={code:'TEST01',host:'one',players:[{id:'one',token:'one',score:0,nick:'P1',lastSeen:Date.now()}],round:0,phase:'lobby',choices:{}};
 start(room);
 assert.equal(room.board.length,16);assert.equal(room.community.length,3);
 assert.equal(new Set([...room.board,...room.community].map(c=>c.n+c.s)).size,19);
 assert.equal(snapshot(room,room.players[0]).board.length,16);
 room.endsAt=Date.now()-1;
 const hidden=snapshot(room,room.players[0]);
 assert.equal(hidden.phase,'pick');assert.equal(hidden.board,null);assert.equal(hidden.community.length,3);
});
test('online flow: room, join, 20s, same two positions, tie, rematch',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const realNow=Date.now;
 const base='http://127.0.0.1:'+server.address().port;
 const api=async(route,body,method='POST')=>{
  const u=base+'/api/'+route+(method==='GET'?'?'+new URLSearchParams(body).toString():'');
  const res=await fetch(u,{method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined});
  const obj=await res.json();assert.equal(res.status,200,JSON.stringify(obj));return obj;
 };
 try{
  const p1=await api('create',{nick:'하나'});
  const p2=await api('join',{nick:'둘',code:p1.code});
  await api('start',{code:p1.code,token:p1.token});
  const ownerState=await api('state',{code:p1.code,token:p1.token},'GET');
  assert.notEqual(ownerState.me,p1.token,'public player IDs must not expose secret tokens');
  const before=await api('state',{code:p1.code,token:p2.token},'GET');
  assert.equal(before.phase,'memorize');
  assert.equal(before.board.length,16);
  const deadline=before.endsAt;
  Date.now=()=>deadline+1;
  const hidden=await api('state',{code:p1.code,token:p2.token},'GET');
  assert.equal(hidden.phase,'pick');assert.equal(hidden.board,null);
  await api('pick',{code:p1.code,token:p1.token,positions:[0,1]});
  const pending=await api('state',{code:p1.code,token:p2.token},'GET');
  assert.equal(pending.players.find(p=>p.id===ownerState.me).picked,true);
  await api('pick',{code:p1.code,token:p2.token,positions:[0,1]});
  const end=await api('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(end.phase,'result');assert.equal(end.outcome.winner,null);
  assert.deepEqual(end.players.map(p=>p.score),[0,0]);
  Date.now=realNow;
  await api('start',{code:p1.code,token:p1.token});
  const next=await api('state',{code:p1.code,token:p2.token},'GET');
  assert.equal(next.round,2);assert.equal(next.phase,'memorize');
 }finally{Date.now=realNow;await new Promise(r=>server.close(r));}
});
