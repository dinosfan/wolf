'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,cmp,deck,start,snapshot,updatePhase,server}=require('../server');
const card=(n,s)=>({n,s});
test('shuffled deck contains 52 unique cards',()=>{
 const d=deck();assert.equal(d.length,52);
 assert.equal(new Set(d.map(x=>x.n+x.s)).size,52);
});
test('poker ranking respects wheel, full house and kickers',()=>{
 const royal=evaluate([card(10,'H'),card(11,'H'),card(12,'H'),card(13,'H'),card(14,'H')]);
 assert.equal(royal.name,'로열 플러시');
 const wheel=evaluate([card(14,'H'),card(2,'S'),card(3,'D'),card(4,'C'),card(5,'H')]);
 assert.deepEqual(wheel.value,[4,5]);
 const quads=evaluate([card(9,'S'),card(9,'C'),card(9,'D'),card(9,'H'),card(2,'C')]);
 const full=evaluate([card(13,'S'),card(13,'H'),card(13,'D'),card(2,'D'),card(2,'S')]);
 assert.ok(cmp(quads.value,full.value)>0);
 const a=evaluate([card(8,'H'),card(8,'S'),card(4,'D'),card(3,'C'),card(2,'S')]);
 const b=evaluate([card(8,'D'),card(8,'C'),card(5,'D'),card(3,'S'),card(2,'H')]);
 assert.ok(cmp(b.value,a.value)>0);
});
test('20-second memorization is followed by exactly 10-second hidden selection',()=>{
 const fake={code:'123',host:'p1',players:[{id:'p1',token:'t1',score:0,nick:'A',lastSeen:Date.now()},{id:'p2',token:'t2',score:0,nick:'B',lastSeen:Date.now()}],round:0,phase:'lobby',choices:{}};
 start(fake);
 assert.equal(fake.board.length,16);
 assert.equal(fake.community.length,3);
 assert.equal(new Set([...fake.board,...fake.community].map(x=>x.n+x.s)).size,19);
 const first=snapshot(fake,fake.players[0]);
 assert.equal(first.phase,'memorize');assert.equal(first.board.length,16);
 const oldNow=Date.now;
 try{
  Date.now=()=>fake.endsAt+1;
  const hidden=snapshot(fake,fake.players[0]);
  assert.equal(hidden.phase,'pick');
  assert.equal(hidden.board,null);
  assert.equal(hidden.revealCards,null);
  assert.equal(hidden.endsAt-first.endsAt,10000);
  assert.equal(hidden.community.length,3);
 }finally{Date.now=oldNow;}
});
test('two-player flow: 3-digit codes, hidden picks, reveal, tie, timeout auto-pick',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const clock=Date.now;
 const call=async(route,body={},method='POST',status=200)=>{
  const url=base+'/api/'+route+(method==='GET'?'?'+new URLSearchParams(body).toString():'');
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined});
  const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;
 };
 try {
  const p1=await call('create',{nick:'A'});
  assert.match(p1.code,/^\d{3}$/);
  await call('join',{nick:'B',code:'WRONG'},'POST',400);
  const p2=await call('join',{nick:'B',code:p1.code});
  await call('start',{code:p1.code,token:p1.token});
  const before=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.notEqual(before.me,p1.token);
  assert.equal(before.board.length,16);
  Date.now=()=>before.endsAt+1;
  let pick=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(pick.phase,'pick');
  assert.equal(pick.board,null);
  assert.deepEqual(pick.ownSelection,[]);
  assert.equal(pick.endsAt-before.endsAt,10000);
  await call('select',{code:p1.code,token:p1.token,position:0});
  pick=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.deepEqual(pick.ownSelection,[0]);
  assert.equal(pick.board,null);
  const other=await call('state',{code:p1.code,token:p2.token},'GET');
  assert.deepEqual(other.ownSelection,[]);
  assert.equal(other.revealCards,null);
  await call('select',{code:p1.code,token:p1.token,position:0});
  pick=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.deepEqual(pick.ownSelection,[]);
  await call('select',{code:p1.code,token:p1.token,position:0});
  await call('select',{code:p1.code,token:p1.token,position:1});
  await call('select',{code:p1.code,token:p1.token,position:2},'POST',409);
  await call('select',{code:p1.code,token:p2.token,position:0});
  await call('select',{code:p1.code,token:p2.token,position:1});
  pick=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(pick.phase,'pick','early double selections must not reveal any card');
  assert.deepEqual(pick.players.map(x=>x.score),[0,0]);
  Date.now=()=>pick.endsAt+1;
  const revealed=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(revealed.phase,'reveal');
  assert.equal(revealed.board,null);
  assert.equal(revealed.revealCards.length,2);
  assert.deepEqual(revealed.revealCards.map(x=>x.position).sort(),[0,1]);
  assert.equal(revealed.outcome,null);
  assert.deepEqual(revealed.players.map(x=>x.score),[0,0]);
  await call('select',{code:p1.code,token:p1.token,position:3},'POST',409);
  Date.now=()=>revealed.endsAt+1;
  const result=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(result.phase,'result');
  assert.equal(result.outcome.winner,null);
  assert.deepEqual(result.players.map(x=>x.score),[0,0]);
  Date.now=clock;
  await call('start',{code:p1.code,token:p1.token});
  const again=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(again.round,2);
  Date.now=()=>again.endsAt+1;
  const pick2=await call('state',{code:p1.code,token:p2.token},'GET');
  await call('select',{code:p1.code,token:p1.token,position:4});
  Date.now=()=>pick2.endsAt+1;
  const reveal2=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(reveal2.phase,'reveal');
  assert.ok(reveal2.revealCards.length>=2);
  Date.now=()=>reveal2.endsAt+1;
  const end2=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(end2.phase,'result');
  assert.equal(end2.outcome.players.find(p=>p.id===before.me).autoPositions.length,1);
  assert.equal(end2.outcome.players.find(p=>p.id!==before.me).autoPositions.length,2);
 }finally{Date.now=clock;await new Promise(resolve=>server.close(resolve));}
});
test('first to 3 wins ends match; next start resets scores',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const oldNow=Date.now;
 const call=async(route,body={},method='POST')=>{
  const r=await fetch(base+'/api/'+route+(method==='GET'?'?'+new URLSearchParams(body).toString():''),
   {method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined});
  const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;
 };
 try {
  const p1=await call('create',{nick:'Winner'});
  const p2=await call('join',{nick:'Loser',code:p1.code});
  for(let win=1;win<=3;win++){
   await call('start',{code:p1.code,token:p1.token});
   const before=await call('state',{code:p1.code,token:p1.token},'GET');
   // The public community is revealed at the start of the picking window.
   Date.now=()=>before.endsAt+1;
   const pick=await call('state',{code:p1.code,token:p1.token},'GET');
   const scored=[];
   for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)
    scored.push({positions:[i,j],rank:evaluate([before.board[i],before.board[j],...pick.community]).value});
   scored.sort((a,b)=>cmp(a.rank,b.rank));
   const lo=scored[0],hi=scored[scored.length-1];
   assert.ok(cmp(hi.rank,lo.rank)>0,'there must be a stronger five-card hand');
   for(const i of hi.positions)await call('select',{code:p1.code,token:p1.token,position:i});
   for(const i of lo.positions)await call('select',{code:p1.code,token:p2.token,position:i});
   Date.now=()=>pick.endsAt+1;
   const reveal=await call('state',{code:p1.code,token:p1.token},'GET');
   assert.equal(reveal.phase,'reveal');
   Date.now=()=>reveal.endsAt+1;
   const result=await call('state',{code:p1.code,token:p1.token},'GET');
   assert.equal(result.phase,'result');
   assert.equal(result.outcome.winner,before.me);
   assert.equal(result.players.find(p=>p.id===before.me).score,win);
   assert.equal(!!result.matchWinner,win===3);
   Date.now=oldNow;
  }
  await call('start',{code:p1.code,token:p1.token});
  const reset=await call('state',{code:p1.code,token:p1.token},'GET');
  assert.equal(reset.round,1);
  assert.deepEqual(reset.players.map(x=>x.score),[0,0]);
  assert.equal(reset.matchWinner,null);
 }finally{Date.now=oldNow;await new Promise(resolve=>server.close(resolve));}
});
