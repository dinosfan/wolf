'use strict';
const el=document.getElementById('app'),overlay=document.getElementById('overlay'),toastEl=document.getElementById('toast');
const K='lexio-session-four-v1',params=new URLSearchParams(location.search);
const SUITS=['구름','별','달','해'],SYMS=['☁','★','☾','☀'];
let session=null,state=null,events=null,selected=new Set(),pending=false,toastTimer=null,doubleFirst=null;
let fxRoom=null,lastFxSeq=null,visualFx=[],fxTimer=null,reactionBusy=false,lastReactionSent=0,soundContext=null;
let turnAnnouncementTimer=null;
const SOUND_PREF='lexio-sound-v2',VIBRATE_PREF='lexio-vibrate-v2';
let soundEnabled=false,vibrateEnabled=true;
try{soundEnabled=localStorage.getItem(SOUND_PREF)==='on';vibrateEnabled=localStorage.getItem(VIBRATE_PREF)!=='off'}catch{}
const REACTION_EMOJI=['😂','🔥','😭','⏰','😎','😱'];
try{session=JSON.parse(localStorage.getItem(K)||'null')}catch{localStorage.removeItem(K)}
function html(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function tileInfo(id){return {id,n:Math.floor(id/4)+1,s:id%4}}
function rank(n,maxNum=state?.maxNum||15){return n===2?maxNum-1:n===1?maxNum-2:n-3}
function sortIDs(ids){const maxNum=state?.maxNum||15;return [...ids].sort((a,b)=>rank(tileInfo(a).n,maxNum)-rank(tileInfo(b).n,maxNum)||a%4-b%4)}
function tileView(id,opts={}){
 const t=tileInfo(id),sel=selected.has(id)&&opts.selectable;
 return '<button type="button" class="tile s'+t.s+(opts.short?' short':'')+(sel?' selected':'')+'"'+(opts.selectable?' onclick="toggle('+id+')" aria-pressed="'+!!sel+'"':' disabled')+' aria-label="'+SUITS[t.s]+' '+t.n+'">'+
 '<span class="figure">'+SYMS[t.s]+'</span><span class="digit">'+t.n+'</span><span class="letter">'+SUITS[t.s]+'</span></button>';
}
function toast(msg){toastEl.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.textContent='',3300)}

function liveFx(){
 const now=Date.now();
 return visualFx.filter(e=>e.until>now);
}
function fxForSeat(seat){
 return liveFx().filter(e=>['play','pass','emoji'].includes(e.type)&&
  (e.type==='emoji'&&e.emoji==='⏰'?e.targetSeat===seat:e.seat===seat)).slice(-1)[0]||null;
}
function cleanupEffects(){
 if(fxTimer!==null){clearTimeout(fxTimer);fxTimer=null}
 visualFx=liveFx();
 if(!visualFx.length)return;
 const next=Math.min(...visualFx.map(e=>e.until))-Date.now();
 fxTimer=setTimeout(()=>{fxTimer=null;visualFx=liveFx();render();cleanupEffects()},Math.max(30,next+25));
}
function playSfx(type){
 if(!soundEnabled||typeof window==='undefined'||document.hidden)return;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  if(!soundContext)soundContext=new Audio();
  if(soundContext.state==='suspended')soundContext.resume().catch(()=>{});
  const now=soundContext.currentTime;
  const notes=type==='win'?[630,790,980]:type==='turn'?[740,990]:[type==='pass'?270:540];
  notes.forEach((freq,i)=>{
   const osc=soundContext.createOscillator(),gain=soundContext.createGain(),start=now+i*.075;
   osc.type='sine';osc.frequency.value=freq;
   gain.gain.setValueAtTime(.0001,start);
   gain.gain.exponentialRampToValueAtTime(.065,start+.015);
   gain.gain.exponentialRampToValueAtTime(.0001,start+.16);
   osc.connect(gain);gain.connect(soundContext.destination);
   osc.start(start);osc.stop(start+.17);
  });
 }catch{}
}
function vibrateTurn(){
 if(!vibrateEnabled||document.hidden||typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return;
 try{navigator.vibrate([85,40,100])}catch{}
}
function toggleSound(){
 soundEnabled=!soundEnabled;
 try{localStorage.setItem(SOUND_PREF,soundEnabled?'on':'off')}catch{}
 if(soundEnabled)playSfx('turn');
 render();
}
function toggleVibration(){
 vibrateEnabled=!vibrateEnabled;
 try{localStorage.setItem(VIBRATE_PREF,vibrateEnabled?'on':'off')}catch{}
 if(vibrateEnabled)vibrateTurn();
 render();
}
function clearTurnAnnouncement(){
 const banner=document.getElementById('turnAnnouncement');
 if(turnAnnouncementTimer!==null){clearTimeout(turnAnnouncementTimer);turnAnnouncementTimer=null}
 if(banner){banner.hidden=true;banner.classList.remove('show')}
}
function showTurnAnnouncement(){
 const banner=document.getElementById('turnAnnouncement');
 if(!banner||document.hidden)return;
 clearTurnAnnouncement();
 banner.hidden=false;
 // Force animation restart if turns arrive back-to-back.
 void banner.offsetWidth;
 banner.classList.add('show');
 turnAnnouncementTimer=setTimeout(()=>{banner.hidden=true;banner.classList.remove('show');turnAnnouncementTimer=null},1900);
}
function turnRibbon(){
 if(!state||state.stage!=='playing')return '';
 const mine=state.seat===state.turn;
 return '<div class="turn-ribbon '+(mine?'turn-ribbon-mine':'turn-ribbon-wait')+'" role="status">'+
 (mine?'<span class="turn-ribbon-icon">✨</span><span><strong>지금 내 차례!</strong><small>아래에서 타일을 선택해서 내거나 패스해</small></span><span class="turn-ribbon-arrow">↓</span>':
 '<span class="turn-ribbon-icon">⏳</span><span><strong>'+html(state.players[state.turn].name)+'님 차례</strong><small>잠시 기다려줘</small></span>')+
 '</div>';
}
function applyState(next){
 const previous=state,newRoom=fxRoom!==next.code;
 if(newRoom){
  fxRoom=next.code;lastFxSeq=next.fxSeq??0;visualFx=[];
 }else{
  const incoming=(next.effects||[]).filter(e=>Number.isInteger(e.id)&&e.id>(lastFxSeq??0)&&Date.now()-e.ts<4500).slice(-12);
  lastFxSeq=Math.max(lastFxSeq??0,next.fxSeq??0);
  for(const event of incoming){
   visualFx.push({...event,until:Date.now()+(event.type==='win'?3400:event.type==='emoji'?2700:1800)});
   if(['play','pass','win'].includes(event.type))playSfx(event.type);
   if(event.type==='emoji'&&event.emoji==='⏰'&&event.targetSeat===next.seat){
    try{if(vibrateEnabled&&!document.hidden)navigator.vibrate?.([80,50,80])}catch{}
    playSfx('turn');
   }
  }
  visualFx=liveFx().slice(-16);
 }
 state=next;
 const myTurn=next.stage==='playing'&&next.turn===next.seat;
 const turned=myTurn&&(!previous||previous.code!==next.code||
   previous.stage!=='playing'||previous.round!==next.round||
   previous.turn!==next.turn||previous.seat!==next.seat);
 if(turned){vibrateTurn();playSfx('turn');showTurnAnnouncement()}
 else if(!myTurn)clearTurnAnnouncement();
 render();cleanupEffects();
}
async function sendReaction(emoji){
 if(!session||!state||!['playing','roundEnd','matchEnd'].includes(state.stage)||!REACTION_EMOJI.includes(emoji)||reactionBusy||pending)return;
 if(Date.now()-lastReactionSent<1150)return;
 reactionBusy=true;lastReactionSent=Date.now();
 try{applyState(await request('/api/action',{...session,type:'react',emoji}))}
 catch(e){toast(e.message)}
 finally{reactionBusy=false}
}
function reactionBar(){
 const buttons=REACTION_EMOJI.map(e=>e==='⏰'?
  '<button type="button" class="emoji-quick emoji-hurry" aria-label="빨리 내라고 재촉하기" title="빨리 내!" '+
  ((state.stage!=='playing'||state.turn===state.seat)?'disabled ':'')+
  'onclick="sendReaction(\'⏰\')"><span>⏰</span><small>빨리 내!</small></button>':
  '<button type="button" class="emoji-quick" aria-label="'+e+' 반응 보내기" onclick="sendReaction(\''+e+'\')">'+e+'</button>').join('');
 return '<section class="reaction-bar" aria-label="빠른 이모지 반응"><div class="reaction-top"><span>친구에게 반응 보내기</span><div class="effect-settings">'+
 '<button type="button" class="mini alt" onclick="toggleSound()" aria-label="효과음 '+(soundEnabled?'끄기':'켜기')+'">'+(soundEnabled?'🔊 소리 ON':'🔇 소리 OFF')+'</button>'+
 '<button type="button" class="mini alt" onclick="toggleVibration()" aria-label="진동 '+(vibrateEnabled?'끄기':'켜기')+'">'+(vibrateEnabled?'📳 진동 ON':'📴 진동 OFF')+'</button></div></div>'+
 '<div class="emoji-buttons">'+buttons+'</div></section>';
}
function head(){return '<header class="bar"><div class="brand"><i>✦</i> LEXIO <small>· '+(state?state.size+'인 대전':'3~6인 대전')+'</small></div><div class="header-actions"><button type="button" class="mini ranking-trigger" onclick="showRanking()">🏆 족보표</button><button type="button" class="mini alt" onclick="showRules()">규칙</button></div></header>'}
function popup(markup){overlay.innerHTML='<div class="dialog">'+markup+'<button class="alt full" onclick="closeOverlay()">닫기</button></div>';overlay.hidden=false}
function closeOverlay(){overlay.hidden=true;overlay.innerHTML=''}
function rankTile(n,suit){
 return '<span class="rank-tile s'+suit+'" aria-label="'+SUITS[suit]+' '+n+'"><span class="rank-tile-symbol">'+SYMS[suit]+'</span><span class="rank-tile-num">'+n+'</span></span>';
}
function rankTiles(list){
 return '<div class="rank-tile-row">'+list.map(([n,s])=>rankTile(n,s)).join('')+'</div>';
}
function showRanking(){
 const count=state?.size||4,max=count===3?9:count===4?13:15;
 const examples=[
  {name:'스트레이트 플러시',desc:'같은 문양 + 연속된 숫자 5장',list:[[3,3],[4,3],[5,3],[6,3],[7,3]]},
  {name:'포카드',desc:'같은 숫자 4장 + 다른 숫자 1장',list:[[8,0],[8,1],[8,2],[8,3],[3,0]]},
  {name:'풀하우스',desc:'같은 숫자 3장 + 같은 숫자 2장',list:[[7,0],[7,1],[7,2],[5,0],[5,3]]},
  {name:'플러시',desc:'문양이 같은 타일 5장',list:[[3,2],[4,2],[6,2],[8,2],[9,2]]},
  {name:'스트레이트',desc:'숫자가 연속된 타일 5장',list:[[3,0],[4,1],[5,2],[6,3],[7,0]]}
 ];
 const ranked=examples.map((item,i)=>'<div class="ranking-card">'+
 '<div class="ranking-title"><span class="ranking-position">'+(i+1)+'</span><strong>'+item.name+'</strong><span class="ranking-arrow">'+(i===0?'최강':'↓')+'</span></div>'+
 '<p>'+item.desc+'</p>'+rankTiles(item.list)+'</div>').join('');
 const special=[max-3,max-2,max-1,max,1];
 const note='<section class="ranking-note"><h3>인원별 특수 스트레이트 · '+count+'인'+(count===6?' (확장 규칙)':'')+'</h3>'+
 '<p>강한 순서: ① 1·2·3·4·5　② 2·3·4·5·6　③ '+special.join('·')+'</p>'+
 '<p>최고 숫자는 <b>2 &gt; 1 &gt; '+max+'</b>이며, 같은 숫자면 <b>☀ 해 &gt; ☾ 달 &gt; ★ 별 &gt; ☁ 구름</b> 순서야.</p></section>';
 popup('<div class="ranking-heading"><span class="pill">원작 족보 기준 · '+count+'인용</span><h2>🏆 렉시오 족보표</h2><p>5장 조합은 <b>위에 있을수록 강함!</b></p></div>'+
 '<div class="ranking-rule">앞사람과 <b>같은 장수</b>의 더 강한 족보만 낼 수 있어. 선을 새로 잡으면 자유롭게 1·2·3·5장 중 선택 가능.</div>'+
 '<section class="ranking-group"><h3>5장 메이드 · 강한 순서 ↓</h3>'+ranked+'</section>'+
 '<section class="ranking-other"><h3>1·2·3장 조합</h3>'+
 '<div class="ranking-other-item"><b>싱글 · 1장</b>'+rankTiles([[7,0]])+'</div>'+
 '<div class="ranking-other-item"><b>페어 · 같은 숫자 2장</b>'+rankTiles([[7,0],[7,3]])+'</div>'+
 '<div class="ranking-other-item"><b>트리플 · 같은 숫자 3장</b>'+rankTiles([[7,0],[7,1],[7,2]])+'</div>'+
 '<p>싱글·페어는 숫자가 같으면 문양으로 비교하고, 트리플은 숫자로 비교해. <b>4장만 단독 제출은 불가</b>해.</p></section>'+note);
}
function showRules(){
const msg='<h2>렉시오 룰북 · 3~6인</h2>'+
 '<p>☁ 구름 &lt; ★ 별 &lt; ☾ 달 &lt; ☀ 해. 숫자는 3부터 차례대로 올라가며 1과 2가 가장 강합니다.</p>'+
 '<div class="hint">👥 <b>3인:</b> 1~9 타일 · 12장씩<br>👥 <b>4인:</b> 1~13 타일 · 13장씩<br>👥 <b>5인:</b> 1~15 타일 · 12장씩<br>👥 <b>6인:</b> 1~15 타일 · 10장씩 (하우스룰)</div>'+
 '<ul><li>☁ 구름3을 가진 사람이 첫 선입니다. 구름3을 반드시 낼 필요는 없습니다.</li>'+
 '<li>1장 싱글, 2장 페어, 3장 트리플, 5장 메이드를 낼 수 있습니다. 4장만 제출할 수는 없습니다.</li>'+
 '<li>앞서 낸 패와 <b>같은 장수의 더 강한 족보</b>만 낼 수 있습니다.</li>'+
 '<li>5장 서열: 스트레이트 &lt; 플러시 &lt; 풀하우스 &lt; 포카드 &lt; 스트레이트 플러시.</li>'+
 '<li>특수 스트레이트: 3인 6·7·8·9·1 / 4인 10·11·12·13·1 / 5·6인 12·13·14·15·1. 전체 최강은 1·2·3·4·5, 그다음은 2·3·4·5·6입니다.</li>'+
 '<li>패스해도 이후 턴에 다시 낼 수 있습니다. <b>나를 제외한 모든 사람이 연속 패스</b>하면 마지막에 낸 사람이 다시 선을 잡습니다.</li>'+
 '<li>누군가 패를 모두 내면 즉시 라운드가 종료됩니다. 남아 있는 숫자 2의 개수에 따라 남은 패의 페널티가 2배씩 커집니다.</li>'+
 '<li>모든 플레이어가 상대와 패 차이만큼 칩을 정산합니다. 방장이 대기실에서 3 또는 5라운드를 선택합니다.</li></ul>'+
 '<p class="muted">원작 공식 인원은 3~5명입니다. 6인 모드는 타일 60개를 10개씩 나눠 갖는 비공식 하우스룰입니다.</p>';
popup(msg+(state?.mode==='official'?'<h3>🎴 특수카드 확장 · 규칙 확인판</h3><p>게임 시작 시 특수카드 3장을 받고, 1라운드에 최대 한 장만 사용해요. 공식 효과가 확인된 체인저 9종과 조커 8장으로 플레이하며, 미확인 체인저 1장은 제외됐어요. 행동 카드는 자기 차례에, 점수 카드는 30초 정산 때 사용할 수 있도록 온라인 규칙을 적용했어요. 확장 모드는 3~5인만 지원해요.</p>':'') );
}
async function request(url,body){
 const options=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
 const resp=await fetch(url,options),data=await resp.json();
 if(!resp.ok)throw Error(data.error||'서버 오류');return data;
}
function store(payload){session={code:payload.code,token:payload.token};localStorage.setItem(K,JSON.stringify(session));history.replaceState(null,'','/?room='+payload.code);applyState(payload.state);connect()}
function connect(){if(events)events.close();if(!session)return;events=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));events.onmessage=refresh}
async function refresh(){
 if(!session||pending)return;
 try{
  const s=await request('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
  selected=new Set([...selected].filter(id=>s.hand.includes(id)));applyState(s);
 }catch(e){
  if(/인증|방을 찾지/.test(e.message)){localStorage.removeItem(K);session=null;state=null;fxRoom=null;lastFxSeq=null;visualFx=[];selected.clear();events?.close();history.replaceState(null,'','/');toast('방이 초기화되어 새 방을 만들어야 해요.');render();}
 }
}
async function invoke(type,extras={}){
 if(pending||!session)return;pending=true;
 try{
  const ret=await request('/api/action',{...session,type,...extras});
  if(ret.left){localStorage.removeItem(K);session=null;state=null;fxRoom=null;visualFx=[];lastFxSeq=null;selected.clear();events?.close();history.replaceState(null,'','/');render();}
  else{selected.clear();doubleFirst=null;applyState(ret)}
 }catch(e){toast(e.message)}finally{pending=false}
}
async function create(e){e.preventDefault();if(pending)return;pending=true;try{store(await request('/api/create',{name:document.getElementById('newname').value}))}catch(e){toast(e.message)}finally{pending=false}}
async function practice(){
 if(pending)return;
 pending=true;
 try{
  const name=document.getElementById('newname').value.trim()||'플레이어';
  const size=4; // Quick practice begins with a fixed four-player match.
  store(await request('/api/create',{name,size,practice:true}));
 }catch(e){toast(e.message)}finally{pending=false}
}
async function join(e){e.preventDefault();if(pending)return;pending=true;try{store(await request('/api/join',{name:document.getElementById('joinname').value,code:document.getElementById('joincode').value}))}catch(e){toast(e.message)}finally{pending=false}}
function welcome(){
 return head()+'<section class="intro"><span class="pill">☁ ★ ☾ ☀</span><h1>친구와 한 판,<br>렉시오</h1><p>각자 휴대폰으로 비밀 타일을 받고,<br>정면에서 친구와 심리전을 펼쳐 보세요.</p></section>'+
 '<section class="panel"><h2>새 게임 방 만들기</h2><form onsubmit="create(event)"><label for="newname">내 닉네임</label><input class="field" id="newname" maxlength="14" autocomplete="off" placeholder="이름 입력 (연습은 생략 가능)"><p class="muted">방을 만든 뒤 대기실에서 인원, 기본/공식 확장, 3/5라운드를 설정해요.</p><button class="full" type="submit">친구들과 방 만들기</button><button type="button" class="alt full practice-start" onclick="practice()">🤖 혼자 바로 연습하기</button></form><p class="muted">혼자 연습은 기본판 4인(나 + 봇 3명)으로 시작해요. 6인 모드는 비공식 인원 하우스룰이에요.</p></section>'+
 '<section class="panel"><h2>친구 방에 참가</h2><form onsubmit="join(event)"><label for="joinname">내 닉네임</label><input class="field" id="joinname" maxlength="14" autocomplete="off" placeholder="이름 입력" required><label for="joincode">5자리 방 코드</label><input class="field" id="joincode" maxlength="5" autocomplete="off" placeholder="ABCDE" value="'+html(params.get('room')||'')+'" required><button class="alt full">참가</button></form></section>';
}
function roomSettings(){
 const mode=state.mode||'basic',rounds=state.maxRounds||5;
 const summary='<p class="muted">현재 설정: <b>'+state.size+'명 · '+(mode==='official'?'공식 특수카드 확장':'기본판')+' · '+rounds+'라운드</b></p>';
 const note=mode==='official'?'<p class="setting-warning">ℹ️ 공식에서 효과를 확인한 특수카드 17장을 사용하는 온라인 확인판이에요. 미확인 체인저 1종은 제외했으며, 일부 사용 시간·정산은 온라인 처리 규칙입니다. 3~5인만 지원해요.</p>':'';
 if(!state.isHost)return '<section class="panel"><h2>⚙️ 경기 설정</h2>'+summary+note+'<p class="muted">방장만 설정을 변경할 수 있어요.</p></section>';
 const sizes=[3,4,5,6].map(n=>'<option value="'+n+'"'+(state.size===n?' selected':'')+'>'+n+'명'+(n===6?' · 인원 하우스룰':'')+'</option>').join('');
 return '<section class="panel room-settings"><h2>⚙️ 방장 경기 설정</h2><p class="muted">방 안에서 변경 가능합니다. 설정을 바꾸면 모두 다시 준비해야 해요.</p>'+
 '<div class="room-setting-grid">'+
 '<label for="roomsize">플레이 인원<select class="field" id="roomsize">'+sizes+'</select></label>'+
 '<label for="roommode">게임 규칙<select class="field" id="roommode"><option value="basic"'+(mode==='basic'?' selected':'')+'>기본판</option><option value="official"'+(mode==='official'?' selected':'')+'>공식 특수카드 확장 (17장 확인판)</option></select></label>'+
 '<label for="roomrounds">경기 길이<select class="field" id="roomrounds"><option value="3"'+(rounds===3?' selected':'')+'>3라운드</option><option value="5"'+(rounds===5?' selected':'')+'>5라운드</option></select></label>'+
 '</div><button type="button" class="alt full" onclick="saveRoomSettings()">설정 적용</button>'+summary+note+'</section>';
}
function saveRoomSettings(){
 const size=Number(document.getElementById('roomsize')?.value);
 const mode=document.getElementById('roommode')?.value;
 const maxRounds=Number(document.getElementById('roomrounds')?.value);
 invoke('configure',{size,mode,maxRounds});
}
function lobby(){
 const names=state.players.map((p,i)=>'<div class="person"><h3>'+html(p.name)+(state.seat===p.seat?' (나)':'')+(p.isBot?'<span class="bot-badge">BOT</span>':'')+'</h3><p>자리 '+(i+1)+' · '+(p.ready?'준비 완료 ✅':'준비 대기 ⏳')+'</p>'+(p.isBot&&state.isHost?'<button type="button" class="mini alt bot-remove" onclick="invoke(\'removeBot\',{seat:'+p.seat+'})">봇 제거</button>':'')+'</div>').join('');
 const slots=Array.from({length:state.size-state.players.length},()=>'<div class="person"><h3>빈 자리</h3><p>참가 대기 중</p></div>').join('');
 const bots=state.players.filter(p=>p.isBot).length;
 const canAdd=state.isHost&&state.players.length<state.size;
 const actions=state.isHost?'<div class="bot-controls"><button type="button" class="alt full" onclick="invoke(\'addBot\')" '+(canAdd?'':'disabled')+'>🤖 봇 1명 추가</button><button type="button" class="alt full" onclick="invoke(\'fillBots\')" '+(canAdd?'':'disabled')+'>🤖 빈자리 전부 봇으로 채우기</button></div>':'';
 return head()+'<section class="panel"><span class="pill">대기실 · '+state.players.length+'/'+state.size+'명</span><div class="invite">'+html(state.code)+'</div><button class="alt full" onclick="copyInvite()">친구에게 초대 주소 복사 ↗</button><p class="muted">설정된 '+state.size+'명이 입장한 뒤 모두 준비 버튼을 누르세요. 봇은 자동으로 준비됩니다.</p></section>'+
 roomSettings()+'<h2>참가자 <small>봇 '+bots+'명</small></h2><div class="players" data-size="'+state.size+'">'+names+slots+'</div>'+
 '<section class="panel">'+actions+'<p>나의 자리: '+(state.seat+1)+'번</p><button class="full" onclick="invoke(\'ready\',{ready:'+(!state.players[state.seat].ready)+'})">'+(state.players[state.seat].ready?'준비 취소':'준비 완료')+'</button>'+
 (state.isHost?'<button class="alt full" onclick="invoke(\'shuffle\')">자리 순서 섞기</button><button class="full" '+((state.mode==='basic'||state.size<=5)&&state.players.length===state.size&&state.players.every(p=>p.ready)?'':'disabled')+' onclick="invoke(\'start\')">게임 시작하기</button>':'<p class="muted">방장이 게임을 시작합니다.</p>')+
 '<button class="danger full" onclick="leaveRoom()">방 나가기</button></section>';
}
function playersList(){
 return '<div class="players" data-size="'+state.size+'">'+state.players.map(p=>{
  const fx=fxForSeat(p.seat);
  const mark=fx?(fx.type==='emoji'&&fx.emoji==='⏰'?'<span class="fx-bubble fx-emoji fx-hurry" aria-label="빨리 내! 재촉 반응">⏰ 빨리 내!</span>':
   fx.type==='emoji'?'<span class="fx-bubble fx-emoji" aria-label="이모지 반응">'+html(fx.emoji)+'</span>':
   fx.type==='pass'?'<span class="fx-bubble fx-pass">PASS</span>':
   '<span class="fx-bubble fx-play">냈다!</span>'):'';
  return '<div class="person'+(p.seat===state.turn&&state.stage==='playing'?' active':'')+(fx?' fx-active':'')+'">'+mark+
   '<span class="count">'+p.count+'장</span><h3>'+html(p.name)+(p.seat===state.seat?' · 나':'')+
   (p.isBot?' <span class="bot-badge">BOT</span>':'')+'</h3>'+
   '<p>💰 <span class="bal">'+p.chips+'</span>점'+(p.seat===state.turn&&state.stage==='playing'?' · <b>현재 차례</b>':'')+'</p></div>';
 }).join('')+'</div>';
}
function center(){
 const tr=state.trick;
 const incoming=tr&&liveFx().some(e=>e.type==='play'&&e.seat===tr.by&&
  (e.ids||[]).length===tr.ids.length&&[...e.ids].sort((a,b)=>a-b).join(',')===[...tr.ids].sort((a,b)=>a-b).join(','));
 const mine=state.stage==='playing'&&state.turn===state.seat;
 return '<section class="tabletop'+(mine?' my-turn':'')+'"><div class="status">'+
 (state.stage==='playing'?(mine?'<strong>✨ 내 차례!</strong>':'🎲 <strong>'+html(state.players[state.turn].name)+'</strong>의 차례')+
 (state.players[state.turn].isBot?' <span class="bot-thinking">생각 중…</span>':''):'라운드 종료')+'</div>'+
 (tr?'<h2>현재 족보 · '+html(tr.name)+' ('+tr.ids.length+'장)</h2><div class="tiles'+(incoming?' fx-tiles':'')+'">'+
 tr.ids.map(id=>tileView(id,{short:true})).join('')+'</div><small>'+html(state.players[tr.by].name)+
 '님이 낸 타일'+(tr.joker?' · 🃏 '+html(tr.joker.name)+' 사용':'')+' · 연속 패스 '+state.passes+'/'+(state.size-1)+'</small>':
 '<h2>🟡 새 선 플레이어가 자유롭게 냅니다</h2><div class="tiles"><span class="pill">싱글 · 페어 · 트리플 · 메이드</span></div>')+'</section>';
}
function hand(){
 const mine=state.stage==='playing'&&state.turn===state.seat;
 return '<section class="panel"><div class="hand-title"><h2>내 패 <small>'+state.hand.length+'장</small></h2><span class="pill '+(mine?'mine':'')+'">'+(mine?'내 차례 · 타일 선택':'내 차례 대기')+'</span></div>'+
 '<div class="hand">'+sortIDs(state.hand).map(id=>tileView(id,{selectable:mine})).join('')+'</div>'+
 '<p class="picked">선택 '+selected.size+'장 '+(selected.size? ' · '+[...selected].map(id=>{let t=tileInfo(id);return SYMS[t.s]+t.n}).join(' '):'')+'</p>'+
 '<p class="muted">같은 장수로 더 강한 패만 낼 수 있어요. 패스해도 이후에 다시 낼 수 있어요.</p></section>';
}

function specialButtons(){
 if(state.mode!=='official'||state.stage!=='playing')return '';
 const mine=state.turn===state.seat,canUse=mine&&!state.usedSpecial&&!state.fairGame;
 const cards=state.specialCards||[];
 const body=cards.length?cards.map(c=>'<button type="button" class="special-card"'+(!canUse||c.kind==='score'?' disabled':'')+
   ' onclick="openSpecial(\''+c.id+'\')" title="'+html(c.desc)+'">'+
   '<strong>'+(c.kind==='joker'?'🃏':'✨')+' '+html(c.name)+'</strong><small>'+html(c.desc)+'</small></button>').join(''):
   '<p class="muted">남은 특수카드가 없어요.</p>';
 return '<section class="panel special-panel"><div class="hand-title"><h2>🎴 특수카드 <small>'+cards.length+'장</small></h2><span class="pill">'+
  (state.usedSpecial?'이번 라운드 사용 완료':state.fairGame?'공정한 게임 적용 중':'라운드당 1장')+'</span></div>'+
  '<div class="special-grid">'+body+'</div>'+
  '<p class="muted">점수 관련 카드는 라운드 종료 시에만 사용해요. 경기 시작 시 특수카드 3장을 받고, 사용하지 않은 카드는 다음 라운드에도 가지고 가요.</p></section>';
}
function openSpecial(id){
 if(!state||state.stage!=='playing'||state.turn!==state.seat)return;
 const card=(state.specialCards||[]).find(c=>c.id===id);
 if(!card||state.usedSpecial||state.fairGame)return;
 if(card.kind==='score')return toast('라운드 점수 정산 때만 사용할 수 있어요.');
 if(card.kind==='joker'){
  const limit=state.size===3?5:state.size===4?6:7;
  const opts=Array.from({length:limit-2},(_,i)=>'<option value="'+(i+3)+'">'+(i+3)+'</option>').join('');
  return popup('<h2>🃏 '+html(card.name)+'</h2><p>현재 선택한 타일과 지정한 조커 타일을 함께 냅니다.</p>'+
   '<p class="muted">먼저 내 패에서 타일을 선택하고 이 카드를 누르세요. 조커만 1장 낼 수도 있어요.</p>'+
   '<label>대체할 숫자<select class="field" id="specialNumber">'+opts+'</select></label>'+
   '<button class="full" onclick="useJoker(\''+id+'\')">조커 포함 제출</button>');
 }
 if(id==='double'){
  doubleFirst=[];selected.clear();render();toast('첫 번째 족보를 선택하고 [첫 족보 확정]을 눌러 주세요.');return;
 }
 if(id==='fair')return invoke('useSpecial',{card:id});
 const targets=state.players.filter(p=>p.seat!==state.seat).map(p=>'<option value="'+p.seat+'">'+html(p.name)+'</option>').join('');
 const tiles=sortIDs(state.hand).map(n=>'<option value="'+n+'">'+SYMS[n%4]+' '+tileInfo(n).n+'</option>').join('');
 const needsTarget=['gift','barter','skip'].includes(id),needsTile=['gift','barter'].includes(id),needsNumber=id==='mortal';
 const choices=(needsTarget?'<label>상대<select class="field" id="specialTarget">'+targets+'</select></label>':'')+
  (needsTile?'<label>보낼 타일<select class="field" id="specialTile">'+tiles+'</select></label>':'')+
  (needsNumber?'<label>일괄 제거할 숫자<select class="field" id="specialNumber">'+Array.from({length:state.maxNum},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('')+'</select></label>':'');
 popup('<h2>'+html(card.name)+'</h2><p>'+html(card.desc)+'</p>'+choices+
   '<button class="full" onclick="confirmSpecial(\''+id+'\')">특수카드 사용</button>');
}
function confirmSpecial(id){
 const target=document.getElementById('specialTarget')?.value;
 const tile=document.getElementById('specialTile')?.value;
 const number=document.getElementById('specialNumber')?.value;
 const payload={card:id};
 if(target!==undefined)payload.target=Number(target);
 if(tile!==undefined)payload.tile=Number(tile);
 if(number!==undefined)payload.number=Number(number);
 closeOverlay();invoke('useSpecial',payload);
}
function useJoker(id){
 const number=Number(document.getElementById('specialNumber')?.value);
 closeOverlay();invoke('play',{ids:[...selected],jokerCard:id,jokerNum:number});
}

function doubleActions(){
 if(doubleFirst===null||state.stage!=='playing')return '';
 return '<section class="panel"><h2>✨ 더블샷: 두 족보 제출</h2>'+
 (doubleFirst.length?'<p>첫 번째 '+doubleFirst.length+'장 확정. 더 강한 두 번째 족보를 선택하세요.</p>':'<p>첫 번째 족보를 선택한 뒤 확정하세요.</p>')+
 (doubleFirst.length?'<button class="full" onclick="submitDouble()" '+(selected.size!==doubleFirst.length?'disabled':'')+'>두 족보 내기</button>':
 '<button class="full" onclick="captureDouble()" '+(![1,2,3,5].includes(selected.size)?'disabled':'')+'>첫 족보 확정</button>')+
 '<button class="alt full" onclick="cancelDouble()">취소</button></section>';
}
function captureDouble(){if(![1,2,3,5].includes(selected.size))return;doubleFirst=[...selected];selected.clear();render()}
function submitDouble(){if(!doubleFirst||selected.size!==doubleFirst.length)return;invoke('useSpecial',{card:'double',ids:doubleFirst,extraIds:[...selected]})}
function cancelDouble(){doubleFirst=null;selected.clear();render()}

function settlementScreen(){
 const st=state.settlement||{},done=st.done?.[state.seat],seconds=Math.max(0,Math.ceil(((st.deadline||Date.now())-Date.now())/1000));
 const maxLeft=Math.max(...state.players.map(p=>p.count));
 const cards=(state.specialCards||[]).filter(c=>c.kind==='score'&&!state.usedSpecial&&!state.fairGame);
 const allowed=cards.filter(c=>['winner','underdog'].includes(c.id)?
   state.winner===state.seat:(c.id==='silver'&&state.players[state.seat].count===maxLeft&&maxLeft>0));
 const special=allowed.length?allowed.map(c=>'<button type="button" class="special-card"'+(done?' disabled':'')+
 ' onclick="invoke(\'settleCard\',{card:\''+c.id+'\'})"><strong>✨ '+html(c.name)+'</strong><small>'+html(c.desc)+'</small></button>').join(''):'<p class="muted">사용 가능한 정산용 특수카드가 없어요.</p>';
 return head()+'<section class="panel special-panel"><span class="pill">정산 대기</span>'+
 '<h1>🏁 '+html(state.players[state.winner].name)+'님 라운드 승리!</h1>'+
 '<p>정산용 특수카드를 사용하거나 정산 확정을 누르세요. 모두 확정하거나 30초가 지나면 자동 정산됩니다.</p>'+
 '<p class="muted">약 '+seconds+'초 남음 · '+(st.done||[]).filter(Boolean).length+'/'+state.size+'명 확정</p>'+
 '<div class="special-grid">'+special+'</div>'+
 (done?'<p class="success">내 선택 확정 · 다른 참가자를 기다리는 중</p>':
 '<button class="full" onclick="invoke(\'settlePass\')">특수카드 없이 정산 확정</button>')+
 '</section>'+playersList();
}

function controls(){
 if(state.stage!=='playing')return'';
 const mine=state.turn===state.seat;
 return '<div class="controls">'+
 '<button class="alt" onclick="invoke(\'pass\')" '+(!mine||!state.trick||pending||doubleFirst!==null?'disabled':'')+'>패스</button>'+
 '<button onclick="play()" '+(!mine||![1,2,3,5].includes(selected.size)||pending||doubleFirst!==null?'disabled':'')+'>선택한 '+selected.size+'장 내기 →</button></div>';
}
function historyList(){
 return '<details class="panel"><summary class="strong">진행 기록 보기</summary><ol class="recent">'+state.history.slice(-14).reverse().map(h=>'<li>'+html(h)+'</li>').join('')+'</ol></details>';
}
function play(){const ids=[...selected];if(![1,2,3,5].includes(ids.length))return toast('1, 2, 3, 5장만 낼 수 있어요.');invoke('play',{ids})}
function toggle(id){if(!state||state.stage!=='playing'||state.turn!==state.seat)return;
 if(selected.has(id))selected.delete(id);else if(selected.size>=5){toast('한 번에 최대 5장까지 선택하세요.');return}else selected.add(id);render();
}
function result(){
 const isEnd=state.stage==='matchEnd';
 const winningFx=liveFx().some(e=>e.type==='win'&&e.seat===state.winner);
 const celebration=winningFx?'<div class="win-celebration" aria-hidden="true">'+Array.from({length:16},(_,i)=>'<span style="--offset:'+(i-8)*19+'px;--drop:'+(108+i*7)+'px;--delay:'+(i*38)+'ms">✦</span>').join('')+'</div>':'';
 const summary=state.results||[];
 const sorted=[...summary].sort((a,b)=>b.chips-a.chips);
 return head()+celebration+'<div class="panel"><span class="pill">'+state.round+' / '+state.maxRounds+' 라운드 완료</span><h1>🎉 '+html(state.players[state.winner].name)+'님 승리!</h1><p>남은 타일과 숫자 2의 페널티를 반영해서 칩을 정산했어요.</p>'+
 '<div class="summary">'+summary.map(p=>'<div class="sum"><b>'+html(p.name)+(p.seat===state.seat?' · 나':'')+(state.players[p.seat].isBot?' 🤖':'')+'</b><p class="muted">잔여 '+p.left+'장'+(p.twos?' · 2 ×'+p.twos:'')+'<br>환산 '+p.effective+'장</p><p class="'+(p.delta<0?'neg':'pos')+'">'+(p.delta>0?'+':'')+p.delta+'점</p><p><strong>누적 '+p.chips+'점</strong></p></div>').join('')+'</div>'+
 (isEnd?'<h2 style="margin-top:18px">🏆 최종 순위</h2><ol class="recent">'+sorted.map(p=>'<li>'+html(p.name)+' · '+p.chips+'점</li>').join('')+'</ol><p class="success">최종 우승: '+html(sorted[0]?.name)+'님!</p>'+
 (state.isHost?'<button class="full" onclick="invoke(\'newMatch\')">새 경기 시작</button>':'<p class="muted">방장이 다음 경기를 준비할 수 있어요.</p>'):
 (state.isHost?'<button class="full" onclick="invoke(\'nextRound\')">다음 라운드 · '+(state.round+1)+' / '+state.maxRounds+'</button>':'<p class="muted">방장이 다음 라운드를 시작하면 새 패가 배분됩니다.</p>'))+'</div>'+
 '<details class="panel"><summary>정산 기준과 규칙</summary><p class="muted">각자 남은 타일 수에 남은 숫자 2 하나당 ×2를 적용하고, 다른 모든 플레이어와 비교한 차이만큼 칩을 주고받습니다. '+state.maxRounds+'라운드 또는 파산 시 경기가 끝납니다.</p></details>'+reactionBar();
}
function render(){el.innerHTML='<div class="wrap'+(state?.stage==='playing'&&state.turn===state.seat?' its-my-turn':'')+'">'+(!state?welcome():state.stage==='lobby'?lobby():state.stage==='settlement'?settlementScreen():state.stage==='playing'?head()+'<div class="menu"><span class="pill">'+state.round+' / '+state.maxRounds+' 라운드</span><span class="pill">'+state.size+'인 · '+(state.mode==='official'?'공식 확장':'기본')+' · 방 '+html(state.code)+'</span><button class="mini alt" onclick="copyInvite()">초대</button></div>'+playersList()+center()+reactionBar()+hand()+specialButtons()+doubleActions()+controls()+historyList():result())+'</div>'}
async function copyInvite(){if(!state)return;const url=location.origin+'/?room='+state.code;try{await navigator.clipboard.writeText(url);toast('초대 주소를 복사했어요.')}catch{prompt('초대 주소를 복사하세요.',url)}}
function leaveRoom(){if(confirm('정말 방을 나갈까요?'))invoke('leave')}
async function boot(){if(session){await refresh();if(session)connect()}else render();}
boot();setInterval(()=>{if(session&&!document.hidden)refresh()},8000);document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)refresh();
 else clearTurnAnnouncement();
});
