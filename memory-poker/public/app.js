'use strict';
const $=s=>document.querySelector(s);
const mount=$('#mount');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const suit={S:'♠',H:'♥',D:'♦',C:'♣'};
const cardName=n=>n===14?'A':n===13?'K':n===12?'Q':n===11?'J':String(n);
const positions='ABCDEFGHIJKLMNOP'.split('');
let code='',token='',state=null,offset=0,selected=[],phase='',requesting=false,timerId=0;
const savedNick=localStorage.getItem('memoryPokerNick')||'';
const queryCode=new URLSearchParams(location.search).get('room')||'';
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(timerId);timerId=setTimeout(()=>el.classList.remove('show'),3200);}
async function get(url){const r=await fetch(url,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'연결 오류');return d;}
async function post(route,data){const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),d=await r.json();if(!r.ok)throw Error(d.error||'연결 오류');return d;}
function inviteUrl(){return location.origin+'/?room='+encodeURIComponent(code);}
function card(c,back=false){
 if(back||!c)return '<div class="playing-card back" aria-label="뒤집힌 카드"></div>';
 const red=c.s==='H'||c.s==='D';return '<div class="playing-card'+(red?' red':'')+'" aria-label="'+cardName(c.n)+suit[c.s]+'"><span class="corner">'+cardName(c.n)+'<span>'+suit[c.s]+'</span></span><span class="big-suit">'+suit[c.s]+'</span></div>';
}
function landing(){
 state=null;code='';token='';selected=[];phase='';
 const pre=safe(queryCode.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
 mount.innerHTML='<section class="hero"><div class="eyebrow">♠ MEMORY POKER ♣</div><h1>기억 <em>포커</em></h1><p>20초의 기억이 승부를 바꾼다.<br>친구와 실시간으로 겨루는 2인 카드 두뇌전!</p></section><div class="suit-banner">♠ ♥ ♦ ♣</div>'+
 '<div class="entry-grid"><form class="panel" id="createForm"><div class="panel-icon">✦</div><h2>새 방 만들기</h2><p>방을 만들고 초대 링크를 친구에게 보내세요.</p><label class="field" for="createNick">내 닉네임</label><input id="createNick" maxlength="12" autocomplete="nickname" required placeholder="닉네임 입력" value="'+safe(savedNick)+'"><button class="btn btn-primary btn-wide" type="submit">새 방 만들기 →</button></form>'+
 '<form class="panel" id="joinForm"><div class="panel-icon">♣</div><h2>친구 방 입장</h2><p>친구가 공유한 6자리 코드를 입력하세요.</p><label class="field" for="joinNick">내 닉네임</label><input id="joinNick" maxlength="12" autocomplete="nickname" required placeholder="닉네임 입력" value="'+safe(savedNick)+'"><label class="field" for="joinCode">방 코드</label><input id="joinCode" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC234" required value="'+pre+'"><button class="btn btn-green btn-wide" type="submit">방 입장하기 →</button></form></div>'+
 '<p class="rules"><b>16장 카드 20초 암기</b> → <b>공용 카드 3장 공개</b> → 기억한 위치 <b>2장 선택</b> → 포커 족보로 승부!<br>베팅 없이 진행하며, 동일한 위치를 두 사람 모두 선택할 수 있어요.</p>';
}
function playerBox(p){
 return '<div class="player'+(p.id===state.me?' me':'')+'"><div class="top"><span>'+(p.id===state.host?'👑 방장':'♣ 참가자')+(p.id===state.me?' · 나':'')+'</span><span>'+(!p.online?'재접속 중':p.picked?'선택 완료':'온라인')+'</span></div><div class="name">'+safe(p.nick)+'</div><div class="score">'+p.score+' <small style="color:var(--muted);font-size:11px">승</small></div></div>';
}
function board(){
 const revealed=state.phase==='memorize'||state.phase==='result';
 return '<div class="table-panel"><div class="board">'+positions.map((label,i)=>{
  const mePicked=state.phase==='result'&&state.outcome.players.find(x=>x.id===state.me).positions.includes(i);
  const oppPicked=state.phase==='result'&&state.outcome.players.find(x=>x.id!==state.me).positions.includes(i);
  let classes='tile'+(state.phase==='pick'&&!state.ownPick?' selectable':'')+(selected.includes(i)&&state.phase==='pick'&&!state.ownPick?' selected':'')+(mePicked?' revealed-me':oppPicked?' revealed-other':'');
  return '<button type="button" class="'+classes+'" data-index="'+i+'" '+(state.phase==='pick'&&!state.ownPick?'':'disabled')+' aria-label="'+label+' 위치'+(selected.includes(i)?' 선택됨':'')+'"><span class="tile-label">'+label+'</span>'+card(revealed?state.board[i]:null,!revealed)+'</button>';
 }).join('')+'</div></div>';
}
function common(){
 return '<section class="community-wrap"><p class="section-title">COMMUNITY · 공용 카드 3장</p><div class="community">'+(state.community||[null,null,null]).map(c=>card(c,!c)).join('')+'</div></section>';
}
function resultView(){
 const o=state.outcome;
 const winner=o.winner?state.players.find(p=>p.id===o.winner):null;
 const meWon=o.winner===state.me;
 return '<section class="result center"><div class="eyebrow">ROUND '+state.round+' RESULT</div><h2>'+(!winner?'무승부!':meWon?'승리! ✦':'이번 라운드는 패배')+'</h2><p>'+(!winner?'포커 족보와 숫자가 완전히 같아요.':safe(winner.nick)+' 님의 족보가 더 강했어요.')+'</p></section>'+
 '<div class="result-grid">'+o.players.map(x=>{const p=state.players.find(z=>z.id===x.id);return '<section class="hand-result'+(x.id===o.winner?' winner':'')+'"><h3>'+safe(p.nick)+(x.id===o.winner?' 👑':'')+'</h3><div class="mini-hand">'+x.hand.map(c=>card(c)).join('')+'</div><div class="rankname">'+safe(x.rank.name)+'</div><small style="color:var(--muted)">선택 위치: '+x.positions.map(i=>positions[i]).join(' · ')+'</small></section>';}).join('')+'</div>'+
 '<div class="action-bar">'+(state.me===state.host?'<button type="button" class="btn btn-primary" data-action="start">다음 라운드 시작 →</button>':'<p>방장이 다음 라운드를 시작할 수 있어요.</p>')+'</div>'+
 '<div class="status"><p>선택 위치 테두리: <span style="color:var(--gold)">노랑 = 나</span> · <span style="color:var(--blue)">파랑 = 친구</span></p></div>'+board();
}
function render(){
 if(!state)return landing();
 const players=state.players.map(playerBox).join('')+(state.players.length<2?'<div class="player"><div class="top">대기 중</div><div class="name" style="color:var(--muted)">친구를 기다리는 중…</div></div>':'');
 let content='<div class="roomtop"><div><h1>♠ 기억 포커</h1><p>라운드 '+state.round+' · 실시간 2인 온라인 대결</p></div><div class="roomcode"><small>방 코드</small><strong>'+safe(state.code)+'</strong><button data-action="copy">초대 링크 복사</button></div></div><div class="players">'+players+'</div>';
 if(state.phase==='lobby'){
  content+='<section class="panel waiting center"><div class="panel-icon">♠ ♥ ♦ ♣</div><h2>승부를 준비하세요!</h2><p>친구에게 링크나 방 코드를 보내면 바로 같은 방에 들어올 수 있어요.<br>두 명이 모이면 방장이 게임을 시작합니다.</p>'+
  (state.me===state.host?'<button class="btn btn-primary" data-action="start" '+(state.players.length!==2?'disabled':'')+'>20초 암기 시작 →</button>':'<p>방장이 시작 버튼을 누르길 기다리고 있어요.</p>')+
  '<div class="small-note">카드를 외울 시간은 정확히 20초. 가려진 카드 16개 중 두 곳을 골라 공용 카드 3장과 합칩니다.</div></section>';
 } else if(state.phase==='memorize') {
  content+='<section class="status"><span class="phase">MEMORIZE · 암기 단계</span><h2>카드의 숫자와 위치를 기억하세요</h2><p>시간이 지나면 모든 카드가 가려집니다.</p><div class="timer" id="timer"></div></section>'+board()+'<div class="action-bar"><p>친구와 같은 16장을 보고 있어요. A~P 위치를 외우세요.</p></div>';
 } else if(state.phase==='pick') {
  content+='<section class="status"><span class="phase">CHOOSE · 선택 단계</span><h2>기억한 카드 2장을 선택하세요</h2><p>공용 카드 3장과 조합해 가장 강한 족보를 만드세요.</p></section>'+common()+board()+
  '<div class="action-bar">'+(state.ownPick?'<p>✓ 선택을 확정했어요. 친구가 고르기를 기다리는 중…</p>':'<button type="button" class="btn btn-primary" data-action="confirm" '+(selected.length!==2?'disabled':'')+'>카드 '+selected.length+'/2장 · 이 조합으로 확정</button><p>한 번 확정하면 바꿀 수 없어요. 친구와 같은 위치를 골라도 돼요.</p>')+'</div>';
 } else if(state.phase==='result') {content+=resultView();}
 mount.innerHTML=content;
 updateCountdown();
}
function updateCountdown(){if(!state||state.phase!=='memorize')return;const t=$('#timer');if(!t)return;const left=Math.max(0,Math.ceil((state.endsAt-(Date.now()+offset))/1000));t.textContent=String(left).padStart(2,'0')+'초';t.classList.toggle('urgent',left<=5);}
async function refresh(){
 if(!code||!token||requesting)return;
 requesting=true;
 try{
  const s=await get('/api/state?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token));
  offset=s.serverNow-Date.now();
  if(s.phase!==phase){selected=[];phase=s.phase;}
  state=s;render();
 }catch(e){
  if(/다시 입장/.test(e.message)){localStorage.removeItem('memoryPokerRoom:'+code);landing();}
  else if(state)toast('연결을 확인하고 있어요…');
 }finally{requesting=false;}
}
function remember(resp,nick){
 code=resp.code;token=resp.token;state=null;phase='';selected=[];
 localStorage.setItem('memoryPokerRoom:'+code,token);
 if(nick)localStorage.setItem('memoryPokerNick',nick);
 history.replaceState({},'',inviteUrl());
 refresh();
}
document.addEventListener('submit',async e=>{
 if(!['createForm','joinForm'].includes(e.target.id))return;
 e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;
 try{
  const nick=e.target.querySelector('[id$=Nick]').value.trim();
  const result=e.target.id==='createForm'?await post('create',{nick}):await post('join',{code:$('#joinCode').value.toUpperCase().trim(),nick,token:localStorage.getItem('memoryPokerRoom:'+$('#joinCode').value.toUpperCase().trim())||undefined});
  remember(result,nick);
 }catch(err){toast(err.message);b.disabled=false;}
});
document.addEventListener('click',async e=>{
 const tile=e.target.closest('[data-index]');
 if(tile&&state?.phase==='pick'&&!state.ownPick){
  const i=Number(tile.dataset.index);if(selected.includes(i))selected=selected.filter(n=>n!==i);else if(selected.length<2)selected.push(i);else{toast('정확히 두 장만 선택할 수 있어요.');return;}render();return;
 }
 const btn=e.target.closest('[data-action]');if(!btn||!state)return;
 const action=btn.dataset.action;
 if(action==='copy'){
  try{await navigator.clipboard.writeText(inviteUrl());toast('초대 링크 복사 완료!');}
  catch{prompt('아래 링크를 복사해 친구에게 보내세요',inviteUrl());}return;
 }
 if(action==='start'||action==='confirm'){
  btn.disabled=true;
  try{await post(action==='start'?'start':'pick',action==='start'?{code,token}:{code,token,positions:selected.slice()});await refresh();}
  catch(err){toast(err.message);btn.disabled=false;}
 }
});
async function boot(){
 const c=String(queryCode).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
 const t=c&&localStorage.getItem('memoryPokerRoom:'+c);
 if(t){code=c;token=t;await refresh();if(state)return;}
 landing();
}
boot();setInterval(()=>{if(code&&token)refresh();},1200);setInterval(updateCountdown,200);
