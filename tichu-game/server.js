'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const E=require('./engine'),R=require('./rules');
const json=(res,code,x)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(x))};
const read=req=>new Promise((resolve,reject)=>{
 let body='',tooBig=false;req.on('data',c=>{body+=c;if(body.length>35000){tooBig=true;reject(Error('요청이 너무 커.'))}});
 req.on('end',()=>{if(tooBig)return;try{resolve(JSON.parse(body||'{}'))}catch{reject(Error('JSON 형식 오류'))}});req.on('error',reject);
});
const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,service:'Tichu Mobile',rooms:E.rooms.size});
  if(req.method==='POST'&&url.pathname==='/api/create'){
   const b=await read(req);return json(res,200,E.create(String(b.name||''),Number(b.target||1000),!!b.practice));
  }
  if(req.method==='POST'&&url.pathname==='/api/join'){
   const b=await read(req),r=E.find(b.code),name=String(b.name||'').trim().slice(0,14);
   if(r.stage!=='lobby'||r.players.length===4)throw Error('이미 시작했거나 자리가 없는 방이야.');
   if(!name||r.players.some(x=>x.name===name))throw Error('닉네임이 비었거나 중복됐어.');
   const p={name,seat:r.players.length,token:require('node:crypto').randomUUID(),bot:false,ready:false,hand:[],pending:[],trade:null,grand:null,call:null,hasPlayed:false,tricks:[],out:false};
   r.players.push(p);
   for(const stream of [...r.clients])try{stream.write('data: update\n\n')}catch{r.clients.delete(stream)}
   return json(res,200,{code:r.code,token:p.token,state:E.state(r,p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/action')return json(res,200,E.action(await read(req)));
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const [r,p]=E.auth(Object.fromEntries(url.searchParams));return json(res,200,E.state(r,p));
  }
  if(req.method==='POST'&&url.pathname==='/api/options'){
   const b=await read(req),[r,p]=E.auth(b);
   if(r.phase!=='play')return json(res,200,{options:[],wishForced:false,hints:[]});
   const myTurn=r.turn===p.seat,lead=!r.table,valid=Array.isArray(b.cards)?b.cards:[];
   if(new Set(valid).size!==valid.length||valid.some(id=>!p.hand.includes(id)))throw Error('선택한 손패가 잘못됐어.');
   const choices=R.validOptions(valid,r.table,lead).filter(v=>myTurn||!!v.bomb&&!!r.table);
   let options=choices;
   const wishing=r.wish&&p.hand.some(id=>R.card(id).rank===r.wish);
   const legalWishes=myTurn&&wishing?R.combinations(p.hand,r.table,lead,r.wish).filter(x=>x.fulfills):[];
   if(legalWishes.length&&myTurn)options=options.filter(v=>valid.some(id=>R.card(id).rank===r.wish));
   const hints=b.includeHints&&myTurn?R.combinations(p.hand,r.table,lead,r.wish).filter(x=>!legalWishes.length||x.fulfills)
     .sort(R.comparePlay).slice(0,12).map(x=>({cards:x.cards,variant:x.variant})):[];
   return json(res,200,{options,wishForced:legalWishes.length>0,wish:r.wish,hints});
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
   const [r]=E.auth(Object.fromEntries(url.searchParams));
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: ready\n\n');r.clients.add(res);
   const timer=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
   req.on('close',()=>{clearInterval(timer);r.clients.delete(res)});return;
  }
  if(req.method!=='GET')return json(res,405,{error:'허용되지 않은 요청'});
  const file=staticFiles[url.pathname];if(!file)return json(res,404,{error:'페이지가 없어.'});
  fs.readFile(path.join(__dirname,'public',file),(error,bytes)=>{
   if(error)return json(res,404,{error:'파일을 읽을 수 없어.'});
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(bytes);
  });
 }catch(e){json(res,400,{error:e.message||'요청 처리 실패'})}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0');
