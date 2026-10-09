'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const R=require('./rules');
const rooms=new Map();
const MAX_ROUNDS=5;
const rand=n=>crypto.randomInt(n);
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function code(){return Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');}
function assert(ok,msg){if(!ok)throw Error(msg);}
function room(s){const r=rooms.get(String(s||'').toUpperCase());assert(r,'방을 찾지 못했습니다. 새 방을 만드세요.');return r;}
function auth(b){const r=room(b.code),p=r.players.find(p=>p.token===b.token);assert(p,'플레이어 인증이 만료되었습니다.');return [r,p];}
function notify(r){for(const res of [...r.clients]){try{res.write('data: refresh\n\n')}catch{r.clients.delete(res)}}}
function touch(r,msg){if(msg)r.history.push(msg);r.history=r.history.slice(-20);r.updated=Date.now();notify(r);}
function publicState(r,p){
 return {code:r.code,stage:r.stage,round:r.round,maxRounds:MAX_ROUNDS,seat:p.seat,
 isHost:p.token===r.hostToken,
 players:r.players.map(q=>({seat:q.seat,name:q.name,ready:q.ready,count:q.hand.length,chips:q.chips})),
 hand:[...p.hand],turn:r.turn,leader:r.leader,passes:r.passes,
 trick:r.trick?{by:r.trick.by,ids:r.trick.ids,name:r.trick.ev.name}:null,
 history:r.history,results:r.results,winner:r.winner};
}
function begin(r){
 const deck=shuffle(Array.from({length:52},(_,i)=>i));
 r.players.forEach((p,i)=>{p.hand=R.sortTiles(deck.slice(i*13,(i+1)*13));p.ready=false;});
 const p=r.players.find(x=>x.hand.includes((3-1)*4+0));
 r.turn=p.seat;r.leader=p.seat;r.trick=null;r.passes=0;r.round++;r.stage='playing';r.results=null;r.winner=null;
 r.history=[r.players[r.turn].name+'님이 구름 3을 가져 선이 됐습니다.'];
 touch(r);
}
function scoring(r,winner){
 const {effective,delta}=R.calculateScores(r.players.map(p=>p.hand));
 r.players.forEach((p,i)=>p.chips+=delta[i]);
 r.results=r.players.map((p,i)=>({seat:p.seat,name:p.name,left:p.hand.length,twos:p.hand.filter(id=>R.tile(id).n===2).length,effective:effective[i],delta:delta[i],chips:p.chips}));
 r.winner=winner;
 r.stage=(r.round>=MAX_ROUNDS||r.players.some(p=>p.chips<=0))?'matchEnd':'roundEnd';
 touch(r,r.players[winner].name+'님이 패를 모두 내고 '+r.round+'라운드 승리!');
}
function action(b){
 const [r,p]=auth(b),host=()=>assert(p.token===r.hostToken,'방장만 할 수 있어요.');
 const next=i=>(i+1)%4;
 if(b.type==='ready'){
  assert(r.stage==='lobby','대기실에서만 준비할 수 있어요.');p.ready=!!b.ready;touch(r);
 }else if(b.type==='shuffle'){
  host();assert(r.stage==='lobby','게임 시작 전만 자리를 섞을 수 있어요.');
  shuffle(r.players).forEach((q,i)=>q.seat=i);
  r.players.sort((a,b)=>a.seat-b.seat);r.players.forEach(q=>q.ready=false);touch(r,'좌석 순서를 섞었습니다.');
 }else if(b.type==='start'){
  host();assert(r.stage==='lobby'&&r.players.length===4&&r.players.every(p=>p.ready),'네 명 모두 준비해야 시작할 수 있어요.');begin(r);
 }else if(b.type==='nextRound'){
  host();assert(r.stage==='roundEnd','라운드 종료 후에 가능합니다.');begin(r);
 }else if(b.type==='newMatch'){
  host();assert(r.stage==='matchEnd','최종 결과 화면에서 가능합니다.');
  r.stage='lobby';r.round=0;r.trick=null;r.history=[];r.results=null;r.winner=null;
  r.players.forEach(q=>{q.chips=64;q.hand=[];q.ready=false;});touch(r);
 }else if(b.type==='pass'){
  assert(r.stage==='playing'&&p.seat===r.turn,'내 차례에만 패스할 수 있어요.');
  assert(r.trick,'선 플레이어는 패스할 수 없어요.');
  r.passes++;
  if(r.passes>=3){
   const last=r.trick.by;r.turn=last;r.leader=last;r.trick=null;r.passes=0;
   touch(r,p.name+'님 패스 · 모두 패스하여 '+r.players[last].name+'님이 새로 선이 됐습니다.');
  }else{r.turn=next(r.turn);touch(r,p.name+'님이 패스했습니다.');}
 }else if(b.type==='play'){
  assert(r.stage==='playing'&&p.seat===r.turn,'지금은 내 차례가 아니에요.');
  const ids=b.ids;
  assert(Array.isArray(ids)&&ids.length>0&&ids.length<=5&&ids.every(Number.isInteger)&&new Set(ids).size===ids.length,'선택한 타일을 확인해 주세요.');
  assert(ids.every(id=>p.hand.includes(id)),'내 패에 없는 타일은 낼 수 없어요.');
  const ev=R.evaluate(ids);assert(ev,'허용되는 조합이 아니에요. (1·2·3·5장만 가능)');
  if(r.trick){
   assert(ev.size===r.trick.ev.size,'앞사람과 같은 개수로 내야 해요.');
   assert(R.compare(ev,r.trick.ev)>0,'더 높은 족보를 내야 해요.');
  }
  p.hand=p.hand.filter(id=>!ids.includes(id));
  r.trick={by:p.seat,ids:R.sortTiles(ids),ev};r.passes=0;r.leader=p.seat;
  r.turn=next(p.seat);
  touch(r,p.name+'님이 '+ev.name+' '+ids.length+'장을 냈습니다.');
  if(!p.hand.length)scoring(r,p.seat);
 }else if(b.type==='leave'){
  assert(r.stage==='lobby','진행 중에는 나갈 수 없어요.');
  r.players=r.players.filter(q=>q!==p);r.players.forEach((q,i)=>q.seat=i);if(r.hostToken===p.token&&r.players.length)r.hostToken=r.players[0].token;
  if(!r.players.length)rooms.delete(r.code);else touch(r,p.name+'님이 나갔습니다.');
  return {left:true};
 }else assert(false,'잘못된 요청입니다.');
 return publicState(r,p);
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function data(req){
 return new Promise((resolve,reject)=>{let b='',closed=false;
 req.on('data',v=>{b+=v;if(b.length>12000&&!closed){closed=true;reject(Error('요청 데이터가 너무 커요.'));}});
 req.on('end',()=>{if(closed)return;try{resolve(JSON.parse(b||'{}'))}catch{reject(Error('요청 형식이 잘못됐어요.'))}});
 req.on('error',reject);
 });
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,name:'Lexio four player'});
  if(req.method==='POST'&&url.pathname==='/api/create'){
   const b=await data(req),name=String(b.name||'').trim().slice(0,14);
   assert(name,'닉네임을 적어 주세요.');let c=code();while(rooms.has(c))c=code();
   const p={seat:0,name,token:crypto.randomUUID(),ready:false,hand:[],chips:64};
   const r={code:c,players:[p],hostToken:p.token,stage:'lobby',round:0,clients:new Set(),trick:null,history:[],updated:Date.now()};
   rooms.set(c,r);return json(res,200,{code:c,token:p.token,state:publicState(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/join'){
   const b=await data(req),r=room(b.code),name=String(b.name||'').trim().slice(0,14);
   assert(r.stage==='lobby'&&r.players.length<4,'참가할 수 없는 방이에요.');
   assert(name&&!r.players.some(p=>p.name===name),'이미 쓰는 닉네임이거나 이름이 비어 있어요.');
   const p={seat:r.players.length,name,token:crypto.randomUUID(),ready:false,hand:[],chips:64};
   r.players.push(p);touch(r,name+'님이 참가했습니다.');
   return json(res,200,{code:r.code,token:p.token,state:publicState(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/action')return json(res,200,action(await data(req)));
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const [r,p]=auth(Object.fromEntries(url.searchParams));return json(res,200,publicState(r,p));
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   const [r,p]=auth(Object.fromEntries(url.searchParams));
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return json(res,405,{error:'허용하지 않는 요청'});
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.js','style.css'].includes(name))return json(res,404,{error:'찾을 수 없는 경로'});
  const file=path.join(__dirname,'public',name);
  return fs.readFile(file,(err,b)=>{
   if(err)return json(res,404,{error:'파일을 찾지 못했습니다.'});
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(b);
  });
 }catch(e){return json(res,400,{error:e.message||'요청 처리 오류'});}
});
server.listen(process.env.PORT||3000,'0.0.0.0');
