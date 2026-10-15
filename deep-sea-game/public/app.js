'use strict';
const app=document.getElementById('app'),overlay=document.getElementById('overlay'),toastEl=document.getElementById('toast');
const K='deep-sea-mobile-session-v1',qp=new URLSearchParams(location.search);
const icons=['','▲','■','⬟','⬢'];
let session=null,state=null,source=null,busy=false,selectedBundle=null,toastTimer=0,lastTurnKey='',lastPhaseKey='';
try{session=JSON.parse(localStorage.getItem(K)||'null')}catch{localStorage.removeItem(K)}
if(session&&qp.get('room')&&qp.get('room')!==session.code)session=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(x){toastEl.textContent=x;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.textContent='',3400)}
function header(){return '<header class="head"><div class="logo"><span>🌊</span><div><strong>심해 탐험단</strong><small>DEEP SEA FRIENDS</small></div></div>'+
 '<button class="help" onclick="rules()">규칙 보기 <span>↗</span></button></header>'}
function rules(){
 const text='<h2>🤿 심해 탐험단 · 규칙</h2><p>2~6명이 총 3번 잠수해 보물을 가장 많이 가져온 사람이 승리해!</p>'+
 '<ol><li><b>산소:</b> 내 턴 시작에 지금 들고 있는 보물 묶음 수만큼 공용 산소 25에서 감소</li>'+
 '<li><b>방향:</b> 잠수하거나 귀환. 보물을 하나 이상 들었을 때만 귀환 가능. 돌아서면 다시 잠수할 수 없어</li>'+
 '<li><b>이동:</b> 1~3 주사위 두 개의 합에서 보물 묶음 수를 빼. 다른 잠수부의 칸은 건너뛰어</li>'+
 '<li><b>보물:</b> 도착한 칸에서 줍기, 빈칸에 내려놓기, 그대로 두기 중 하나 선택. 점수는 귀환 후 공개</li>'+
 '<li><b>귀환:</b> 산소가 0이 된 플레이어는 그 턴까지 마치고 잠수가 종료돼. 미귀환자는 보물을 전부 잃어</li>'+
 '<li><b>다음 라운드:</b> 놓친 보물은 심해 끝에 최대 3개씩 묶여 남아. 이 묶음은 1개분 페널티만 받아</li>'+
 '<li><b>승리:</b> 3라운드 종료 후 점수 합산. 동점이면 고급 보물 많은 쪽이 우선</li></ol>'+
 '<p class="muted">원작 기본 규칙 기반의 친구용 버전. 실패 보물 쌓기는 자동 순서이고, 아무도 귀환하지 않으면 다음 사람부터 선공하는 하우스룰이 적용돼.</p>';
 overlay.innerHTML='<div class="dialog">'+text+'<button class="primary full" onclick="closeRules()">확인</button></div>';overlay.hidden=false;
}
function closeRules(){overlay.hidden=true}
async function request(url,data){
 const response=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const val=await response.json();if(!response.ok)throw Error(val.error||'서버 오류');return val;
}
function save(result){session={code:result.code,token:result.token};localStorage.setItem(K,JSON.stringify(session));history.replaceState(null,'','/?room='+result.code);renderState(result.state);connect()}
function connect(){source?.close();if(!session)return;source=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));source.onmessage=refresh;source.onerror=()=>{}}
async function refresh(){
 if(!session||busy)return;
 try{const data=await request('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));renderState(data)}
 catch(e){if(/방을 찾지|참가|인증/.test(e.message)){localStorage.removeItem(K);session=null;state=null;source?.close();history.replaceState(null,'','/');render();toast('방이 초기화됐어. 새 방을 만들어줘.')}}
}
function renderState(next){
 const old=state,turnKey=next.code+':'+next.round+':'+next.turnNumber+':'+next.turn+':'+next.phase;
 const toMe=next.stage==='playing'&&next.turn===next.seat&&next.phase==='choose';
 if(toMe&&old&&old.code===next.code&&lastTurnKey!==turnKey&&old.turn!==next.turn&&navigator.vibrate)try{navigator.vibrate([85,40,85])}catch{}
 lastTurnKey=turnKey;state=next;
 if(selectedBundle&&!next.carry.some(x=>x.id===selectedBundle))selectedBundle=null;
 render();
}
async function create(event){event.preventDefault();if(busy)return;
 const size=Number(document.getElementById('size').value),name=document.getElementById('name').value.trim()||'탐험가';
 await startRoom({size,name});
}
async function practice(){if(busy)return;const size=Number(document.getElementById('size').value),name=document.getElementById('name').value.trim()||'나';
 await startRoom({size,name,practice:true})}
async function startRoom(data){busy=true;try{save(await request('/api/create',data))}catch(e){toast(e.message)}finally{busy=false}}
async function join(event){event.preventDefault();if(busy)return;busy=true;
 try{const code=document.getElementById('code').value.trim().toUpperCase(),name=document.getElementById('joinName').value.trim();save(await request('/api/join',{code,name}))}
 catch(e){toast(e.message)}finally{busy=false}
}
async function act(type,extra={}){
 if(!session||busy)return;busy=true;
 try{const response=await request('/api/action',{...session,type,...extra});if(response.left){localStorage.removeItem(K);session=null;state=null;source?.close();history.replaceState(null,'','/');render()}else renderState(response)}
 catch(e){toast(e.message)}finally{busy=false}
}
function badge(n,extra=''){return '<span class="pill '+extra+'">'+n+'</span>'}
function welcome(){
 return header()+'<section class="hero"><div class="glow">🫧</div><div class="scuba">🤿</div><span class="eyebrow">A GAME OF GREED & OXYGEN</span>'+
 '<h1>깊이 내려갈수록<br><em>욕심이 커진다.</em></h1><p>보물은 탐나고 산소는 하나뿐!<br>친구들과 함께 잠수하고 누가 살아 돌아올지 겨뤄봐.</p>'+
 '<div class="hero-stats">'+badge('👥 2~6명')+badge('🌊 3라운드')+badge('⏱ 20~30분')+'</div></section>'+
 '<section class="panel"><h2>🛟 새 탐험 시작</h2><form onsubmit="create(event)"><label for="name">내 닉네임</label><input id="name" maxlength="16" placeholder="예: 잠수왕" autocomplete="off">'+
 '<label for="size">플레이 인원</label><select id="size">'+[2,3,4,5,6].map(n=>'<option value="'+n+'" '+(n===4?'selected':'')+'>'+n+'명</option>').join('')+'</select>'+
 '<button class="primary full">친구들과 방 만들기 →</button><button type="button" class="secondary full" onclick="practice()">🤖 혼자 연습하기 (나머지는 봇)</button></form></section>'+
 '<section class="panel"><h2>🔗 친구 방 참가</h2><form onsubmit="join(event)"><label for="joinName">닉네임</label><input id="joinName" maxlength="16" placeholder="닉네임" required>'+
 '<label for="code">5자리 방 코드</label><input id="code" maxlength="5" value="'+esc(qp.get('room')||'')+'" placeholder="ABCDE" autocomplete="off" required>'+
 '<button class="secondary full">입장하기</button></form></section>';
}
function roomPanel(){
 const players=state.players,empty=Array.from({length:state.size-players.length},(_,i)=>'<div class="seat empty"><div class="avatar">?</div><strong>빈자리 '+(players.length+i+1)+'</strong><small>참가 대기</small></div>').join('');
 const everyoneReady=players.length===state.size&&players.every(p=>p.ready);
 return header()+'<section class="panel lobby-head">'+badge('대기실 · '+players.length+'/'+state.size+'명')+'<h1>탐험 준비 중</h1><div class="room-code">'+esc(state.code)+'</div><p>친구에게 아래 주소를 공유하고 모두 준비하면 시작할 수 있어.</p>'+
 '<button class="secondary full" onclick="copyLink()">🔗 초대 링크 복사</button></section>'+
 '<section class="panel"><h2>탐험대원</h2><div class="seats">'+players.map(p=>'<div class="seat"><div class="avatar" style="--color:'+p.color+'">'+(p.bot?'🤖':'🤿')+'</div><strong>'+esc(p.name)+(p.seat===state.seat?' · 나':'')+'</strong><small>'+(p.ready?'✅ 준비 완료':'⏳ 준비 중')+'</small>'+
 (p.bot&&state.isHost?'<button class="small secondary" onclick="act(\'removeBot\',{seat:'+p.seat+'})">제거</button>':'')+'</div>').join('')+empty+'</div></section>'+
 '<section class="panel">'+(state.isHost?'<div class="row buttons"><button class="secondary" onclick="act(\'addBot\')">🤖 봇 추가</button><button class="secondary" onclick="act(\'fillBots\')">🤖 빈자리 채우기</button></div>':'')+
 '<button class="primary full" onclick="act(\'ready\',{ready:'+(!players[state.seat].ready)+'})">'+(players[state.seat].ready?'준비 취소':'✅ 준비 완료')+'</button>'+
 (state.isHost?'<button class="primary full start-btn" '+(everyoneReady?'':'disabled')+' onclick="act(\'start\')">🚢 잠수 시작!</button>':'<p class="muted center">방장이 잠수를 시작하면 자동으로 이동해.</p>')+
 '<button class="text-button full" onclick="leaveRoom()">방 나가기</button></section>';
}
function playerTiles(){
 return '<div class="crew">'+state.players.map(p=>
 '<div class="crew-item '+(p.seat===state.turn&&state.stage==='playing'?'current ':'')+(p.home?'returned':'')+'">'+
 '<div class="crew-avatar" style="--color:'+p.color+'">'+(p.bot?'🤖':'🤿')+'</div>'+
 '<div class="crew-text"><strong>'+esc(p.name)+(p.seat===state.seat?' (나)':'')+'</strong><small>'+(p.home?'🚢 귀환 성공':p.dir==='up'?'↗ 귀환 중':'↘ 잠수 중')+'</small></div>'+
 '<div class="crew-right"><strong>'+p.carrying+'개</strong><small>보물 묶음</small></div></div>').join('')+'</div>';
}
function mapView(){
 const occupied={};state.players.forEach(p=>{if(!p.home&&p.pos>0){(occupied[p.pos]??=[]).push(p)}});
 const onBoat=state.players.filter(p=>p.home||p.pos===0).map(p=>'<span class="mini-diver" style="--color:'+p.color+'" title="'+esc(p.name)+'">●</span>').join('');
 return '<section class="map-panel"><div class="map-head"><strong>🗺 해저 탐험 지도</strong><span>보물 '+state.tiles.filter(x=>!x.blank).length+' / '+state.tiles.length+'칸</span></div>'+
 '<div class="submarine">🚢 <b>잠수함</b><div class="boat-crew">'+onBoat+'</div></div>'+
 '<div class="sea-map">'+state.tiles.map(c=>{
 const divers=occupied[c.index]||[];
 return '<div class="sea-cell l'+c.level+(c.blank?' blank':'')+(divers.some(p=>p.seat===state.seat)?' mine':'')+'" title="'+c.index+'번 칸">'+
 '<span class="cell-no">'+c.index+'</span><span class="gem-icon">'+(c.blank?'·':icons[c.level])+'</span>'+
 (c.stacked?'<span class="stack">'+c.count+'</span>':'')+
 (divers.length?'<span class="divers">'+divers.map(p=>'<i style="--color:'+p.color+'" title="'+esc(p.name)+'">🤿</i>').join('')+'</span>':'')+'</div>';
 }).join('')+'</div><p class="depth-note">↓ 깊은 바다일수록 비싼 보물이 나와</p></section>';
}
function stageControls(){
 if(state.stage!=='playing')return'';
 const my=state.turn===state.seat;
 const p=state.players[state.seat];
 if(!my)return '<section class="action-panel"><div class="thinking"><span class="pulse">●</span> '+esc(state.players[state.turn].name)+'님의 차례야<br><small>다른 잠수부의 움직임을 지켜봐!</small></div></section>';
 let actions='';
 if(state.phase==='choose'){
  actions='<div class="direction-options"><button class="primary" onclick="act(\'direction\',{direction:\'down\'})" '+(p.dir==='up'?'disabled':'')+'><span>⬇</span> 더 깊이 잠수</button>'+
  '<button class="secondary" onclick="act(\'direction\',{direction:\'up\'})" '+(!p.carrying&&p.dir!=='up'?'disabled':'')+'><span>⬆</span> '+(p.dir==='up'?'귀환 계속':'잠수함으로 귀환')+'</button></div>'+
  '<p class="action-help">보물 1묶음 이상 있어야 되돌아올 수 있어. 귀환을 시작하면 번복 불가!</p>';
 }else if(state.phase==='roll'){
  actions='<div class="roll-block"><p>방향 선택 완료 · <b>'+(p.dir==='up'?'↗ 귀환':'↘ 하강')+'</b></p>'+
  '<button class="primary full dice-btn" onclick="act(\'roll\')">🎲 주사위 굴리기!</button>'+
  '<small>1~3 주사위 2개 · 보물 '+p.carrying+'개만큼 이동 감소</small></div>';
 }else if(state.phase==='loot'){
  const spot=state.tiles[p.pos-1];
  actions='<div class="move-result"><span>🎲 '+(state.lastDice?.join(' + ')||'')+'</span> <b>→ '+state.steps+'칸 이동</b></div>'+
  '<div class="direction-options"><button class="primary" '+(!spot||spot.blank?'disabled':'')+' onclick="act(\'take\')">💎 보물 줍기'+(spot?.stacked?' ×'+spot.count:'')+'</button>'+
  '<button class="secondary" onclick="dropMenu()" '+(!spot||!spot.blank||!p.carrying?'disabled':'')+'>📦 보물 내려놓기</button></div>'+
  '<button class="quiet full" onclick="act(\'skip\')">이 칸에서 아무것도 안 하기 →</button>';
 }
 return '<section class="action-panel my-action"><div class="action-head"><strong>✨ 내 차례 · '+(state.phase==='choose'?'방향 선택':state.phase==='roll'?'주사위': '보물 행동')+'</strong>'+
 '<span>📦 운반 '+p.carrying+'묶음</span></div>'+actions+'</section>';
}
function dashboard(){
 const active=state.players[state.turn],pct=Math.max(0,state.oxygen)/25*100;
 return header()+'<section class="status-panel">'+
 '<div class="status-meta">'+badge('🌊 '+state.round+' / 3 라운드')+badge('방 '+esc(state.code))+'<button onclick="copyLink()" class="icon-button" aria-label="초대 링크 복사">↗</button></div>'+
 '<div class="air-head"><div><small>SHARED OXYGEN</small><h2>공용 산소</h2></div><div class="air-number '+(state.oxygen<=7?'danger':'')+'">'+state.oxygen+'<span> / 25</span></div></div>'+
 '<div class="oxygen"><div class="oxygen-fill '+(state.oxygen<=7?'low':'')+'" style="width:'+pct+'%"></div></div>'+
 (state.endAfterTurn?'<p class="danger-alert">🚨 산소 고갈! 이번 턴을 마치면 잠수가 종료돼.</p>':'')+
 '<p class="turn-text">'+(state.turn===state.seat?'⭐ <b>내 차례!</b>': '🎲 현재 턴 · <b>'+esc(active.name)+'</b>')+'</p></section>'+
 playerTiles()+mapView()+
 '<section class="inventory"><h3>🎒 내가 들고 있는 보물</h3><div class="item-list">'+
 (state.carry.length?state.carry.map(b=>'<span class="item l'+b.level+'">'+icons[b.level]+' '+(b.count>1?'묶음 '+b.count+'개':'보물 1개')+'</span>').join(''):'<span class="muted">아직 주운 보물이 없어.</span>')+'</div>'+
 '<p class="muted">획득한 보물 점수는 라운드가 끝나면 공개돼. 보물 묶음은 한 개분의 산소·이동 페널티만 적용!</p></section>'+
 stageControls()+historyPanel();
}
function historyPanel(){return '<details class="panel history"><summary>📜 최근 진행 기록</summary><ol>'+[...state.history].slice(-13).reverse().map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></details>'}
function results(){
 const end=state.stage==='matchEnd',sorted=end?state.ranking:[...state.results].sort((a,b)=>b.score-a.score);
 const champion=end&&sorted.length?sorted[0]:null;
 return header()+'<section class="results-hero"><div class="trophy">'+(end?'🏆':'🚢')+'</div>'+
 '<span class="eyebrow">'+(end?'ALL DIVES COMPLETE':'DIVE COMPLETE')+'</span>'+
 '<h1>'+(end?'최종 결과!':state.round+'라운드 종료!')+'</h1>'+
 '<p>'+(end?esc(champion?.name)+'님이 가장 많은 보물을 가져왔어!':'안전하게 돌아온 보물들의 점수가 공개됐어.')+'</p></section>'+
 '<section class="panel"><h2>💰 '+(end?'최종 순위':'점수 정산')+'</h2><div class="result-list">'+sorted.map((p,i)=>
 '<div class="result-player"><span class="place">'+(i+1)+'</span><span class="result-name">'+esc(p.name)+(p.seat===state.seat?' · 나':'')+'</span>'+
 '<div class="result-score"><strong>'+p.score+'점</strong><small>'+(end?'누적 점수':'이번 +'+p.points+'점')+'</small></div></div>').join('')+'</div></section>'+
 '<section class="panel"><h3>💎 안전하게 확보한 내 보물</h3><div class="treasure-values">'+(state.bank.length?
 state.bank.map(c=>'<span class="value-chip l'+c.level+'">'+icons[c.level]+' '+c.value+'</span>').join(''):'<span class="muted">아직 점수가 없어.</span>')+'</div></section>'+
 (state.isHost?'<button class="primary full next-btn" onclick="act(\''+(end?'newMatch':'nextRound')+'\')">'+(end?'새 게임 시작':'🌊 '+(state.round+1)+'라운드 출발')+' →</button>':
 '<div class="waiting">방장이 '+(end?'새 게임을 만들':'다음 라운드를 시작할')+' 때까지 잠시 기다려줘.</div>')+
 historyPanel();
}
function dropMenu(){
 if(!state?.carry.length)return;
 overlay.innerHTML='<div class="dialog"><h2>📦 내려놓을 보물 선택</h2><p>빈칸에 보물 묶음 하나를 놓을 수 있어.</p>'+
 state.carry.map(c=>'<button class="secondary full" onclick="closeRules();act(\'drop\',{bundle:\''+esc(c.id)+'\'})">'+icons[c.level]+' '+(c.count>1?'묶음 '+c.count+'개':'보물 1개')+' 내려놓기</button>').join('')+
 '<button class="quiet full" onclick="closeRules()">취소</button></div>';overlay.hidden=false;
}
function render(){
 const y=window.scrollY||0;
 app.innerHTML='<div class="wrap">'+(!state?welcome():state.stage==='lobby'?roomPanel():state.stage==='playing'?dashboard():results())+
 '<footer>DEEP SEA FRIENDS · 친구들과 함께하는 심해 보물 탐험</footer></div>';
 if(state)window.scrollTo(0,y);
}
async function copyLink(){
 if(!state)return;const url=location.origin+'/?room='+state.code;
 try{await navigator.clipboard.writeText(url);toast('🔗 초대 링크 복사 완료!')}catch{prompt('아래 링크 복사',url)}
}
function leaveRoom(){if(confirm('정말 방을 나갈까?'))act('leave')}
async function boot(){if(session){await refresh();if(session)connect()}else render()}
boot();
setInterval(()=>{if(session&&!document.hidden)refresh()},9000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
