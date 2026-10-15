'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),G=require('./engine');
function answer(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function parse(req){return new Promise((resolve,reject)=>{let data='',stopped=false;req.on('data',chunk=>{data+=chunk;if(data.length>420000&&!stopped){stopped=true;reject(Error('요청 용량 초과'))}});req.on('end',()=>{if(stopped)return;try{resolve(JSON.parse(data||'{}'))}catch{reject(Error('JSON 요청 오류'))}});req.on('error',reject)})}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/health')return answer(res,200,{ok:true,name:'Monster Witness',rooms:G.rooms.size});
  if(req.method==='POST'&&u.pathname==='/api/create'){
   const b=await parse(req),name=String(b.name||'').trim().slice(0,16);
   return answer(res,200,G.makeRoom(name,Number(b.size),Number(b.cycles||1)));
  }
  if(req.method==='POST'&&u.pathname==='/api/join'){
   const b=await parse(req),r=G.room(b.code),name=String(b.name||'').trim().slice(0,16);
   if(r.phase!=='lobby'||r.players.length>=r.size)throw Error('입장할 수 없는 방이야.');
   if(!name||r.players.some(x=>x.name===name))throw Error('닉네임이 비었거나 중복됐어.');
   const p={seat:r.players.length,name,color:['#5bd6d0','#efae69','#9a9cf8','#df8db9','#8bc879','#6daee6','#e0d279','#d19d80'][r.players.length],
    token:require('node:crypto').randomUUID(),ready:false,score:0,drawing:null,submitted:false,vote:null};
   r.players.push(p);
   for(const c of r.clients)try{c.write('data: refresh\n\n')}catch{}
   return answer(res,200,{code:r.code,token:p.token,state:G.publicState(r,p)});
  }
  if(req.method==='POST'&&u.pathname==='/api/action')return answer(res,200,G.act(await parse(req)));
  if(req.method==='GET'&&u.pathname==='/api/state'){
   const [r,p]=G.auth(Object.fromEntries(u.searchParams));return answer(res,200,G.publicState(r,p));
  }
  if(req.method==='GET'&&u.pathname==='/api/events'){
   const [r]=G.auth(Object.fromEntries(u.searchParams));res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','Cache-Control':'no-cache'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return answer(res,405,{error:'요청 방식 오류'});
  const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(!['index.html','app.js','style.css'].includes(name))return answer(res,404,{error:'없는 페이지야.'});
  fs.readFile(path.join(__dirname,'public',name),(err,data)=>{
   if(err)return answer(res,404,{error:'파일을 찾을 수 없어.'});
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(data);
  });
 }catch(e){return answer(res,400,{error:e.message||'서버 오류'})}
});
server.listen(process.env.PORT||3000,'0.0.0.0');
