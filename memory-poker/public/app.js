'use strict';
const $=s=>document.querySelector(s);
const mount=$('#mount');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const suit={S:'♠',H:'♥',D:'♦',C:'♣'};
const cardName=n=>n===14?'A':n===13?'K':n===12?'Q':n===11?'J':String(n);
const positions='ABCDEFGHIJKLMNOP'.split('');
let code='',token='',state=null,offset=0,phase='',requesting=false,choosing=false,lastStateKey='',timerId=0,stateRevision=0;
const roomStorage=(()=>{try{return sessionStorage;}catch{return localStorage;}})();
const savedNick=localStorage.getItem('memoryPokerNick')||'';
const queryCode=new URLSearchParams(location.search).get('room')||'';
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(timerId);timerId=setTimeout(()=>el.classList.remove('show'),3200);}
async function get(url){const r=await fetch(url,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'연결 오류');return d;}
async function post(route,data){const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),d=await r.json();if(!r.ok)throw Error(d.error||'연결 오류');return d;}
function inviteUrl(){return location.origin+'/?room='+encodeURIComponent(code);}
function card(c,back=false){
 if(back||!c)return '<div class="playing-card back" aria-label="뒤집힌 카드"></div>';
 const red=c.s==='H'||c.s==='D';return '<div class="playing-card'+(red?' red':'')+'" aria-label="'+cardName(c.n)+suit[c.s]+'"><span class="corner">'+cardName(c.n)+'<span>'+suit[c.s]+'</span></span><span class="card-center"><strong class="center-rank">'+cardName(c.n)+'</strong><span class="center-suit">'+suit[c.s]+'</span></span></div>';
}
function landing(){
 state=null;code='';token='';phase='';lastStateKey='';
 const pre=safe(queryCode.replace(/\D/g,'').slice(0,3));
 mount.innerHTML='<section class="hero"><div class="eyebrow">♠ MEMORY POKER ♣</div><h1>기억 <em>포커</em></h1><p>20초의 기억이 승부를 바꾼다.<br>친구와 실시간으로 겨루는 2인 카드 두뇌전!</p></section><div class="suit-banner">♠ ♥ ♦ ♣</div>'+
 '<div class="entry-grid"><form class="panel" id="createForm"><div class="panel-icon">✦</div><h2>새 방 만들기</h2><p>방을 만들고 초대 링크를 친구에게 보내세요.</p><label class="field" for="createNick">내 닉네임</label><input id="createNick" maxlength="12" autocomplete="nickname" required placeholder="닉네임 입력" value="'+safe(savedNick)+'"><button class="btn btn-primary btn-wide" type="submit">새 방 만들기 →</button></form>'+
 '<form class="panel" id="joinForm"><div class="panel-icon">♣</div><h2>친구 방 입장</h2><p>친구가 공유한 숫자 3자리 코드를 입력하세요.</p><label class="field" for="joinNick">내 닉네임</label><input id="joinNick" maxlength="12" autocomplete="nickname" required placeholder="닉네임 입력" value="'+safe(savedNick)+'"><label class="field" for="joinCode">방 코드</label><input id="joinCode" maxlength="3" inputmode="numeric" pattern="[0-9]{3}" autocomplete="off" placeholder="123" required value="'+pre+'"><button class="btn btn-green btn-wide" type="submit">방 입장하기 →</button></form></div>'+
 '<p class="rules"><b>16장 카드 20초 암기</b> → <b>공용 카드 3장 공개</b> → <b>15초간 뒷면 2장 선택</b> → <b>선택 카드 공개</b> → 포커 판정! 먼저 <b>3승</b>을 달성하면 승리!<br>베팅 없이 진행하며, 동일한 위치를 두 사람 모두 선택할 수 있어요.</p>';
}
function playerBox(p){
 return '<div class="player'+(p.id===state.me?' me':'')+'"><div class="top"><span>'+(p.id===state.host?'👑 방장':'♣ 참가자')+(p.id===state.me?' · 나':'')+'</span><span>'+(!p.online?'재접속 중':['lobby','result','countdown'].includes(state.phase)?(p.ready?'✓ 준비 완료':'준비 대기'):p.picked?'선택 완료':'온라인')+'</span></div><div class="name">'+safe(p.nick)+'</div><div class="score">'+p.score+' <small style="color:var(--muted);font-size:11px">/ 3승</small></div></div>';
}
function readyControls(){
 const me=state.players.find(p=>p.id===state.me);
 const ready=state.readyCount??state.players.filter(p=>p.ready).length;
 const isLobby=state.phase==='lobby';
 const isRematch=state.phase==='result'&&!!state.matchWinner;
 const label=isLobby?'게임 준비하기':isRematch?'새 경기 준비하기':'다음 판 준비하기';
 const helper=state.players.length<2?'상대방이 입장하면 함께 시작할 수 있어요.':
  '두 사람 모두 준비하면 3 · 2 · 1 카운트다운이 시작돼요.';
 return '<div class="ready-dock-spacer" aria-hidden="true"></div>'+
  '<section class="ready-dock" aria-label="게임 준비 상태">'+
  '<div class="ready-dock-status"><strong>준비 '+ready+' / 2명</strong><span>'+safe(me?.nick||'참가자')+' · '+(me?.ready?'준비 완료':'준비 대기')+'</span></div>'+
  (me?.ready?'<div class="ready-dock-confirmed">✓ 내 준비 완료 · 상대방 기다리는 중</div>':
  '<button type="button" class="btn btn-primary ready-dock-button" data-action="ready">'+label+'</button>')+
  '<p>'+helper+'</p></section>';
}
function board(){
 const full=state.phase==='memorize'||state.phase==='result';
 const picks=state.ownSelection||[];
 const reveals=state.revealCards||[];
 return '<div class="table-panel"><div class="board">'+positions.map((_,i)=>{
  const item=reveals.find(x=>x.position===i);
  const marked=state.phase==='pick'&&picks.includes(i);
  const mine=state.phase==='result'&&state.outcome.players.find(x=>x.id===state.me).positions.includes(i)||
   state.phase==='reveal'&&item&&item.owners.includes(state.me);
  const theirs=state.phase==='result'&&state.outcome.players.find(x=>x.id!==state.me).positions.includes(i)||
   state.phase==='reveal'&&item&&item.owners.some(id=>id!==state.me);
  const clickable=state.phase==='pick'&&state.endsAt>(Date.now()+offset);
  const faceUp=full||state.phase==='reveal'&&!!item;
  const cardData=full?state.board[i]:(faceUp?item.card:null);
  const classes='tile'+(clickable?' selectable':'')+(marked?' selected':'')+(state.phase==='reveal'&&item?' flip-revealed':'')+(mine?' revealed-me':'')+(theirs?' revealed-other':'');
  const label=(Math.floor(i/4)+1)+'행 '+(i%4+1)+'열 카드'+(marked?' · 선택됨':'');
  return '<button type="button" class="'+classes+'" data-index="'+i+'" '+(clickable?'':'disabled')+' aria-label="'+label+'" aria-pressed="'+!!marked+'">'+card(cardData,!faceUp)+'</button>';
 }).join('')+'</div></div>';
}
function common(){
 return '<section class="community-wrap"><p class="section-title">COMMUNITY · 공용 카드 3장</p><div class="community">'+(state.community||[null,null,null]).map(c=>card(c,!c)).join('')+'</div></section>';
}
function resultView(){
 const o=state.outcome;
 const winner=o.winner?state.players.find(p=>p.id===o.winner):null;
 const matchOver=!!state.matchWinner,matchWon=state.matchWinner===state.me;
 const roundWon=o.winner===state.me;
 const headline=matchOver?(matchWon?'🏆 최종 우승!':'최종 패배'):!winner?'무승부!':roundWon?'이번 판 승리! ✦':'이번 판 패배';
 const description=matchOver?safe(state.players.find(p=>p.id===state.matchWinner).nick)+' 님이 먼저 3승을 달성했어요!'
  :!winner?'무승부는 승수에 포함되지 않아요.':safe(winner.nick)+' 님의 족보가 더 강했어요.';
 return '<section class="result center"><div class="eyebrow">'+(matchOver?'BEST OF FIVE · FINAL':'ROUND '+state.round+' RESULT')+'</div><h2>'+headline+'</h2><p>'+description+'</p></section>'+
 '<div class="result-grid">'+o.players.map(x=>{const p=state.players.find(z=>z.id===x.id);return '<section class="hand-result'+(x.id===o.winner?' winner':'')+'"><h3>'+safe(p.nick)+(x.id===o.winner?' 👑':'')+'</h3><div class="mini-hand">'+x.hand.map(c=>card(c)).join('')+'</div><div class="rankname">'+safe(x.rank.name)+'</div><small style="color:var(--muted)">선택한 카드 2장 + 공용 카드 3장'+(x.autoPositions.length?' · 자동 선택 '+x.autoPositions.length+'장':'')+'</small></section>';}).join('')+'</div>'+
 '<div class="status"><p>선택 위치 테두리: <span style="color:var(--gold)">노랑 = 나</span> · <span style="color:var(--blue)">파랑 = 친구</span></p></div>'+board();
}
function render(){
 if(!state)return landing();
 const players=state.players.map(playerBox).join('')+(state.players.length<2?'<div class="player"><div class="top">대기 중</div><div class="name" style="color:var(--muted)">친구를 기다리는 중…</div></div>':'');
 let content='<div class="roomtop"><div><h1>♠ 기억 포커</h1><p>라운드 '+state.round+' · 5판 3선승제</p></div><div class="roomcode"><small>방 코드</small><strong>'+safe(state.code)+'</strong><button data-action="copy">초대 링크 복사</button></div></div><div class="players">'+players+'</div>';
 if(state.phase==='lobby'){
  content+='<section class="panel waiting center"><div class="panel-icon">♠ ♥ ♦ ♣</div><h2>함께 준비하면 시작해요</h2><p>친구에게 숫자 3자리 초대 코드나 링크를 보내 주세요.<br>방장과 참가자 모두 아래에서 준비할 수 있어요.</p>'+
  '<div class="small-note">20초 암기 → 15초 선택 → 카드 공개 → 족보 판정. 다음 판도 두 명 모두 준비하면 시작해요.</div></section>';
 } else if(state.phase==='memorize') {
  content+='<section class="status"><span class="phase">MEMORIZE · 암기 단계</span><h2>카드의 숫자와 위치를 기억하세요</h2><p>시간이 지나면 모든 카드가 가려집니다.</p><div class="timer" id="timer"></div></section>'+board()+'<div class="action-bar"><p>친구와 같은 16장을 보고 있어요. 4×4 배열에서 카드의 숫자와 문양을 기억하세요.</p></div>';
 } else if(state.phase==='pick') {
  const n=(state.ownSelection||[]).length;
  content+='<section class="status"><span class="phase">CHOOSE · 선택 단계</span><h2>뒷면 카드 2장을 선택하세요</h2><p>카드는 공개되지 않아요. 터치해서 선택하거나 다시 눌러 취소할 수 있어요.</p><div class="timer" id="timer"></div></section>'+common()+board()+
  '<div class="action-bar"><p class="picked-note">선택한 카드 <strong>'+n+' / 2장</strong></p><p>15초가 전부 지나면 자동 확정돼요. 부족한 장수만 그때 무작위로 채워집니다.</p></div>';
 } else if(state.phase==='reveal') {
  content+='<section class="status"><span class="phase">REVEAL · 카드 공개</span><h2>선택한 카드가 뒤집혔어요!</h2><p>선택한 카드만 공개됐어요. 잠시 후 족보와 승패를 확인합니다.</p><div class="timer" id="timer"></div></section>'+common()+board()+
   '<div class="action-bar"><p>금색 테두리는 나, 파란 테두리는 친구가 고른 카드예요.</p></div>';
 } else if(state.phase==='result') {content+=resultView();}
 else if(state.phase==='countdown'){
  content+='<section class="panel waiting center"><span class="phase eyebrow">'+(state.round===0?'GAME START':'NEXT ROUND')+'</span><h2>두 사람 모두 준비 완료!</h2><p>카드가 공개되기 전 카운트다운이 진행돼요.</p><div id="countdown-number" class="countdown-number" aria-live="off">3</div><p>숫자가 끝나면 20초 암기 시작!</p></section>';
 }
 if(state.phase==='lobby'||state.phase==='result')content+=readyControls();
 mount.innerHTML=content;
 updateCountdown();
}
function updateCountdown(){
 if(!state||!['memorize','pick','reveal','countdown'].includes(state.phase))return;
 const leftMs=Math.max(0,state.endsAt-(Date.now()+offset));
 const left=Math.ceil(leftMs/1000);
 if(state.phase==='countdown'){
  const el=$('#countdown-number');
  if(el)el.textContent=left>0?String(left):'START!';
  return;
 }
 const t=$('#timer');
 if(!t)return;
 t.textContent=String(left).padStart(2,'0')+'초';
 t.classList.toggle('urgent',left<=5&&state.phase!=='reveal');
}
async function refresh(){
 if(!code||!token||requesting)return;
 requesting=true;
 try{
  // Midpoint time synchronization prevents the server deadline arriving while the
  // browser's displayed timer still shows several seconds remaining.
  const currentRevision=stateRevision;
   const sentAt=Date.now();
  const s=await get('/api/state?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token));
  const receivedAt=Date.now();
  if(currentRevision!==stateRevision)return;
   offset=s.serverNow-(sentAt+receivedAt)/2;
  if(s.phase!==phase)phase=s.phase;
  const key=JSON.stringify({...s,serverNow:undefined});
  const changed=key!==lastStateKey;
  lastStateKey=key;state=s;
  if(changed)render();else updateCountdown();
 }catch(e){
  if(/다시 입장/.test(e.message)){roomStorage.removeItem('memoryPokerRoom:'+code);landing();}
  else if(state)toast('연결을 확인하고 있어요…');
 }finally{requesting=false;}
}
function remember(resp,nick){
 code=resp.code;token=resp.token;state=null;phase='';lastStateKey='';
 roomStorage.setItem('memoryPokerRoom:'+code,token);
 if(nick)localStorage.setItem('memoryPokerNick',nick);
 history.replaceState({},'',inviteUrl());
 refresh();
}
document.addEventListener('submit',async e=>{
 if(!['createForm','joinForm'].includes(e.target.id))return;
 e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;
 try{
  const nick=e.target.querySelector('[id$=Nick]').value.trim();
  const result=e.target.id==='createForm'?await post('create',{nick}):await post('join',{code:$('#joinCode').value.trim(),nick,token:roomStorage.getItem('memoryPokerRoom:'+$('#joinCode').value.trim())||undefined});
  remember(result,nick);
 }catch(err){toast(err.message);b.disabled=false;}
});
document.addEventListener('click',async e=>{
 const tile=e.target.closest('[data-index]');
 if(tile&&state?.phase==='pick'){
  if(choosing||tile.disabled)return;
  choosing=true;tile.disabled=true;
  try{await post('select',{code,token,position:Number(tile.dataset.index)});await refresh();}
  catch(err){toast(err.message);tile.disabled=false;}
  finally{choosing=false;}
  return;
 }
 const btn=e.target.closest('[data-action]');if(!btn||!state)return;
 const action=btn.dataset.action;
 if(action==='copy'){
  try{await navigator.clipboard.writeText(inviteUrl());toast('초대 링크 복사 완료!');}
  catch{prompt('아래 링크를 복사해 친구에게 보내세요',inviteUrl());}return;
 }
 if(action==='ready'){
  btn.disabled=true;
  try{
   const response=await post('ready',{code,token});
   if(response.state){
    stateRevision++;offset=response.state.serverNow-Date.now();
    state=response.state;phase=state.phase;lastStateKey='';render();
   }else await refresh();
  }catch(err){toast(err.message);btn.disabled=false;}
 }

});
async function boot(){
 const c=String(queryCode).replace(/\D/g,'').slice(0,3);
 const t=c&&roomStorage.getItem('memoryPokerRoom:'+c);
 if(t){code=c;token=t;await refresh();if(state)return;}
 landing();
}
boot();setInterval(()=>{if(code&&token)refresh();},1200);setInterval(updateCountdown,200);
