'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const G=require('./engine');
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
function readBody(req){return new Promise((ok,fail)=>{let s='',stopped=false;req.on('data',c=>{s+=c;if(s.length>16000&&!stopped){stopped=true;fail(Error('요청이 너무 커.'))}});req.on('end',()=>{if(stopped)return;try{ok(JSON.parse(s||'{}'))}catch{fail(Error('요청을 해석할 수 없어.'))}});req.on('error',fail)})}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,name:'Deep Sea Friends',rooms:G.rooms.size});
  if(req.method==='POST'&&url.pathname==='/api/create'){
   const b=await readBody(req);return json(res,200,G.newRoom(String(b.name||'').trim().slice(0,16),Number(b.size),b.practice===true));
  }
  if(req.method==='POST'&&url.pathname==='/api/join'){
   const b=await readBody(req),r=G.lookup(b.code),name=String(b.name||'').trim().slice(0,16);
   if(r.stage!=='lobby'||r.players.length>=r.size)throw Error('참가 가능한 방이 아니야.');
   if(!name||r.players.some(p=>p.name===name))throw Error('닉네임이 비었거나 중복됐어.');
   const p=G.player(name,r.players.length);r.players.push(p);
   // Notify lobby members over SSE.
   for(const c of r.clients)try{c.write('data: refresh\n\n')}catch{}
   return json(res,200,{code:r.code,token:p.token,state:G.publicState(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/action')return json(res,200,G.action(await readBody(req)));
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const [r,p]=G.auth(Object.fromEntries(url.searchParams));return json(res,200,G.publicState(r,p));
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   const [r]=G.auth(Object.fromEntries(url.searchParams));
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return json(res,405,{error:'지원하지 않는 요청'});
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.js','style.css'].includes(name))return json(res,404,{error:'없는 페이지야.'});
  fs.readFile(path.join(__dirname,'public',name),(err,buffer)=>{
   if(err)return json(res,404,{error:'파일이 없어.'});
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(buffer);
  });
 }catch(e){return json(res,400,{error:e.message||'서버 오류'})}
});
server.listen(process.env.PORT||3000,'0.0.0.0');
