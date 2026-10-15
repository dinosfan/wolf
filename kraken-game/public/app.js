'use strict';
const app=document.getElementById('app'),overlay=document.getElementById('overlay'),toastEl=document.getElementById('toast');
const KEY='no-touch-kraken-session-v1',query=new URLSearchParams(location.search);
let session=null,state=null,stream=null,pending=false,selected=null,seenReveal=null,flash=null,flashTimer=null,toastTimer=null;
try{session=JSON.parse(localStorage.getItem(KEY)||'null')}catch{localStorage.removeItem(KEY)}
if(session&&query.get('room')&&query.get('room')!==session.code)session=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={blank:'빈 상자',treasure:'보물 상자',kraken:'크라켄'};
const symbols={blank:'⚓',treasure:'💎',kraken:'🐙'};
function toast(x){toastEl.textContent=x;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.textContent='',3200)}
function header(){
 return '<header class="header"><div class="brand"><span class="crest">🐙</span><div><strong>노터치 크라켄</strong><small>SECRET PIRATE GAME</small></div></div>'+
 '<button class="small-button" onclick="rules()">게임 규칙 <span>↗</span></button></header>';
}
function modal(markup){overlay.innerHTML='<div class="modal">'+markup+'</div>';overlay.hidden=false}
function closeModal(){overlay.hidden=true;overlay.innerHTML=''}
function rules(){
 modal('<div class="modal-label">HOW TO PLAY</div><h2>🏴‍☠️ 노터치 크라켄 규칙</h2>'+
 '<p>비밀 역할은 <b>탐험대</b>와 <b>스켈레톤</b>. 탐험대는 모든 보물을 발견해야 해. 스켈레톤은 크라켄이 공개되거나 4라운드를 버티면 승리!</p>'+
 '<ol><li>각자 역할을 혼자 확인하고, 자신에게 있는 카드의 <b>종류와 장수만</b> 확인해.</li>'+
 '<li>각자 카드를 섞어서 뒤집어 둔 상태이므로 <b>어느 위치가 무슨 카드인지는 본인도 몰라.</b></li>'+
 '<li>현재 차례인 사람이 <b>다른 사람의 카드 1장</b>을 골라 공개해.</li>'+
 '<li>공개된 카드는 가운데 모아 놓고, <b>그 카드를 갖고 있던 사람</b>이 다음 카드를 골라.</li>'+
 '<li>한 라운드마다 인원수만큼 공개하면 남은 카드를 전부 섞어 다시 나눠. 공개했던 카드는 재사용하지 않아.</li>'+
 '<li>모든 보물을 발견하면 탐험대 승리! 크라켄 공개 또는 4라운드 종료 시 스켈레톤 승리.</li></ol>'+
 '<div class="note">💬 이 게임은 서로 얼굴을 보고 대화하는 심리전이 핵심이야. 자기 카드 구성을 말해도 되고 거짓말해도 돼!</div>'+
 '<p class="subtle">3인 모드는 원작 예외 규칙 적용. 기본판 기준이며 디럭스 확장 카드는 제외했어. 봇은 규칙 연습용이고 정교한 토론은 하지 않아.</p>'+
 '<button class="primary full" onclick="closeModal()">이해했어!</button>');
}
async function request(url,data){
 const resp=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const parsed=await resp.json();if(!resp.ok)throw Error(parsed.error||'서버 오류');return parsed;
}
function save(result){
 session={code:result.code,token:result.token};localStorage.setItem(KEY,JSON.stringify(session));
 history.replaceState(null,'','/?room='+result.code);selected=null;update(result.state);connect();
}
function connect(){
 stream?.close();if(!session)return;
 stream=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
 stream.onmessage=refresh;stream.onerror=()=>{};
}
async function refresh(){
 if(!session||pending)return;
 try{const response=await request('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));update(response)}
 catch(e){
  if(/방을 찾지|참가 인증/.test(e.message)){
   localStorage.removeItem(KEY);session=null;state=null;stream?.close();selected=null;seenReveal=null;
   history.replaceState(null,'','/');toast('기존 방이 초기화됐어. 새 방을 만들어줘.');render();
  }
 }
}
function update(next){
 if(state?.code!==next.code){seenReveal=null;selected=null;flash=null}
 if(state&&state.code===next.code&&state.stage==='lobby'&&next.stage==='playing'){selected=null}
 const last=next.lastReveal,show=last&&(!seenReveal||seenReveal!==last.id);
 if(!state){seenReveal=last?.id??null}
 else if(show){
  seenReveal=last.id;flash=last;
  clearTimeout(flashTimer);flashTimer=setTimeout(()=>{flash=null;render()},2300);
  if(typeof navigator!=='undefined'&&navigator.vibrate&&next.turn===next.seat)try{navigator.vibrate(90)}catch{}
 }
 state=next;
 if(next.stage!=='playing'||next.turn!==next.seat)selected=null;
 if(selected&&!next.players.find(p=>p.seat===selected.target&&p.remaining>selected.slot))selected=null;
 render();
}
async function create(event){
 event.preventDefault();if(pending)return;
 const size=Number(document.getElementById('size').value),name=document.getElementById('name').value.trim()||'선원';
 await startRoom({size,name});
}
async function practice(){
 if(pending)return;
 await startRoom({size:Number(document.getElementById('size').value),name:document.getElementById('name').value.trim()||'나',practice:true});
}
async function startRoom(body){
 pending=true;try{save(await request('/api/create',body))}catch(e){toast(e.message)}finally{pending=false}
}
async function join(event){
 event.preventDefault();if(pending)return;pending=true;
 try{save(await request('/api/join',{name:document.getElementById('joinName').value.trim(),code:document.getElementById('code').value.toUpperCase().trim()}))}
 catch(e){toast(e.message)}finally{pending=false}
}
async function action(type,extra={}){
 if(!session||pending)return;pending=true;
 try{const result=await request('/api/action',{...session,type,...extra});
  if(result.left){localStorage.removeItem(KEY);session=null;state=null;stream?.close();history.replaceState(null,'','/');render()}
  else update(result)
 }catch(e){toast(e.message)}
 finally{pending=false}
}
function choose(target,slot){
 if(!state||state.stage!=='playing'||state.turn!==state.seat||state.seat===target)return;
 const p=state.players.find(x=>x.seat===target);if(!p||slot>=p.remaining)return;
 selected={target,slot};render();
}
function confirmChoice(){
 if(!selected)return;
 const {target,slot}=selected;selected=null;action('open',{target,slot});
}
async function copyLink(){
 if(!state)return;const url=location.origin+'/?room='+state.code;
 try{await navigator.clipboard.writeText(url);toast('🔗 초대 링크를 복사했어!')}
 catch{prompt('초대 링크를 복사해 줘',url)}
}
function leaveRoom(){if(confirm('정말 방을 나갈까?'))action('leave')}
function pill(x){return '<span class="pill">'+x+'</span>'}
function home(){
 return header()+'<section class="hero"><div class="sea-art"><span>☠️</span><span>⚓</span><span>🐙</span></div>'+
 '<span class="eyebrow">TRUST NO ONE ON THIS SHIP</span><h1>보물을 찾아라.<br><em>크라켄은 건드리지 마.</em></h1>'+
 '<p>누가 거짓말을 하고 있을까?<br>보물을 찾으려는 탐험대와 크라켄을 노리는 배신자들.</p>'+
 '<div class="hero-pills">'+pill('👥 3~8인')+pill('🃏 4라운드')+pill('🎭 비밀 역할')+'</div></section>'+
 '<section class="panel"><h2>⚓ 새 항해 시작</h2><form onsubmit="create(event)"><label for="name">닉네임</label>'+
 '<input id="name" maxlength="14" placeholder="예: 수상한 선원" autocomplete="off">'+
 '<label for="size">플레이 인원</label><select id="size">'+[3,4,5,6,7,8].map(n=>'<option value="'+n+'" '+(n===6?'selected':'')+'>'+n+'인'+(n===3?' (3인 예외 규칙)':'')+'</option>').join('')+'</select>'+
 '<button class="primary full" type="submit">친구들과 방 만들기 →</button>'+
 '<button class="secondary full" type="button" onclick="practice()">🤖 혼자 연습하기 (봇)</button></form>'+
 '<p class="subtle">친구들끼리 한자리에 모여서 플레이하는 걸 추천해. 대화는 직접 하고 역할·카드는 휴대폰으로 비밀리에 확인!</p></section>'+
 '<section class="panel"><h2>🔗 친구 방에 참가</h2><form onsubmit="join(event)"><label for="joinName">닉네임</label><input id="joinName" maxlength="14" required placeholder="닉네임">'+
 '<label for="code">초대 코드</label><input id="code" maxlength="5" required placeholder="ABCDE" value="'+esc(query.get('room')||'')+'">'+
 '<button class="secondary full" type="submit">입장하기</button></form></section>';
}
function lobby(){
 const filled=state.players.length===state.size,all=filled&&state.players.every(p=>p.ready);
 return header()+'<section class="lobby-head panel">'+pill('대기실 · '+state.players.length+'/'+state.size+'명')+
 '<h1>수상한 선원 모집 중</h1><div class="invite">'+esc(state.code)+'</div>'+
 '<button class="secondary full" onclick="copyLink()">🔗 초대 링크 복사하기</button><p>모두 준비하면 방장이 항해를 시작할 수 있어.</p></section>'+
 '<section class="panel"><h2>🚢 탑승한 선원</h2><div class="lobby-grid">'+
 state.players.map(p=>'<div class="crew-mini" style="--person:'+p.mark+'"><div class="mini-avatar">'+(p.bot?'🤖':'🏴‍☠️')+'</div>'+
 '<strong>'+esc(p.name)+(p.seat===state.seat?' · 나':'')+'</strong><small>'+(p.ready?'✅ 준비':'⏳ 대기')+'</small>'+
 (p.bot&&state.isHost?'<button class="tiny" onclick="action(\'removeBot\',{seat:'+p.seat+'})">봇 제거</button>':'')+'</div>').join('')+
 Array.from({length:state.size-state.players.length},()=>'<div class="crew-mini empty"><div class="mini-avatar">?</div><strong>빈자리</strong><small>참가 대기</small></div>').join('')+
 '</div></section><section class="panel">'+
 (state.isHost?'<div class="button-row"><button class="secondary" onclick="action(\'addBot\')">🤖 봇 추가</button><button class="secondary" onclick="action(\'fillBots\')">🤖 모두 채우기</button></div>':'')+
 '<button class="primary full" onclick="action(\'ready\',{ready:'+(!state.players[state.seat].ready)+'})">'+(state.players[state.seat].ready?'준비 취소':'✅ 준비 완료')+'</button>'+
 (state.isHost?'<button class="primary full" '+(all?'':'disabled')+' onclick="action(\'start\')">🏴‍☠️ 항해 시작!</button>':'<p class="subtle">방장이 게임 시작 버튼을 누르면 출발해.</p>')+
 '<button class="quiet full" onclick="leaveRoom()">방 나가기</button></section>';
}
function roleButton(){
 return '<button class="secret-button" onclick="secret()">🔒 내 비밀 역할·카드 구성 확인 <span>나만 보기 →</span></button>';
}
function secret(){
 if(!state||!['playing','break','ended'].includes(state.stage))return;
 const evil=state.role==='skeleton';
 modal('<div class="modal-label">EYES ONLY · 다른 사람이 못 보게 해!</div>'+
 '<div class="role-art">'+(evil?'☠️':'🏴‍☠️')+'</div>'+
 '<h2>당신은 <em class="'+(evil?'evil':'good')+'">'+(evil?'스켈레톤':'탐험대')+'</em>!</h2>'+
 '<p>'+(evil?'크라켄 카드를 공개하도록 유도하거나 보물 발견을 4라운드 끝까지 방해해. 정체를 숨겨야 해.':
 '크라켄을 열지 않고 모든 보물 상자를 찾아야 해. 누가 믿을 만한지 판단해 봐.')+'</p>'+
 '<div class="secret-counts"><div><span>⚓</span><b>'+state.myCards.blank+'</b><small>빈 상자</small></div>'+
 '<div><span>💎</span><b>'+state.myCards.treasure+'</b><small>보물</small></div>'+
 '<div><span>🐙</span><b>'+state.myCards.kraken+'</b><small>크라켄</small></div></div>'+
 '<div class="note">이건 내 카드의 <b>종류별 개수</b>야. 어느 위치가 무슨 카드인지는 나도 몰라!</div>'+
 '<button class="primary full" onclick="closeModal()">카드 숨기기 🔒</button>');
}
function progress(){
 const pct=state.treasureFound/state.treasureTotal*100;
 return '<section class="progress-box"><div class="top-pills">'+pill('라운드 '+state.round+' / 4')+pill('방 '+esc(state.code))+
 '<button class="link-icon" onclick="copyLink()" aria-label="초대 링크 복사">↗</button></div>'+
 '<div class="progress-title"><div><small>TREASURE HUNT</small><h2>찾은 보물</h2></div>'+
 '<strong>'+state.treasureFound+' <span>/ '+state.treasureTotal+'</span></strong></div>'+
 '<div class="progress-track"><div class="progress-bar" style="width:'+pct+'%"></div></div>'+
 '<div class="round-meter"><span>이번 라운드 공개</span><strong>'+state.step+' / '+state.size+'장</strong></div>'+
 '<div class="round-pips">'+Array.from({length:state.size},(_,i)=>'<span class="'+(i<state.step?'on':'')+'"></span>').join('')+'</div></section>';
}
function face(card){
 const type=card.type;
 return '<div class="face-card '+type+'"><span class="face-icon">'+symbols[type]+'</span><strong>'+labels[type]+'</strong></div>';
}
function openedCards(){
 const cards=state.revealed;
 return '<section class="opened-section"><div class="section-title"><h2>📜 공개된 카드</h2><span>'+cards.length+'장</span></div>'+
 (cards.length?'<div class="opened-list">'+cards.slice(-16).map(c=>'<div class="opened-item '+c.type+'" title="'+esc(state.players[c.owner]?.name)+'님 카드 · '+c.round+'라운드">'+symbols[c.type]+'</div>').join('')+'</div>':
 '<div class="empty-revealed">아직 공개된 카드가 없어. 첫 카드를 골라봐!</div>')+'</section>';
}
function deckView(){
 const myturn=state.stage==='playing'&&state.turn===state.seat;
 return '<section class="table-section"><div class="section-title"><h2>🃏 선원들의 카드</h2><span>각자 카드의 종류는 비밀</span></div>'+
 '<div class="player-board">'+state.players.map(p=>{
  const isMe=p.seat===state.seat;
  const cards=Array.from({length:p.remaining},(_,slot)=>{
   const active=myturn&&!isMe,marked=selected?.target===p.seat&&selected.slot===slot;
   return '<button type="button" class="back-card'+(marked?' chosen':'')+'"'+(active?' onclick="choose('+p.seat+','+slot+')"':' disabled')+
    ' aria-label="'+esc(p.name)+'님의 '+(slot+1)+'번째 비공개 카드">'+
    '<span class="card-wave">〰</span><span class="card-eye">✦</span></button>';
  }).join('');
  return '<div class="player-entry'+(p.seat===state.turn?' active':'')+(isMe?' self':'')+'" style="--person:'+p.mark+'">'+
   '<div class="player-info"><div class="player-avatar">'+(p.bot?'🤖':'🏴‍☠️')+'</div><div class="player-name"><strong>'+esc(p.name)+(isMe?' (나)':'')+'</strong>'+
   '<small>'+(p.seat===state.turn?'🎯 현재 탐색자':isMe?'내 카드 · 다른 사람만 공개 가능':'선원')+'</small></div>'+
   '<span class="remaining">'+p.remaining+'장</span></div>'+
   '<div class="player-hand">'+(cards||'<span class="no-cards">남은 카드 없음</span>')+'</div></div>';
 }).join('')+'</div></section>';
}
function choiceBar(){
 const mine=state.turn===state.seat;
 if(!mine)return '<div class="action-dock"><div class="wait-turn">💬 <b>'+esc(state.players[state.turn]?.name)+'</b>님이 다음 카드를 선택 중<br><small>카드를 열기 전 친구들과 의논하고 거짓말도 해봐!</small></div></div>';
 if(!selected)return '<div class="action-dock highlighted"><strong>✨ 네 차례야!</strong><p>다른 선원의 뒷면 카드 한 장을 눌러 선택해.<br>서로 의논하면서 거짓말도 해봐 ㅋㅋ</p></div>';
 const player=state.players.find(p=>p.seat===selected.target);
 return '<div class="action-dock highlighted"><div class="selected-caption">🔎 '+esc(player?.name)+'님의 '+(selected.slot+1)+'번째 카드 선택됨</div>'+
 '<div class="button-row"><button class="secondary" onclick="selected=null;render()">취소</button>'+
 '<button class="primary" onclick="confirmChoice()">🃏 이 카드 공개하기!</button></div></div>';
}
function game(){
 return header()+progress()+
 '<div class="current-turn"><span class="pulse-dot"></span> '+(state.turn===state.seat?'현재 <b>내 차례!</b> 다른 사람의 카드를 골라봐.':
 '<b>'+esc(state.players[state.turn].name)+'</b>님이 탐색할 차례')+'</div>'+
 roleButton()+openedCards()+deckView()+choiceBar()+historyPanel();
}
function breakScreen(){
 return header()+progress()+
 '<section class="interlude"><div class="interlude-emoji">🌀</div><span class="eyebrow">ROUND '+state.round+' COMPLETED</span>'+
 '<h1>'+state.round+'라운드 종료</h1><p>'+state.step+'장의 카드를 공개했어.<br>남은 카드는 다시 섞어서 모두에게 공평하게 나눌 거야.</p>'+
 '<div class="round-info">다음 라운드: 각자 <b>'+(5-state.round)+'장</b>으로 시작</div>'+
 '<p>다음 첫 탐색자는 <b>'+esc(state.players[state.turn].name)+'</b>님이야.</p></section>'+
 roleButton()+openedCards()+
 (state.isHost?'<button class="primary full next-btn" onclick="action(\'next\')">🌊 '+(state.round+1)+'라운드 시작 →</button>':
 '<div class="waiting">방장이 다음 라운드를 시작할 때까지 기다려줘.</div>')+historyPanel();
}
function result(){
 const team=state.winner==='explorer',special=state.results?.specialThreePlayerLoss;
 return header()+'<section class="result-hero '+(team?'win-good':'win-bad')+'"><div class="result-symbol">'+(team?'💎':'🐙')+'</div>'+
 '<span class="eyebrow">GAME OVER</span><h1>'+(team?'탐험대 승리!':'스켈레톤 승리!')+'</h1>'+
 '<p>'+(special?'3인 특수 상황: 스켈레톤 없이 크라켄이 공개돼 전원 패배했어.':
 team?'크라켄을 피해 보물 '+state.treasureTotal+'개를 전부 찾았어!':'크라켄이 깨어났거나 제한된 4라운드가 종료됐어.')+'</p>'+
 '<div class="result-own">너의 역할: <b>'+(state.role==='explorer'?'탐험대':'스켈레톤')+'</b></div></section>'+
 '<section class="panel"><h2>🏴‍☠️ 모두의 정체 공개</h2><div class="reveal-roles">'+state.players.map(p=>
 '<div class="reveal-player"><span>'+(p.role==='explorer'?'🏴‍☠️':'☠️')+'</span><strong>'+esc(p.name)+(p.seat===state.seat?' (나)':'')+'</strong>'+
 '<small class="'+(p.role==='explorer'?'good':'evil')+'">'+(p.role==='explorer'?'탐험대':'스켈레톤')+'</small></div>').join('')+'</div></section>'+
 openedCards()+
 (state.isHost?'<button class="primary full next-btn" onclick="action(\'again\')">다시 한 판 하자 →</button>':
 '<div class="waiting">방장이 다음 게임을 준비하면 대기실로 돌아가.</div>')+historyPanel();
}
function historyPanel(){return '<details class="panel history"><summary>📜 진행 기록</summary><ol>'+state.history.slice().reverse().map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></details>'}
function flashView(){
 if(!flash||!state||state.code!==session?.code)return '';
 return '<div class="flip-toast" aria-live="polite"><span>'+symbols[flash.type]+'</span><strong>'+labels[flash.type]+'</strong><small>'+esc(state.players[flash.owner]?.name)+'님의 카드</small></div>';
}
function render(){
 const scroll=window.scrollY||0;
 app.innerHTML='<div class="wrap">'+(!state?home():state.stage==='lobby'?lobby():state.stage==='playing'?game():state.stage==='break'?breakScreen():result())+
 '<footer>NO TOUCH KRAKEN · 친구들과 즐기는 비밀 추리 게임</footer></div>'+flashView();
 if(state)window.scrollTo(0,scroll);
}
async function boot(){if(session){await refresh();if(session)connect()}else render()}
boot();
setInterval(()=>{if(session&&!document.hidden)refresh()},8000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
