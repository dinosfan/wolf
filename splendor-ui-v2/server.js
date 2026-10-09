'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const G=require('./game');
const AI=require('./bot');
const PORT=Number(process.env.PORT||3000);
const DATA_FILE=process.env.DATA_FILE||path.join(__dirname,'rooms.json');
const rooms=new Map();const streams=new Map();const botTimers=new Map();
try{if(fs.existsSync(DATA_FILE)){for(const obj of JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))){if(obj&&obj.code&&Array.isArray(obj.players)&&Date.now()-(obj.updated||0)<7*86400000){obj.players.forEach(p=>delete p.connected);rooms.set(obj.code,obj)}}}}catch(e){console.error('Could not load room save:',e.message)}
function persist(){try{fs.writeFileSync(DATA_FILE,JSON.stringify([...rooms.values()],(key,val)=>key==='connected'?undefined:val))}catch(e){console.error('Save failed:',e.message)}}
function broadcast(s){s.version++;s.updated=Date.now();persist();for(const client of [...(streams.get(s.code)||[])]){try{client.res.write('event: state\ndata: '+JSON.stringify(G.visible(s,client.seat))+'\n\n')}catch(e){(streams.get(s.code)||new Set()).delete(client)}}}
function maybeBotMove(s){
 if(!s?.started||s.winner!==null||!s.players[s.turn]?.isBot||botTimers.has(s.code))return;
 const timer=setTimeout(()=>{
  botTimers.delete(s.code);
  const current=rooms.get(s.code);
  if(!current||!current.started||current.winner!==null||!current.players[current.turn]?.isBot)return;
  const who=current.turn;
  try{
   const copy=JSON.parse(JSON.stringify(current));
   const cmd=AI.chooseAction(copy,who);
   if(!cmd){console.error('Bot has no legal action:',copy.code,copy.phase);return;}
   G.action(copy,who,cmd);
   copy.players.forEach((p,i)=>p.connected=current.players[i].connected);
   rooms.set(copy.code,copy);broadcast(copy);maybeBotMove(copy);
  }catch(e){console.error('Bot move error:',current.code,e.stack||e.message)}
 },780);
 timer.unref();botTimers.set(s.code,timer);
}
function createBotGame(name){
 const token=crypto.randomBytes(24).toString('hex');
 const s=G.newRoom(code(),scrubName(name),token);
 const bot=G.newPlayer('루비 봇 🤖',crypto.randomBytes(24).toString('hex'));
 bot.isBot=true;bot.connected=true;s.players.push(bot);
 G.startGame(s);rooms.set(s.code,s);broadcast(s);maybeBotMove(s);
 return {code:s.code,token,seat:0};
}
function playerOf(s,token){return s.players.findIndex(x=>x.token===token)}
function send(res,code,data){let t=JSON.stringify(data);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(t),'X-Content-Type-Options':'nosniff'});res.end(t)}
function fail(res,e){return send(res,/not found/.test(e.message)?404:400,{error:e.message||'요청에 실패했습니다.'})}
function scrubName(v){return String(v||'').trim().slice(0,16).replace(/[<>]/g,'')||'플레이어'}
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';function code(){let out;do{out=Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('')}while(rooms.has(out));return out}
function credential(req,url,body={}){const c=(body.code||url.searchParams.get('code')||'').toUpperCase(),token=body.token||url.searchParams.get('token');const s=rooms.get(c);if(!s)throw Error('not found: 방 코드를 확인해 주세요.');const seat=playerOf(s,token);if(seat===-1)throw Error('이 방의 플레이어 인증 정보가 없어요.');return {s,seat}}
async function readBody(req){let size=0;let parts=[];for await(const chunk of req){size+=chunk.length;if(size>12000)throw Error('요청이 너무 커요.');parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}')}catch(e){throw Error('잘못된 요청 형식이에요.')}}
function closeRoomStreams(code){for(const c of streams.get(code)||[])try{c.res.end()}catch(e){}streams.delete(code)}
function request(req,res){(async()=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);let pathname=url.pathname;
 if(req.method==='GET'&&pathname==='/api/health')return send(res,200,{status:'ok',rooms:rooms.size});
 if(req.method==='POST'&&pathname==='/api/create'){const b=await readBody(req),token=crypto.randomBytes(24).toString('hex'),s=G.newRoom(code(),scrubName(b.name),token);rooms.set(s.code,s);broadcast(s);return send(res,200,{code:s.code,token,seat:0})}
 if(req.method==='POST'&&pathname==='/api/create-bot'){const b=await readBody(req);return send(res,200,createBotGame(b.name))}
 if(req.method==='POST'&&pathname==='/api/add-bot'){const b=await readBody(req),{s,seat}=credential(req,url,b);if(seat!==0)throw Error('방장만 봇을 추가할 수 있어요.');if(s.started||s.players.length!==1)throw Error('대기 중인 1인 방에서만 봇을 추가할 수 있어요.');const bot=G.newPlayer('루비 봇 🤖',crypto.randomBytes(24).toString('hex'));bot.isBot=true;bot.connected=true;s.players.push(bot);G.startGame(s);broadcast(s);maybeBotMove(s);return send(res,200,{ok:true})}
 if(req.method==='POST'&&pathname==='/api/join'){const b=await readBody(req),s=rooms.get(String(b.code||'').toUpperCase());if(!s)throw Error('not found: 방 코드를 확인해 주세요.');if(s.players.length>=2)throw Error('이미 두 명이 참여한 방이에요.');const token=crypto.randomBytes(24).toString('hex');s.players.push(G.newPlayer(scrubName(b.name),token));broadcast(s);return send(res,200,{code:s.code,token,seat:1})}
 if(req.method==='GET'&&pathname==='/api/state'){const {s,seat}=credential(req,url);return send(res,200,G.visible(s,seat))}
 if(req.method==='GET'&&pathname==='/api/events'){const {s,seat}=credential(req,url);res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 2200\n\n');let connections=streams.get(s.code)||new Set();streams.set(s.code,connections);const client={res,seat};connections.add(client);s.players[seat].connected=true;res.write('event: state\ndata: '+JSON.stringify(G.visible(s,seat))+'\n\n');for(const c of connections)if(c!==client)try{c.res.write('event: state\ndata: '+JSON.stringify(G.visible(s,c.seat))+'\n\n')}catch(e){}const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': ping\n\n')},20000);req.on('close',()=>{clearInterval(heartbeat);connections.delete(client);s.players[seat].connected=[...connections].some(c=>c.seat===seat);for(const c of connections)try{c.res.write('event: state\ndata: '+JSON.stringify(G.visible(s,c.seat))+'\n\n')}catch(e){}});return}
 if(req.method==='POST'&&pathname==='/api/start'){const b=await readBody(req),{s,seat}=credential(req,url,b);if(seat!==0)throw Error('방장만 시작할 수 있어요.');G.startGame(s);broadcast(s);maybeBotMove(s);return send(res,200,{ok:true})}
 if(req.method==='POST'&&pathname==='/api/action'){const b=await readBody(req),{s,seat}=credential(req,url,b);const copy=JSON.parse(JSON.stringify(s));G.action(copy,seat,b.action);copy.players.forEach((p,i)=>p.connected=s.players[i].connected);rooms.set(s.code,copy);broadcast(copy);maybeBotMove(copy);return send(res,200,{ok:true})}
 if(req.method==='POST'&&pathname==='/api/leave'){const b=await readBody(req),{s,seat}=credential(req,url,b);if(s.started)throw Error('진행 중인 게임에서는 나갈 수 없어요.');if(seat===0){rooms.delete(s.code);clearTimeout(botTimers.get(s.code));botTimers.delete(s.code);closeRoomStreams(s.code)}else{s.players.splice(1,1);broadcast(s)}persist();return send(res,200,{ok:true})}
 if(req.method==='GET'){
  if(pathname==='/'||pathname==='/index.html')pathname='/index.html';
  if(/^\/room\/[A-HJ-NP-Z2-9]{6}$/.test(pathname))pathname='/index.html';
  const known={'/index.html':'text/html; charset=utf-8','/client.js':'text/javascript; charset=utf-8','/manifest.json':'application/manifest+json','/icon.svg':'image/svg+xml'};
  if(Object.hasOwn(known,pathname)){const f=path.join(__dirname,'public',pathname);if(!fs.existsSync(f))return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':known[pathname],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(f).pipe(res);return}
 }
 send(res,404,{error:'Not found'});
 })().catch(e=>{if(!res.headersSent)fail(res,e);else try{res.end()}catch(err){}})}
const server=http.createServer(request);if(require.main===module){server.listen(PORT,'0.0.0.0',()=>{console.log('Mobile Duel server on http://localhost:'+PORT);for(const room of rooms.values())maybeBotMove(room)})}
setInterval(()=>{for(const [c,s] of rooms)if(Date.now()-s.updated>7*86400000){rooms.delete(c);clearTimeout(botTimers.get(c));botTimers.delete(c);closeRoomStreams(c)}persist()},3600000).unref();
module.exports={server,rooms};