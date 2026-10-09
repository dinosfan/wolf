const socket = io();
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const ROLE_INFO = {
  doppelganger:{name:'도플갱어',emoji:'🪞',team:'변동',max:1,desc:'밤 가장 먼저 다른 플레이어의 카드를 보고 그 역할과 승리 조건을 복사합니다.'},
  werewolf:{name:'늑대인간',emoji:'🐺',team:'늑대팀',max:2,desc:'밤에 다른 늑대를 확인합니다. 최종적으로 늑대가 아무도 죽지 않으면 늑대팀이 승리합니다.'},
  minion:{name:'하수인',emoji:'🕯️',team:'늑대팀',max:1,desc:'늑대가 누구인지 알지만 늑대는 하수인을 모릅니다. 플레이어 중 늑대가 없을 때는 특수 승리 조건이 적용됩니다.'},
  mason:{name:'석공',emoji:'🧱',team:'마을팀',max:2,desc:'밤에 다른 석공을 확인합니다. 사용할 때는 석공 카드 두 장을 함께 넣습니다.'},
  seer:{name:'예언자',emoji:'🔮',team:'마을팀',max:1,desc:'다른 플레이어 한 명의 카드 또는 가운데 카드 두 장을 확인할 수 있습니다.'},
  robber:{name:'강도',emoji:'🦹',team:'마을팀',max:1,desc:'원하면 다른 플레이어와 카드를 바꾸고 새로 받은 카드의 앞면을 확인합니다.'},
  troublemaker:{name:'말썽쟁이',emoji:'🃏',team:'마을팀',max:1,desc:'원하면 자신을 제외한 두 플레이어의 카드를 보지 않고 서로 바꿉니다.'},
  drunk:{name:'주정뱅이',emoji:'🍺',team:'마을팀',max:1,desc:'자기 카드와 가운데 카드 한 장을 반드시 바꾸며 새 카드는 확인하지 않습니다.'},
  insomniac:{name:'불면증 환자',emoji:'🌙',team:'마을팀',max:1,desc:'밤 마지막에 현재 자기 앞에 있는 카드가 무엇인지 확인합니다.'},
  hunter:{name:'사냥꾼',emoji:'🏹',team:'마을팀',max:1,desc:'자신이 죽으면 자신이 투표한 플레이어도 함께 죽습니다.'},
  tanner:{name:'무두장이',emoji:'🪓',team:'개인',max:1,desc:'어느 팀에도 속하지 않으며 자신이 죽어야 승리합니다.'},
  villager:{name:'주민',emoji:'🏠',team:'마을팀',max:3,desc:'밤 행동은 없습니다. 토론과 추리로 늑대를 찾아야 합니다.'}
};

let state = {
  room:null,
  myId:null,
  role:null,
  nightPrompt:null,
  nightReveal:null,
  result:null,
  selected:[],
  voted:null,
  narrationEnabled:null,
  seerMode:null
};
let timerInt = null;
let wakeLock = null;

async function requestHostWakeLock(){
  if(!isHost() || !('wakeLock' in navigator)) return;
  try{
    if(!wakeLock) wakeLock = await navigator.wakeLock.request('screen');
  }catch(_){ /* Unsupported/denied: game still works without it. */ }
}
async function releaseHostWakeLock(){
  try{ if(wakeLock) await wakeLock.release(); }catch(_){}
  wakeLock = null;
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && isHost() && ['roleReveal','night'].includes(state.room?.phase)) requestHostWakeLock();
});

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function me(){return state.room?.players.find(p=>p.id===state.myId)}
function isHost(){return state.room?.hostId===state.myId}
function shell(inner){return `<div class="shell">${inner}</div>`}
function topbar(){return state.room?`<div class="topbar"><span class="badge">🌙 한밤의 늑대인간</span><div class="room-tools">${isHost()?'<button class="room-close-button" data-close-room aria-label="방 종료">종료</button>':''}<span class="smallcode">${state.room.code}</span><button class="info-button" data-role-guide aria-label="모든 캐릭터 능력 안내">ⓘ</button></div></div>`:''}


function openRoleGuide(){
  const dialog=document.getElementById('roleGuide');
  const notes={
    doppelganger:'복사한 역할의 승리 조건을 따릅니다. 예언자·강도·말썽쟁이·주정뱅이를 복사하면 즉시 행동하고, 늑대·석공은 해당 순서에 함께 확인합니다. 하수인은 별도로 늑대를 확인하고 불면증은 일반 불면증 뒤에 확인합니다.',
    werewolf:'혼자 깨어난 늑대는 방의 선택 규칙이 켜져 있을 때 가운데 카드 1장을 볼 수 있습니다.',
    minion:'플레이어 중 늑대가 있으면 늑대가 죽지 않아야 승리하며 하수인 자신은 죽어도 됩니다. 늑대가 없으면 하수인 이외의 누군가가 죽어야 승리합니다. 무두장이 승리가 우선 적용됩니다.',
    robber:'새 역할의 승리 조건을 따르지만 그 역할의 밤 행동을 추가로 하지 않습니다.',
    insomniac:'확인한 최종 카드의 승리 조건을 따릅니다.',
    hunter:'사냥꾼 효과는 투표 종료 시 최종 카드가 사냥꾼인 사람에게 적용됩니다.',
    tanner:'늑대와 함께 죽으면 마을팀과 동시에 승리할 수 있습니다.'
  };
  document.getElementById('roleGuideContent').innerHTML=`<p class="hint">전체 캐릭터 안내입니다. 누가 어떤 역할인지 공개하지 않습니다. 밤에는 자기 차례에만 화면을 확인하세요.</p><p class="hint">능력은 시작 역할로 행동하고, 승패는 밤이 끝난 뒤 최종 카드로 결정됩니다. 마을팀은 늑대가 죽으면 승리합니다. 플레이어 중 늑대가 없으면 아무도 죽지 않아야 승리합니다. 무두장이가 죽으면 무두장이 승리가 우선입니다.</p><p class="hint">밤 순서: 도플갱어 → 늑대인간 → 하수인 → 석공 → 예언자 → 강도 → 말썽쟁이 → 주정뱅이 → 불면증 환자</p>${Object.entries(ROLE_INFO).map(([key,r])=>`<details class="guide-role"><summary>${r.emoji} ${r.name} <span class="muted">· ${r.team}</span></summary><p>${r.desc}</p>${notes[key]?`<p>${notes[key]}</p>`:''}</details>`).join('')}`;
  dialog.showModal();
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-role-guide]')) openRoleGuide();});

function ensureNarrationDefault(){
  if(isHost()){
    state.narrationEnabled = true;
    return;
  }
  if(state.narrationEnabled !== null) return;
  const saved=localStorage.getItem('mw_guest_narration');
  state.narrationEnabled = saved === '1';
}
function setNarrationEnabled(on){
  if(isHost() && !on){
    state.narrationEnabled=true;
    return toast('방장 폰은 밤 진행 동기화를 위해 나레이션을 켜둡니다.');
  }
  state.narrationEnabled=!!on;
  localStorage.setItem('mw_guest_narration',state.narrationEnabled?'1':'0');
  if(!state.narrationEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
function koreanVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices=window.speechSynthesis.getVoices?.()||[];
  return voices.find(v=>String(v.lang||'').toLowerCase().startsWith('ko')) || null;
}
function estimatedSpeechMs(text){return Math.max(1800,Math.min(12000,800+String(text||'').length*105))}
function speakNarration(text,{test=false}={}){
  return new Promise(resolve=>{
    if(!text){resolve();return;}
    if(!test && !state.narrationEnabled){setTimeout(resolve,estimatedSpeechMs(text));return;}
    if(!('speechSynthesis' in window)){
      if(test) toast('이 브라우저는 음성 나레이션을 지원하지 않습니다.');
      setTimeout(resolve,estimatedSpeechMs(text));
      return;
    }
    const u=new SpeechSynthesisUtterance(String(text));
    u.lang='ko-KR';u.rate=1.15;u.pitch=1;u.volume=1;
    const v=koreanVoice();if(v)u.voice=v;
    let done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(fallback);resolve();};
    const fallback=setTimeout(()=>{window.speechSynthesis.cancel();finish();},60000);
    u.onend=finish;u.onerror=finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}
function primeNarration(){
  if(!state.narrationEnabled || !('speechSynthesis' in window)) return;
  const u=new SpeechSynthesisUtterance(' ');u.lang='ko-KR';u.volume=.01;u.rate=1;
  window.speechSynthesis.speak(u);
}

function renderHome(){
  clearInterval(timerInt);
  app.innerHTML=shell(`
    <div class="brand"><div class="moon">🌕🐺</div><h1>한밤의 늑대인간</h1><div class="subtitle">친구들끼리 각자 휴대폰으로 한 판</div></div>
    <div class="card"><h2>게임 시작</h2>
      <input id="name" class="input" maxlength="12" placeholder="닉네임" autocomplete="off" />
      <button id="create" class="btn">방 만들기</button>
      <div class="divider"></div>
      <input id="code" class="input" maxlength="4" placeholder="방 코드 4자리" autocomplete="off" autocapitalize="characters" />
      <button id="join" class="btn secondary">방 참가하기</button>
    </div>
    <div class="card"><div class="hint"><b>역할 확인 → 밤 행동 → 토론 → 투표</b> 한 번으로 한 판이 끝납니다.<br>밤에는 자기 역할이 불릴 때만 눈을 뜨고 자기 화면만 확인하세요.</div></div>
  `);
  document.getElementById('create').onclick=()=>{
    const name=document.getElementById('name').value.trim();if(!name)return toast('닉네임을 입력하세요.');
    socket.emit('room:create',{name},res=>{
      if(!res?.ok)return toast(res?.error||'방을 만들 수 없습니다.');
      state.myId=res.playerId;localStorage.setItem('mw_name',name);localStorage.setItem('mw_room',res.code);localStorage.setItem('mw_token',res.resumeToken);
    });
  };
  document.getElementById('join').onclick=()=>{
    const name=document.getElementById('name').value.trim(),code=document.getElementById('code').value.trim();
    if(!name||code.length!==4)return toast('닉네임과 방 코드 4자리를 입력하세요.');
    socket.emit('room:join',{name,code},res=>{
      if(!res?.ok)return toast(res?.error||'방에 들어갈 수 없습니다.');
      state.myId=res.playerId;localStorage.setItem('mw_name',name);localStorage.setItem('mw_room',res.code);localStorage.setItem('mw_token',res.resumeToken);
    });
  };
  document.getElementById('name').value=localStorage.getItem('mw_name')||'';
  const inviteMatch=window.location?.search?.match(/[?&]room=([A-Z0-9]{4})(?:&|$)/i);
  if(inviteMatch)document.getElementById('code').value=inviteMatch[1].toUpperCase();
  document.getElementById('code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
}

function countRoles(roles){const c={};roles.forEach(r=>c[r]=(c[r]||0)+1);return c}

function resetToHome(){
  clearInterval(timerInt);localStorage.removeItem('mw_room');localStorage.removeItem('mw_token');
  releaseHostWakeLock();if('speechSynthesis' in window)window.speechSynthesis.cancel();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  state.room=null;state.role=null;state.nightPrompt=null;state.nightReveal=null;state.result=null;state.selected=[];state.voted=null;state.narrationEnabled=null;
  renderHome();
}
document.addEventListener('click',e=>{
  if(!e.target.closest?.('[data-close-room]') || !isHost())return;
  document.getElementById('closeRoomDialog').showModal();
  document.getElementById('confirmCloseRoom').onclick=()=>socket.emit('room:close',{},res=>{if(!res?.ok)toast(res?.error||'방을 종료할 수 없습니다.');});
});
socket.on('room:closed',payload=>{resetToHome();toast(payload?.message||'방이 종료되었습니다.');});

function leaveRoom(){
  socket.emit('room:leave',{},res=>{
    if(!res?.ok)return toast(res?.error||'방을 나갈 수 없습니다.');
    resetToHome();
  });
}
function renderLobby(){
  clearInterval(timerInt);
  ensureNarrationDefault();
  const room=state.room,counts=countRoles(room.selectedRoles||[]),need=room.playerCount+3,selected=(room.selectedRoles||[]).length;
  const roleControls=Object.entries(ROLE_INFO).map(([key,r])=>{
    const n=counts[key]||0;
    return `<div class="role-pick"><div class="emoji">${r.emoji}</div><div class="role-meta"><div class="name">${r.name}</div><div class="count">${n} / ${r.max}</div></div>${isHost()?`<button class="mini-btn" data-minus="${key}" ${n===0?'disabled':''}>−</button><button class="mini-btn" data-plus="${key}" ${n>=r.max||selected>=need?'disabled':''}>＋</button>`:''}</div>`;
  }).join('');

  app.innerHTML=shell(`${topbar()}
    <div class="card"><button id="leave" class="btn secondary">← 나가기 · 처음으로</button><h2>대기방</h2><div class="codebox"><div class="muted">방 코드</div><div class="code">${room.code}</div><div class="host-note">친구들에게 이 코드만 알려주세요.</div><button id="invite" class="btn secondary">🔗 친구 초대 · 링크 / QR</button></div>
      ${room.players.map(p=>`<div class="player"><div><span class="dot ${p.connected?'':'off'}"></span><span class="player-name">${esc(p.name)}</span>${p.bot?' <span class="badge">🤖 봇</span>':''}${p.id===room.hostId?' <span class="badge">방장</span>':''}</div>${isHost()&&p.bot?`<button class="mini-btn" data-remove-bot="${p.id}" aria-label="${esc(p.name)} 삭제">삭제</button>`:''}</div>`).join('')}
      ${isHost()?`<div class="row"><button id="addBot" class="btn secondary" ${room.players.length>=room.playerCount?'disabled':''}>🤖 봇 1명 추가</button><button id="fillBots" class="btn secondary" ${room.players.length>=room.playerCount?'disabled':''}>빈 자리 봇으로 채우기</button></div>`:''}
      ${isHost()?`<label class="option-line"><input id="fastBots" type="checkbox" ${room.fastBots?'checked':''}> ⚡ 혼자 봇 테스트 빠른 진행</label><div class="hint">사람 1명 + 봇일 때 적용됩니다. 음성·밤 대기를 생략하고 봇은 즉시 행동합니다. 토론은 3초 후 자동 종료됩니다. 내 행동과 확인은 직접 완료해야 합니다.</div>`:''}<div class="hint">테스트용 봇은 역할 확인·밤 행동·투표를 자동으로 합니다. 행동과 투표는 무작위이며, 추리 대화는 하지 않습니다.</div>
    </div>
    <div class="card"><h2>참가 인원</h2>
      ${isHost()?`<select id="playerCount" class="input">${Array.from({length:8},(_,i)=>i+3).map(n=>`<option value="${n}" ${n<room.players.length?'disabled':''}>${n}명</option>`).join('')}</select>`:`<div>${room.playerCount}명</div>`}
      <div class="hint">현재 ${room.players.length} / ${room.playerCount}명 입장 · 모두 접속하면 시작할 수 있습니다.<br>역할은 참가자 ${room.playerCount}장 + 가운데 3장 = 총 ${need}장을 선택하세요.</div>
      <div class="section-title">토론 시간</div>
      ${isHost()?`<select id="discussion" class="input" aria-label="토론 시간">${[1,2,3,4,5,7,10].map(m=>`<option value="${m*60}">${m}분</option>`).join('')}</select>`:`<div>${Math.round((room.discussionSeconds||240)/60)}분 · 방장이 설정</div>`}
    </div><div class="card"><h2>역할 구성</h2>${isHost()?'<div class="row"><button id="presetBeginner" class="btn secondary">🌱 초보 추천</button><button id="presetChaos" class="btn secondary">🌀 혼돈 추천</button></div><div class="hint">선택한 인원에 맞춰 전체 구성을 바꿉니다. 초보는 기본 추리 중심, 혼돈은 도플갱어·카드 교환 중심입니다.</div>':''}<div class="role-grid">${roleControls}</div><div class="counter ${selected===need?'':'bad'}">${selected} / ${need}장</div>
      <div class="hint">석공을 쓰면 2장을 모두 넣어야 합니다. 불면증 환자는 강도 또는 말썽쟁이와 함께 사용하는 공식 구성을 따릅니다.</div>
      <div class="section-title">밤 나레이션</div>
      <div class="hint">방장 폰의 음성이 밤 순서와 동기화됩니다. 다른 폰의 음성은 필요할 때만 보조로 켜세요.</div>
      <div class="row"><button id="narrationToggle" class="btn secondary">${state.narrationEnabled?'🔊 이 폰 나레이션 켜짐':'🔇 이 폰 나레이션 꺼짐'}</button><button id="narrationTest" class="btn secondary">음성 테스트</button></div>
      ${isHost()?`
        <div class="section-title">공식 선택 규칙</div>
        <label class="option-line"><input id="loneWolf" type="checkbox" ${room.loneWolfCenter?'checked':''}> 외로운 늑대가 가운데 카드 1장을 볼 수 있게 하기</label>
        <button id="start" class="btn" ${selected!==need||room.players.length!==room.playerCount||room.players.some(p=>!p.connected)?'disabled':''}>게임 시작</button>
      `:`<div class="hint center">방장이 역할을 정하고 있습니다.</div>`}
    </div>`);

  document.getElementById('leave').onclick=leaveRoom;
  document.getElementById('invite').onclick=openInvite;
  document.getElementById('narrationToggle').onclick=()=>{setNarrationEnabled(!state.narrationEnabled);renderLobby();};
  document.getElementById('narrationTest').onclick=()=>{setNarrationEnabled(true);primeNarration();speakNarration('나레이션 테스트입니다. 밤에는 자신의 역할이 호명될 때만 눈을 뜨세요.',{test:true});renderLobby();};
  if(isHost()){
    document.getElementById('fastBots').onchange=e=>socket.emit('room:setFastBots',{enabled:e.target.checked},res=>{if(!res?.ok)toast(res?.error);});
    document.getElementById('presetBeginner').onclick=()=>socket.emit('room:setPreset',{mode:'beginner'},res=>{if(!res?.ok)toast(res?.error);});
    document.getElementById('presetChaos').onclick=()=>socket.emit('room:setPreset',{mode:'chaos'},res=>{if(!res?.ok)toast(res?.error);});
    const botRequest=(event,payload)=>socket.emit(event,payload,res=>{if(!res?.ok)toast(res?.error||'봇 설정을 변경할 수 없습니다.');});
    document.getElementById('addBot').onclick=()=>botRequest('room:addBot',{});
    document.getElementById('fillBots').onclick=()=>botRequest('room:addBot',{fill:true});
    document.querySelectorAll('[data-remove-bot]').forEach(b=>b.onclick=()=>botRequest('room:removeBot',{playerId:b.dataset.removeBot}));
    document.getElementById('playerCount').value=String(room.playerCount);
    document.getElementById('playerCount').onchange=e=>socket.emit('room:setPlayerCount',{count:Number(e.target.value)},res=>{if(!res?.ok){toast(res?.error);renderLobby();}});
    document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>adjustRole(b.dataset.plus,1));
    document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>adjustRole(b.dataset.minus,-1));
    document.getElementById('discussion').value=String(room.discussionSeconds||240);
    document.getElementById('discussion').onchange=e=>socket.emit('room:setDiscussion',{seconds:Number(e.target.value)});
    document.getElementById('loneWolf').onchange=e=>socket.emit('room:setLoneWolf',{enabled:e.target.checked});
    document.getElementById('start').onclick=()=>{primeNarration();requestHostWakeLock();socket.emit('game:start',{},res=>{if(!res?.ok)toast(res?.error||'게임을 시작할 수 없습니다.')});};
  }
}
function adjustRole(role,delta){
  const roles=[...(state.room.selectedRoles||[])];
  if(delta>0)roles.push(role);else{const i=roles.lastIndexOf(role);if(i>=0)roles.splice(i,1)}
  socket.emit('room:setRoles',{roles},res=>{if(!res?.ok)toast(res?.error||'역할을 변경할 수 없습니다.')});
}

function roleTeamText(role){return role.team==='wolf'?'늑대팀':role.team==='tanner'?'개인 역할':role.team==='dynamic'?'복사한 역할에 따라 결정':'마을팀'}
function renderRoleReveal(){
  if(!state.role)return renderWaiting('역할을 배분하고 있습니다…');
  ensureNarrationDefault();
  app.innerHTML=shell(`${topbar()}<div class="card"><div class="center muted">당신의 시작 카드</div><div class="role-card"><div class="bigemoji">${state.role.emoji}</div><div class="rolename">${state.role.name}</div><div class="team">${roleTeamText(state.role)}</div></div><div class="role-desc">${esc(ROLE_INFO[state.role.role]?.desc||'')}</div><div class="hint center">확인했으면 휴대폰을 가리고 준비를 누르세요.<br>${isHost()?'🔊 방장 폰이 공용 나레이션과 밤 순서를 동기화합니다.':state.narrationEnabled?'🔊 이 폰에서도 보조 나레이션이 재생됩니다.':'🔇 이 폰은 보조 나레이션을 재생하지 않습니다.'}</div><button id="ready" class="btn">확인 완료 · 밤 시작 준비</button></div>`);
  const ready=document.getElementById('ready');
  if(state.room.readyIds?.includes(state.myId)){ready.disabled=true;ready.textContent='다른 사람 기다리는 중…';}
  ready.onclick=e=>{primeNarration();e.target.disabled=true;e.target.textContent='다른 사람 기다리는 중…';socket.emit('role:ready');};
}
function renderWaiting(msg='밤이 진행 중입니다…'){
  app.innerHTML=shell(`${topbar()}<div class="waiting"><div class="spinner">🌙</div><h2>${esc(msg)}</h2><div class="hint">눈을 감고 다른 사람 화면을 보지 마세요.</div></div>`);
}

function actionRoleOf(p){return p.actionRole||p.role}
function roleIcons(p){return p.copiedEmoji?`${p.emoji} <span class="copy-arrow">→</span> ${p.copiedEmoji}`:p.emoji}
function playerChoices(players,max){return `<div class="choice-list">${players.map(x=>`<button class="choice" data-player="${x.id}">${esc(x.name)}</button>`).join('')}</div><div class="counter">${max===2?'2명 선택':'1명 선택'}</div>`}
function centerButtons(max){return `<div class="center-cards">${[0,1,2].map(i=>`<button class="center-card" data-center="${i}">?</button>`).join('')}</div><div class="counter">${max===2?'2장 선택':'1장 선택'}</div>`}

function renderNight(){
  const p=state.nightPrompt;
  if(!p)return renderWaiting();
  state.selected=[];state.seerMode=null;
  const actionRole=actionRoleOf(p);
  let extra='';

  if(p.role==='doppelganger' && p.stage==='copy'){
    extra=`<div class="hint">${esc(p.instructions)}</div>${playerChoices(p.others,1)}`;
  } else if(actionRole==='werewolf'){
    if(p.solo && p.loneWolfCenter) extra=`<div class="hint">${esc(p.instructions)}</div>${centerButtons(1)}`;
    else extra=`<div class="hint">${esc(p.instructions)}</div><div class="result-banner">${p.mates?.length?'🐺 '+p.mates.map(x=>esc(x.name)).join(', '):'함께 깨어난 다른 늑대가 없습니다.'}</div>`;
  } else if(actionRole==='minion'){
    extra=`<div class="hint">${esc(p.instructions)}</div><div class="result-banner">${p.wolves?.length?'🐺 '+p.wolves.map(x=>esc(x.name)).join(', '):'플레이어 중 늑대인간이 없습니다.'}</div>`;
  } else if(actionRole==='mason'){
    extra=`<div class="hint">${esc(p.instructions)}</div><div class="result-banner">${p.mates?.length?'🧱 '+p.mates.map(x=>esc(x.name)).join(', '):'함께 깨어난 다른 석공이 없습니다.'}</div>`;
  } else if(actionRole==='seer'){
    extra=`<div class="hint">${esc(p.instructions)}</div><div class="row"><button id="seerPlayer" class="btn secondary">플레이어 1명</button><button id="seerCenter" class="btn secondary">가운데 2장</button></div><div id="seerChoices"></div>`;
  } else if(actionRole==='robber'){
    extra=`<div class="hint">${esc(p.instructions)}</div>${playerChoices(p.others,1)}`;
  } else if(actionRole==='troublemaker'){
    extra=`<div class="hint">${esc(p.instructions)}</div>${playerChoices(p.others,2)}`;
  } else if(actionRole==='drunk'){
    extra=`<div class="hint">${esc(p.instructions)}</div>${centerButtons(1)}`;
  } else if(actionRole==='insomniac'){
    extra=`<div class="hint">${esc(p.instructions)}</div><div class="result-banner">현재 보이는 카드: ${p.currentCard.emoji} ${esc(p.currentCard.name)}</div>`;
  }

  app.innerHTML=shell(`${topbar()}<div class="card"><div class="center muted">밤 행동</div><div class="role-card compact"><div class="bigemoji compact-emoji">${roleIcons(p)}</div><div class="rolename compact-name">${esc(p.roleName)}</div></div>${extra}<button id="act" class="btn">${nightButtonText(p)}</button>${p.skipAllowed?'<button id="skip" class="btn ghost">이번 행동 건너뛰기</button>':''}</div>`);
  setupNightSelectors(p);
  document.getElementById('act').onclick=()=>submitNight(p,false);
  if(p.skipAllowed)document.getElementById('skip').onclick=()=>submitNight(p,true);
  updateActButton(p);
}
function nightButtonText(p){
  if(p.role==='doppelganger'&&p.stage==='copy')return '카드 확인 · 역할 복사';
  const r=actionRoleOf(p);
  if(['minion','mason','insomniac'].includes(r))return '확인 완료';
  if(r==='werewolf'&&!(p.solo&&p.loneWolfCenter))return '확인 완료';
  if(r==='seer')return '선택한 카드 확인';
  if(r==='robber')return '카드 교환 후 확인';
  if(r==='troublemaker')return '두 카드 교환';
  if(r==='drunk')return '가운데 카드와 교환';
  return '행동 완료';
}
function setupNightSelectors(p){
  const actionRole=actionRoleOf(p);
  const playerMax=(p.role==='doppelganger'&&p.stage==='copy')?1:(actionRole==='troublemaker'?2:1);
  const centerMax=actionRole==='seer'?2:1;
  document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{selectEl(b,'player',playerMax);updateActButton(p)});
  document.querySelectorAll('[data-center]').forEach(b=>b.onclick=()=>{selectEl(b,'center',centerMax);updateActButton(p)});
  if(actionRole==='seer'){
    document.getElementById('seerPlayer').onclick=()=>{
      state.selected=[];state.seerMode='player';
      document.getElementById('seerChoices').innerHTML=playerChoices(p.others,1);
      setupNightSelectors(p);updateActButton(p);
    };
    document.getElementById('seerCenter').onclick=()=>{
      state.selected=[];state.seerMode='center';
      document.getElementById('seerChoices').innerHTML=centerButtons(2);
      setupNightSelectors(p);updateActButton(p);
    };
  }
}
function selectEl(b,type,max){
  const val=type==='player'?b.dataset.player:Number(b.dataset.center);
  const idx=state.selected.findIndex(x=>x.type===type&&x.val===val);
  if(idx>=0){state.selected.splice(idx,1);b.classList.remove('selected');return;}
  if(state.selected.filter(x=>x.type===type).length>=max){
    const old=state.selected.find(x=>x.type===type);
    state.selected=state.selected.filter(x=>x!==old);
    const oldEl=type==='player'?document.querySelector(`[data-player="${old.val}"]`):document.querySelector(`[data-center="${old.val}"]`);
    oldEl?.classList.remove('selected');
  }
  state.selected.push({type,val});b.classList.add('selected');
}
function updateActButton(p){
  const btn=document.getElementById('act');if(!btn)return;
  const r=actionRoleOf(p),pc=state.selected.filter(x=>x.type==='player').length,cc=state.selected.filter(x=>x.type==='center').length;
  let ok=true;
  if(p.role==='doppelganger'&&p.stage==='copy')ok=pc===1;
  else if(r==='seer')ok=(state.seerMode==='player'&&pc===1)||(state.seerMode==='center'&&cc===2);
  else if(r==='robber')ok=pc===1;
  else if(r==='troublemaker')ok=pc===2;
  else if(r==='drunk')ok=cc===1;
  else if(r==='werewolf'&&p.solo&&p.loneWolfCenter)ok=cc===1;
  btn.disabled=!ok;
}
function submitNight(p,skip){
  const btn=document.getElementById('act');
  if(btn)btn.disabled=true;
  const targets=state.selected.filter(x=>x.type==='player').map(x=>x.val);
  const centerIndexes=state.selected.filter(x=>x.type==='center').map(x=>x.val);
  const actionRole=actionRoleOf(p);
  const type=actionRole==='seer'?state.seerMode:null;
  socket.emit('night:action',{type,targets,centerIndexes,skip:!!skip},res=>{
    if(!res?.ok){if(btn)btn.disabled=false;return toast(res?.error||'선택을 확인하세요.');}
    state.nightPrompt=null;
    if(res.requiresAck || res.seen?.length || res.extraText){
      renderNightReveal(res);
    } else {
      renderWaiting('행동 완료. 눈을 감고 기다려주세요.');
    }
  });
}
function renderNightReveal(payload){
  state.nightReveal=payload;
  const cards=(payload.seen||[]).map(x=>`<div class="seen-card"><div class="seen-emoji">${x.emoji}</div><div>${esc(x.name)}</div></div>`).join('');
  app.innerHTML=shell(`${topbar()}<div class="card"><div class="center muted">확인 결과</div>${cards?`<div class="seen-grid">${cards}</div>`:''}${payload.extraText?`<div class="result-banner">${esc(payload.extraText)}</div>`:''}<div class="hint center">이 정보는 본인만 확인하세요.</div><button id="ackReveal" class="btn">${payload.nextPrompt?'복사한 역할 행동하기':'확인 완료 · 눈 감기'}</button></div>`);
  document.getElementById('ackReveal').onclick=()=>{state.nightReveal=null;state.nightPrompt=null;renderWaiting('밤이 계속 진행 중입니다…');socket.emit('night:ack');};
}

function renderDiscussion(){
  clearInterval(timerInt);
  releaseHostWakeLock();
  const room=state.room;
  const rc=countRoles(room.selectedRoles||[]);
  const roleSummary=Object.entries(ROLE_INFO).filter(([k])=>rc[k]).map(([k,r])=>`<span class="role-token">${r.emoji} ${r.name}${rc[k]>1?` ×${rc[k]}`:''}</span>`).join('');
  app.innerHTML=shell(`${topbar()}<div class="card"><div class="center muted">낮 · 토론</div><div id="timer" class="timer">--:--</div><div class="hint center">밤에 확인한 정보와 거짓말을 이용해 최종 카드의 늑대를 찾아내세요. 밤이 끝난 뒤에는 카드를 다시 볼 수 없습니다.</div><div class="role-tokens">${roleSummary}</div>${isHost()?'<button id="voteNow" class="btn secondary">토론 종료 · 바로 투표</button>':''}</div><div class="card"><h2>참가자</h2>${room.players.map(p=>`<div class="player"><span class="player-name">${esc(p.name)}</span></div>`).join('')}</div>`);
  const timer=document.getElementById('timer');
  const tick=()=>{const ms=Math.max(0,(room.discussionEndsAt||Date.now())-Date.now()),s=Math.ceil(ms/1000),m=Math.floor(s/60),ss=s%60;timer.textContent=`${m}:${String(ss).padStart(2,'0')}`;timer.classList.toggle('warn',s<=30)};
  tick();timerInt=setInterval(tick,250);
  if(isHost())document.getElementById('voteNow').onclick=()=>socket.emit('discussion:endEarly');
}

function renderVoting(){
  clearInterval(timerInt);
  const room=state.room,self=me(),already=!!self?.voted;
  const options=room.players.filter(p=>p.id!==state.myId);
  app.innerHTML=shell(`${topbar()}<div class="card"><div class="center muted">최종 투표</div><h2 class="center">누구를 지목할까?</h2><div class="hint center">공식 규칙대로 <b>자기 자신에게는 투표할 수 없습니다.</b><br>최다 득표자가 죽고 최다 득표가 동률이면 모두 죽습니다. 최고 득표가 1표뿐이면 아무도 죽지 않습니다.</div><div class="vote-grid">${options.map(p=>`<button class="vote ${state.voted===p.id?'selected':''}" data-vote="${p.id}" ${already?'disabled':''}>${esc(p.name)}</button>`).join('')}</div><button id="cast" class="btn" ${already||!state.voted?'disabled':''}>${already?'투표 완료 · 결과 기다리는 중':'투표 확정'}</button><div class="counter">${room.players.filter(p=>p.voted).length} / ${room.players.length}명 투표 완료</div></div>`);
  if(!already){
    document.querySelectorAll('[data-vote]').forEach(b=>b.onclick=()=>{state.voted=b.dataset.vote;renderVoting();});
    document.getElementById('cast').onclick=()=>socket.emit('vote:cast',{targetId:state.voted},res=>{if(!res?.ok)toast(res?.error||'투표할 수 없습니다.');else toast('투표 확정!');});
  }
}


function openInvite(){
  const link=window.location.origin+'/?room='+encodeURIComponent(state.room.code);
  const dialog=document.getElementById('inviteDialog');
  document.getElementById('inviteLink').value=link;
  const qr=document.getElementById('inviteQR');qr.innerHTML='';
  new QRCode(qr,{text:link,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});
  document.getElementById('copyInvite').onclick=async()=>{
    try{await navigator.clipboard.writeText(link);toast('초대 링크를 복사했습니다.');}
    catch(_){document.getElementById('inviteLink').select();toast('주소를 길게 눌러 복사해주세요.');}
  };
  document.getElementById('shareInvite').onclick=async()=>{
    if(!navigator.share){document.getElementById('copyInvite').click();return;}
    try{await navigator.share({title:'한밤의 늑대인간',text:'방 '+state.room.code+'에 들어오세요!',url:link});}catch(_){}
  };
  dialog.showModal();
}
function historyFace(card){
  return '<span class="history-emoji">'+esc(card?.physicalEmoji||card?.emoji||'🃏')+'</span><strong>'+esc(card?.displayName||card?.name||'카드')+'</strong>';
}
function historySeat(name,before,after){
  return `<div class="history-seat"><div class="history-person">${esc(name)}</div><div class="history-before">교환 전 · ${esc(before?.displayName||before?.name||'카드')}</div><div class="history-down" aria-hidden="true">↓</div><div class="history-after">${historyFace(after)}</div><div class="history-caption">교환 후 받은 카드</div></div>`;
}
function historyHtml(history){
  return '<div class="card history-panel"><h2>밤에 카드가 이렇게 바뀌었어요</h2><p class="hint">위에서 아래로 실제 행동 순서입니다. 큰 카드가 각 행동 직후 받은 카드예요.</p>'+(history.length?'<div class="history-timeline">'+history.map((h,i)=>{
    const head=`<div class="history-head"><span class="history-number">${i+1}</span><div><strong>${esc(h.actor)}</strong><span class="history-action">${h.kind==='copy'?'🪞 도플갱어 · 역할 복사':esc(h.role)+' · 카드 교환'}</span></div></div>`;
    if(h.kind==='copy')return `<section class="history-step">${head}<div class="history-copy"><div class="history-person">${esc(h.target)}의 역할을 복사</div><div class="history-after">${historyFace({emoji:ROLE_INFO[Object.keys(ROLE_INFO).find(k=>ROLE_INFO[k].name===h.role)]?.emoji,name:h.role})}</div><p class="history-caption">카드는 그대로 · 능력과 승리 조건만 복사</p></div></section>`;
    return `<section class="history-step">${head}<div class="history-swap">${historySeat(h.a,h.cardA,h.cardB)}<span class="history-exchange" aria-label="서로 교환">⇄</span>${historySeat(h.b,h.cardB,h.cardA)}</div></section>`;
  }).join('')+'</div>':'<div class="history-empty">🌙<p>이번 밤에는 카드를 바꾸거나<br>역할을 복사한 사람이 없어요.</p></div>')+'</div>';
}

function finalRoleHtml(f){
  if(f?.physicalRole==='doppelganger'&&f?.copiedRole)return `${f.physicalEmoji} 도플갱어 <span class="arrow">→</span> ${f.emoji} ${esc(f.name)}`;
  return `${f?.emoji||''} ${esc(f?.name||'')}`;
}
function renderResult(){
  clearInterval(timerInt);
  releaseHostWakeLock();
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  const r=state.result;if(!r)return;
  const byId=new Map(r.players.map(p=>[p.id,p.name]));
  app.innerHTML=shell(`${topbar()}<button id="leave" class="btn secondary">← 나가기 · 처음으로</button><div class="result-banner">${esc(r.winnerText)}</div><div class="card"><h2>최종 공개</h2>${r.players.map(p=>`<div class="reveal-row ${r.killedIds.includes(p.id)?'dead':''}"><div class="reveal-name">${esc(p.name)} ${r.winnerIds?.includes(p.id)?'<span class="winner">승리</span>':''} ${r.killedIds.includes(p.id)?'<span class="killed">죽음</span>':''}</div><div class="reveal-role">시작: ${p.initial.emoji} ${esc(p.initial.name)}<br>최종: ${finalRoleHtml(p.final)}<br><span class="muted">투표 → ${esc(byId.get(p.vote)||'-')}</span></div></div>`).join('')}<div class="section-title">가운데 카드</div><div class="center-cards">${r.center.map(c=>`<div class="center-card final-card">${finalRoleHtml(c)}</div>`).join('')}</div>${isHost()?'<button id="again" class="btn">같은 역할 구성으로 다시하기</button>':'<div class="hint center">방장이 다음 판을 시작할 수 있습니다.</div>'}</div>${historyHtml(r.history||[])}`);
  document.getElementById('leave').onclick=leaveRoom;
  if(isHost())document.getElementById('again').onclick=()=>socket.emit('game:restart');
}

function render(){
  if(!state.room)return renderHome();
  switch(state.room.phase){
    case 'lobby':return renderLobby();
    case 'roleReveal':return renderRoleReveal();
    case 'night':return state.nightReveal?renderNightReveal(state.nightReveal):state.nightPrompt?renderNight():renderWaiting();
    case 'discussion':return renderDiscussion();
    case 'voting':return renderVoting();
    case 'result':return renderResult();
  }
}

socket.on('narration:say',payload=>{
  if(payload?.fast){if('speechSynthesis' in window)window.speechSynthesis.cancel();return;}
  ensureNarrationDefault();
  if(isHost()){
    speakNarration(payload?.text||'').then(()=>socket.emit('narration:done',{cueId:payload?.cueId}));
  }else if(state.narrationEnabled){
    speakNarration(payload?.text||'');
  }
});
socket.on('room:update',room=>{
  const wasNight=state.room?.phase==='night';
  state.room=room;ensureNarrationDefault();
  if(room.phase!=='night'){state.nightPrompt=null;state.nightReveal=null;}
  if(wasNight&&room.phase==='night'&&(state.nightPrompt||state.nightReveal))return;
  render();
});
socket.on('role:reveal',role=>{state.role=role;state.nightPrompt=null;state.nightReveal=null;state.result=null;state.voted=null;render();});
socket.on('night:waiting',({message})=>{state.nightPrompt=null;state.nightReveal=null;renderWaiting(message);});
socket.on('night:prompt',prompt=>{state.nightReveal=null;state.nightPrompt=prompt;renderNight();});
socket.on('night:reveal',payload=>{state.nightPrompt=null;renderNightReveal(payload);});
socket.on('night:done',()=>{state.nightPrompt=null;state.nightReveal=null;});
socket.on('discussion:start',()=>{state.nightPrompt=null;});
socket.on('voting:start',()=>{state.voted=null;});
socket.on('game:result',r=>{state.result=r;renderResult();});
socket.on('game:reset',()=>{releaseHostWakeLock();if('speechSynthesis' in window)window.speechSynthesis.cancel();state.role=null;state.result=null;state.nightPrompt=null;state.nightReveal=null;state.voted=null;});
socket.on('connect',()=>{
  state.myId=socket.id;
  const code=localStorage.getItem('mw_room'),resumeToken=localStorage.getItem('mw_token');
  if(code&&resumeToken){
    socket.emit('room:resume',{code,resumeToken},res=>{
      if(res?.ok){state.myId=res.playerId;state.room=res.room;ensureNarrationDefault();render();}
      else{localStorage.removeItem('mw_room');localStorage.removeItem('mw_token');state.room=null;renderHome();}
    });
  }else renderHome();
});
socket.on('disconnect',()=>{releaseHostWakeLock();toast('서버 연결이 끊겼습니다. 재연결을 시도합니다.');});
