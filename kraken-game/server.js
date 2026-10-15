'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const G=require('./engine');
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function payload(req){return new Promise((resolve,reject)=>{let s='',large=false;req.on('data',c=>{s+=c;if(s.length>15000&&!large){large=true;reject(Error('요청이 너무 커.'))}});req.on('end',()=>{if(large)return;try{resolve(JSON.parse(s||'{}'))}catch{reject(Error('요청 형식이 잘못됐어.'))}});req.on('error',reject)})}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return reply(res,200,{ok:true,name:'No Touch Kraken',rooms:G.rooms.size});
  if(req.method==='POST'&&url.pathname==='/api/create'){
   const b=await payload(req);return reply(res,200,G.create(String(b.name||'').trim().slice(0,14),Number(b.size),b.practice===true));
  }
  if(req.method==='POST'&&url.pathname==='/api/join'){
   const b=await payload(req),r=G.findRoom(b.code),name=String(b.name||'').trim().slice(0,14);
   if(r.stage!=='lobby'||r.players.length>=r.size)throw Error('입장할 수 없는 방이야.');
   if(!name||r.players.some(p=>p.name===name))throw Error('닉네임이 비었거나 이미 사용 중이야.');
   const p=G.person(name,r.players.length);r.players.push(p);
   for(const c of [...r.clients])try{c.write('data: refresh\n\n')}catch{r.clients.delete(c)}
   return reply(res,200,{code:r.code,token:p.token,state:G.state(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/action')return reply(res,200,G.action(await payload(req)));
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const [r,p]=G.authorization(Object.fromEntries(url.searchParams));return reply(res,200,G.state(r,p));
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   const [r]=G.authorization(Object.fromEntries(url.searchParams));
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return reply(res,405,{error:'허용하지 않는 요청'});
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.js','style.css'].includes(name))return reply(res,404,{error:'없는 페이지야.'});
  fs.readFile(path.join(__dirname,'public',name),(err,buf)=>{
   if(err)return reply(res,404,{error:'파일이 없어.'});
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(buf);
  });
 }catch(e){return reply(res,400,{error:e.message||'서버 오류'})}
});
server.listen(process.env.PORT||3000,'0.0.0.0');
