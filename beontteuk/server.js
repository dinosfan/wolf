'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOMS = new Map();
const BOT_TURN_MS = 850;
const BOT_VS_BOT_MS = 1200;
const BOT_VS_HUMAN_MS = 9000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOPICS = `과일|채소|동물|반려동물 이름|새 종류|곤충|물고기|바다생물|공룡|상상의 동물|꽃 이름|나무 종류|한국 도시|외국 도시|나라 이름|섬 이름|산 이름|강 이름|해변|관광지|놀이공원|교통수단|자동차 브랜드|지하철역|학교 과목|대학교 전공|직업|운동 종목|구기 종목|올림픽 종목|운동선수|야구 포지션|축구 포지션|게임 제목|비디오게임 캐릭터|보드게임|카드게임|애니메이션|애니메이션 캐릭터|웹툰 제목|만화 주인공|드라마 제목|영화 제목|공포 영화|영화 속 악당|슈퍼히어로|가수|아이돌 그룹|노래 제목|악기|음악 장르|댄스 종류|유튜브 콘텐츠|유튜버|배우|개그맨|예능 프로그램|TV 프로그램|음식|한식 메뉴|중식 메뉴|일식 메뉴|양식 메뉴|분식 메뉴|길거리 음식|배달 음식|라면 종류|과자 이름|아이스크림|디저트|빵 종류|커피 메뉴|차 종류|음료수|칵테일 이름|음식 재료|향신료|편의점 상품|마트에서 파는 것|냉장고 속 물건|욕실 물건|주방 도구|책상 위 물건|필기구|전자기기|휴대폰 앱|컴퓨터 부품|가전제품|가구|옷 종류|신발 종류|패션 브랜드|모자 종류|장신구|색깔|도형|숫자와 관련된 말|두 글자 단어|세 글자 단어|의성어|의태어|감정|성격|칭찬하는 말|사과할 때 하는 말|명절|기념일|계절|날씨|비 오는 날 필요한 것|여행 준비물|캠핑 준비물|운동 기구|취미 활동|악기 연주자|책 제목|동화 속 인물|역사 인물|신화 속 인물|과학자|과학 용어|우주 천체|행성|별자리|실험 도구|화학 원소|수학 용어|신체 부위|병원에서 보는 것|약국에서 파는 것|안전 장비|직장 용어|회사 직급|가게 종류|서비스 직업|공공시설|건물 종류|방 안에 있는 것|학교에 있는 것|도서관에 있는 것|체육관에 있는 것|공원에 있는 것|길에서 보는 것|공항에서 보는 것|기차역에서 보는 것|결혼식에 있는 것|생일파티에 필요한 것|축제 이름|선물 아이디어|데이트 장소|첫인사 표현|별명|친구와 할 수 있는 것|주말에 하는 일|밤에 하는 일|아침에 하는 일|잠들기 전 하는 일|무서운 것|웃긴 상황|짜증나는 상황|행복한 순간|실수하기 쉬운 일|늦었을 때 하는 말|시험에서 쓰는 말|인터넷 유행어|줄임말|한국어 속담|사자성어|외래어|알파벳으로 시작하는 말|끝말잇기 단어|탈것 소리|동물 울음소리|집안일|청소 도구|세탁할 것|냄새나는 것|차가운 것|뜨거운 것|둥근 것|부드러운 것|날카로운 것|투명한 것|엄청 작은 것|아주 큰 것|빨간 물건|파란 물건|노란 물건|초록 물건|검은 물건|하얀 물건|선물받고 싶은 것|선물받기 싫은 것|여행지에서 할 일|바다에서 할 일|눈 오는 날 할 일|친구와 내기할 것|식당에서 주문할 것|노래방 인기곡|도시락 반찬|야식 메뉴|치킨 브랜드|피자 토핑|햄버거 재료|초밥 종류|과일 주스|축구팀|야구팀|게임 장르|반려동물 장난감|목욕 용품|공부할 때 필요한 것`.split('|');
const ICONS = ['◆','●','▲','■','★','✦','⬟','✚','♥','⬢'];
const COLORS = ['#ffbb54','#8de4d6','#f78fb4','#8ea6ff','#d2a6ff','#f7e38e','#ff9c7c','#87d4ff','#eaa7bf','#b0e987'];
const now = () => Date.now();
function shuffle(a) { for(let i=a.length-1;i>0;i--) {let j=crypto.randomInt(i+1); [a[i],a[j]]=[a[j],a[i]];} return a; }
function id(n=12) { return crypto.randomBytes(n).toString('hex'); }
function roomCode() { let s; do { s=Array.from({length:5},()=>ALPHABET[crypto.randomInt(ALPHABET.length)]).join(''); } while(ROOMS.has(s)); return s; }
function cleanName(n) { if(typeof n !== 'string') return ''; return n.trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 14); }
function makeBot(room) {
  let n=1;while(room.players.some(p=>p.name===`번뜩봇 ${n}`)) n++;
  return {id:id(8),token:id(16),name:`번뜩봇 ${n}`,isBot:true,ready:true,online:true,score:0,playPile:[],listeners:new Set()};
}
function makeDeck(count, seats) {
  const nSyms = seats === 3 ? 6 : seats >= 7 ? 10 : 8;
  const categories=[];
  while(categories.length<count) categories.push(...shuffle([...TOPICS]));
  const symbolPool=[];
  for(let i=0;i<count;i++) symbolPool.push(i % nSyms);
  shuffle(symbolPool);
  const cards = Array.from({length:count},(_,i)=>({id:id(5),kind:'normal',symbol:symbolPool[i],topic:categories[i]}));
  const nWild = Math.max(5,Math.round(count/12));
  for(let i=0;i<nWild;i++) {
    const a = crypto.randomInt(nSyms); const b = (a+1+crypto.randomInt(nSyms-1))%nSyms;
    cards.push({id:id(5),kind:'wild',symbols:[a,b]});
  }
  return shuffle(cards);
}
function publicRoom(room, playerId) {
  const me = room.players.find(x=>x.id===playerId);
  return {
    code:room.code, phase:room.phase, hostId:room.hostId, meId:playerId,
    players: room.players.map(p=>({id:p.id,name:p.name,isBot:!!p.isBot,ready:p.ready,online:p.online,score:p.score,top:p.playPile.at(-1) || null, pileCount:p.playPile.length})),
    settings:room.settings, deckLeft:room.deck.length, turnPlayerId:room.players[room.turnIndex]?.id || null,
    wild:room.wild, duel:room.duel,
    lastEvent:room.lastEvent, version:room.version, symbols:ICONS.map((mark,i)=>({mark,color:COLORS[i]})),
    winners:room.winners || [], own:me?{name:me.name,ready:me.ready,host:room.hostId===playerId}:null
  };
}
function isMatch(a,b,wild) {
  return a.symbol===b.symbol || !!(wild && ((wild.symbols[0]===a.symbol && wild.symbols[1]===b.symbol)||(wild.symbols[1]===a.symbol && wild.symbols[0]===b.symbol)));
}
function detectDuel(room) {
  const arr=[];
  for(let i=0;i<room.players.length;i++) for(let j=i+1;j<room.players.length;j++) {
    const a=room.players[i], b=room.players[j];
    if(a.playPile.length && b.playPile.length && isMatch(a.playPile.at(-1),b.playPile.at(-1),room.wild)) {
      arr.push({aId:a.id,bId:b.id,reason:a.playPile.at(-1).symbol===b.playPile.at(-1).symbol?'same':'wild'});
    }
  }
  if(arr.length===0) return null;
  // 신규 카드 공개 또는 카드가 제거된 플레이어가 포함된 대결 우선.
  const selected=arr.find(d=>d.aId===room.anchor || d.bId===room.anchor) || arr[0];
  return {...selected, index:room.duelCounter++, startedAt:now()};
}
function advance(room) {
  room.duel=detectDuel(room);
  if(room.duel) {room.phase='duel'; room.lastEvent='대결 발생! 상대 카드 주제에 맞는 단어를 외치세요.'; return;}
  if(room.deck.length===0) {
    room.phase='finished';
    const best=Math.max(...room.players.map(p=>p.score));
    room.winners=room.players.filter(p=>p.score===best).map(p=>p.id);
    room.lastEvent='게임 종료!';
  } else {room.phase='playing';}
}
function notify(room) {
  room.version++; room.updatedAt=now();
  for(const p of room.players) for(const res of p.listeners) {
    try {res.write('data: '+JSON.stringify(publicRoom(room,p.id))+'\n\n');} catch {p.listeners.delete(res);}
  }
}
function refreshOnline(room) {
  let changed=false;
  for(const p of room.players) {
    if(p.isBot) continue;
    const online=p.listeners.size>0;
    if(online!==p.online){p.online=online; changed=true; if(!online) p.offlineAt=now();}
  }
  if(room.hostId && room.phase!=='finished') {
    const host=room.players.find(p=>p.id===room.hostId);
    if(host && !host.online && now()-(host.offlineAt||now())>30000) {
      const substitute=room.players.find(p=>!p.isBot && p.online && p.id!==room.hostId);
      if(substitute){room.hostId=substitute.id; room.lastEvent=`방장이 ${substitute.name}님으로 변경됐어요.`;changed=true;}
    }
  }
  if(changed) notify(room);
}
function error(status,message){const e=new Error(message); e.status=status; throw e;}
function getAuthorized(body) {
  const code=String(body.code||'').trim().toUpperCase();const room=ROOMS.get(code);
  if(!room) error(404,'존재하지 않는 방이에요.');
  const me=room.players.find(p=>p.id===body.playerId && p.token===body.token);
  if(!me)error(403,'입장 정보가 유효하지 않아요.');
  return {room,me};
}
function hostOnly(room,me){if(room.hostId!==me.id) error(403,'방장만 할 수 있어요.');}
function handle(action,body={}) {
  if(action==='create') {
    const name=cleanName(body.name);if(!name) error(400,'닉네임을 입력해 주세요.');
    const seats=Number(body.seats), count=Number(body.cards);
    if(!Number.isInteger(seats)||seats<3||seats>8)error(400,'인원은 3~8명만 지원해요.');
    if(![60,96,120].includes(count))error(400,'카드 수가 올바르지 않아요.');
    const p={id:id(8),token:id(16),name,ready:true,online:false,offlineAt:now(),score:0,playPile:[],listeners:new Set()};
    const room={code:roomCode(),settings:{seats,cards:count},players:[p],hostId:p.id,phase:'lobby',deck:[],wild:null,duel:null,duelCounter:1,turnIndex:0,anchor:null,winners:[],lastEvent:'방을 만들었어요.',version:0,updatedAt:now()};
    ROOMS.set(room.code,room);
    return {code:room.code,playerId:p.id,token:p.token};
  }
  if(action==='join') {
    const code=String(body.code||'').trim().toUpperCase(); const room=ROOMS.get(code);
    if(!room)error(404,'방 코드를 확인해 주세요.');
    if(room.phase!=='lobby')error(409,'이미 게임이 시작된 방이에요.');
    if(room.players.length>=room.settings.seats)error(409,'방이 가득 찼어요.');
    const name=cleanName(body.name); if(!name)error(400,'닉네임을 입력해 주세요.');
    if(room.players.some(p=>p.name===name))error(409,'다른 닉네임을 사용해 주세요.');
    const p={id:id(8),token:id(16),name,ready:false,online:false,offlineAt:now(),score:0,playPile:[],listeners:new Set()};
    room.players.push(p);room.lastEvent=`${name}님이 입장했어요.`;notify(room);
    return {code:room.code,playerId:p.id,token:p.token};
  }
  const {room,me}=getAuthorized(body);
  if(action==='state') return publicRoom(room,me.id);
  if(action==='leave') {
    if(room.phase!=='lobby'&&room.phase!=='finished') error(409,'게임 진행 중에는 나갈 수 없어요. 새로고침하면 복귀할 수 있어요.');
    room.players=room.players.filter(p=>p.id!==me.id);
    for(const listener of me.listeners){try{listener.end();}catch{}}
    me.listeners.clear();
    if(!room.players.some(p=>!p.isBot)){if(room.botTimer)clearTimeout(room.botTimer);ROOMS.delete(room.code);return {ok:true};}
    if(room.hostId===me.id) {const next=room.players.find(p=>!p.isBot);room.hostId=next.id;next.ready=true;}
    room.lastEvent=`${me.name}님이 방을 나갔어요.`;notify(room);return {ok:true};
  }
  if(action==='addBot') {
    hostOnly(room,me);if(room.phase!=='lobby')error(409,'대기실에서만 봇을 추가할 수 있어요.');
    const count=Number(body.count ?? 1);
    if(!Number.isInteger(count)||count<1||count>2)error(400,'봇은 한 번에 1~2명만 추가할 수 있어요.');
    if(room.players.length+count>room.settings.seats)error(409,'남은 자리가 부족해요. 인원 제한을 늘려 주세요.');
    for(let i=0;i<count;i++)room.players.push(makeBot(room));
    room.lastEvent=`연습용 봇 ${count}명이 들어왔어요.`;notify(room);return {ok:true};
  }
  if(action==='removeBot') {
    hostOnly(room,me);if(room.phase!=='lobby')error(409,'대기실에서만 봇을 뺄 수 있어요.');
    const bot=room.players.find(p=>p.id===body.botId && p.isBot);
    if(!bot)error(404,'해당 봇이 없어요.');
    room.players=room.players.filter(p=>p!==bot);
    room.lastEvent=`${bot.name}을 제거했어요.`;notify(room);return {ok:true};
  }
  if(action==='ready') {
    if(room.phase!=='lobby')error(409,'대기실에서만 변경할 수 있어요.');
    if(me.id===room.hostId)error(409,'방장은 자동 준비 상태예요.');
    me.ready=!me.ready;notify(room);return {ok:true};
  }
  if(action==='settings') {
    hostOnly(room,me);if(room.phase!=='lobby')error(409,'게임이 시작됐어요.');
    const seats=Number(body.seats), count=Number(body.cards);
    if(!Number.isInteger(seats)||seats<room.players.length||seats>8||seats<3)error(400,'인원 설정을 확인해 주세요.');
    if(![60,96,120].includes(count))error(400,'카드 수를 확인해 주세요.');
    room.settings={seats,cards:count};notify(room);return {ok:true};
  }
  if(action==='start') {
    hostOnly(room,me);
    if(!['lobby','finished'].includes(room.phase))error(409,'진행 중인 게임이에요.');
    if(room.players.length<3)error(409,'3명 이상 입장해야 해요.');
    if(!room.players.every(p=>p.ready))error(409,'모든 참가자가 준비해야 해요.');
    if(!room.players.every(p=>p.isBot||p.online))error(409,'모든 참가자가 연결되어 있어야 해요.');
    room.deck=makeDeck(room.settings.cards,room.players.length);room.wild=null;room.turnIndex=0;
    room.players.forEach(p=>{p.playPile=[];p.score=0;});
    room.winners=[];room.duel=null;room.duelCounter=1;room.anchor=null;room.phase='playing';
    room.lastEvent='게임 시작! 첫 번째 플레이어가 카드를 공개해 주세요.';commit(room);return {ok:true};
  }
  if(action==='draw') {
    if(room.phase!=='playing')error(409,'지금은 카드를 공개할 수 없어요.');
    if(room.players[room.turnIndex].id!==me.id)error(403,'내 차례가 아니에요.');
    drawCard(room,me);return {ok:true};
  }
  if(action==='resolve') {
    hostOnly(room,me);
    if(room.phase!=='duel'||!room.duel)error(409,'진행 중인 대결이 없어요.');
    if(Number(body.duelIndex)!==room.duel.index)error(409,'이미 처리된 대결이에요.');
    resolveDuel(room,String(body.winnerId));return {ok:true};
  }
  if(action==='restart') {
    hostOnly(room,me);
    if(room.phase!=='finished')error(409,'게임 종료 후에 재대결할 수 있어요.');
    room.phase='lobby';room.deck=[];room.duel=null;room.wild=null;room.winners=[];
    room.players.forEach(p=>{p.ready=p.isBot||p.id===room.hostId;p.score=0;p.playPile=[];});
    room.lastEvent='재대결 대기실로 돌아왔어요.';commit(room);return {ok:true};
  }
  error(404,'알 수 없는 기능이에요.');
}
// 봇은 서버가 차례와 가상 반응 시간을 처리한다. 실제 음성 인식 기능은 아니다.
function drawCard(room,player) {
  if(room.phase!=='playing'||room.players[room.turnIndex]!==player) error(409,'지금은 이 참가자의 차례가 아니에요.');
  const card=room.deck.pop();if(!card)error(409,'남은 카드가 없어요.');
  room.anchor=player.id;
  if(card.kind==='wild') {
    room.wild=card;
    room.lastEvent='와일드카드 등장! 새로운 기호 조합을 확인하세요.';
  } else {
    player.playPile.push(card);room.turnIndex=(room.turnIndex+1)%room.players.length;
    room.lastEvent=`${player.name}님이 새 카드를 공개했어요.`;
  }
  advance(room);commit(room);
}
function resolveDuel(room,winnerId) {
  if(room.phase!=='duel'||!room.duel)error(409,'진행 중인 대결이 없어요.');
  const d=room.duel;
  if(![d.aId,d.bId].includes(winnerId))error(400,'대결 참가자를 선택해 주세요.');
  const loserId=winnerId===d.aId?d.bId:d.aId;
  const winner=room.players.find(p=>p.id===winnerId),loser=room.players.find(p=>p.id===loserId);
  const taken=loser.playPile.pop();if(!taken)error(409,'카드가 없어요.');
  winner.score++;room.anchor=loserId;room.duel=null;
  advance(room);
  const summary=`${winner.name}님이 ${loser.name}님의 카드 1장을 획득했어요.`;
  room.lastEvent=room.phase==='duel'?`${summary} 연쇄 대결!`:room.phase==='finished'?`${summary} 게임 종료!`:summary;
  commit(room);
}
function scheduleBot(room) {
  if(room.botTimer) {clearTimeout(room.botTimer);room.botTimer=null;}
  if(ROOMS.get(room.code)!==room)return;
  let fn,delay;
  if(room.phase==='playing') {
    const player=room.players[room.turnIndex];
    if(!player?.isBot)return;
    delay=BOT_TURN_MS;
    fn=()=>{if(room.phase==='playing'&&room.players[room.turnIndex]===player)drawCard(room,player);};
  } else if(room.phase==='duel'&&room.duel) {
    const duel=room.duel;
    const a=room.players.find(p=>p.id===duel.aId),b=room.players.find(p=>p.id===duel.bId);
    if(!a?.isBot&&!b?.isBot)return; // 사람끼리는 방장이 현장 판정
    delay=a.isBot&&b.isBot?BOT_VS_BOT_MS:BOT_VS_HUMAN_MS;
    fn=()=>{if(room.phase!=='duel'||room.duel?.index!==duel.index)return;
      const winner=a.isBot&&b.isBot?(crypto.randomInt(2)?a:b):(a.isBot?a:b);
      resolveDuel(room,winner.id);
    };
  } else return;
  room.botTimer=setTimeout(()=>{
    room.botTimer=null;
    if(ROOMS.get(room.code)!==room)return;
    fn();
  },delay);
  room.botTimer.unref?.();
}
function commit(room){notify(room);scheduleBot(room);}
function sendJSON(res,status,obj) {res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));}
function createApp() {
  return http.createServer(async (req,res)=>{
    try {
      const u=new URL(req.url,'http://localhost');
      if(req.method==='GET' && u.pathname==='/api/events') {
        const body={code:u.searchParams.get('code'),playerId:u.searchParams.get('playerId'),token:u.searchParams.get('token')};
        const {room,me}=getAuthorized(body);
        res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no','access-control-allow-origin':'same-origin'});
        res.write('retry: 1500\n\n'); me.listeners.add(res); refreshOnline(room);
        res.write('data: '+JSON.stringify(publicRoom(room,me.id))+'\n\n');
        req.on('close',()=>{me.listeners.delete(res);refreshOnline(room);});return;
      }
      if(req.method==='POST' && u.pathname.startsWith('/api/')) {
        let buf='';for await(const c of req){buf+=c.toString(); if(buf.length>12000) error(413,'요청이 너무 커요.');}
        let body;try {body=JSON.parse(buf||'{}');}catch{error(400,'잘못된 요청이에요.');}
        sendJSON(res,200,handle(u.pathname.slice(5),body));return;
      }
      if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/index.html')) {
        const file=path.join(__dirname,'public','index.html');res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'});fs.createReadStream(file).pipe(res);return;
      }
      if(req.method==='GET' && u.pathname==='/health') {sendJSON(res,200,{ok:true,rooms:ROOMS.size});return;}
      sendJSON(res,404,{error:'페이지를 찾을 수 없어요.'});
    }catch(e){if(!res.headersSent)sendJSON(res,e.status||500,{error:e.status?e.message:'서버 오류가 발생했어요.'});}
  });
}
if(require.main===module){const server=createApp().listen(PORT,()=>console.log(`번뜩! http://localhost:${server.address().port}`));
  const ticker=setInterval(()=>{
    const t=now();for(const [code,room] of ROOMS){if(t-room.updatedAt>1000*60*60*6){if(room.botTimer)clearTimeout(room.botTimer);for(const p of room.players)for(const res of p.listeners)res.end();ROOMS.delete(code);continue;}
      for(const p of room.players)for(const res of p.listeners){try{res.write(': ping\n\n');}catch{p.listeners.delete(res);}}
      refreshOnline(room);
    }
  },10000); ticker.unref();}
module.exports={createApp,handle,ROOMS,makeDeck,isMatch,detectDuel,TOPICS,drawCard,resolveDuel,scheduleBot};