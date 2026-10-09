'use strict';
const el=document.getElementById('app'),overlay=document.getElementById('overlay'),toastEl=document.getElementById('toast');
const K='lexio-session-four-v1',params=new URLSearchParams(location.search);
const SUITS=['구름','별','달','해'],SYMS=['☁','★','☾','☀'];
let session=null,state=null,events=null,selected=new Set(),pending=false,toastTimer=null;
try{session=JSON.parse(localStorage.getItem(K)||'null')}catch{localStorage.removeItem(K)}
function html(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function tileInfo(id){return {id,n:Math.floor(id/4)+1,s:id%4}}
function rank(n){return n===2?13:n===1?12:n-3}
function sortIDs(ids){return [...ids].sort((a,b)=>rank(tileInfo(a).n)-rank(tileInfo(b).n)||a%4-b%4)}
function tileView(id,opts={}){
 const t=tileInfo(id),sel=selected.has(id)&&opts.selectable;
 return '<button type="button" class="tile s'+t.s+(opts.short?' short':'')+(sel?' selected':'')+'"'+(opts.selectable?' onclick="toggle('+id+')" aria-pressed="'+!!sel+'"':' disabled')+' aria-label="'+SUITS[t.s]+' '+t.n+'">'+
 '<span class="figure">'+SYMS[t.s]+'</span><span class="digit">'+t.n+'</span><span class="letter">'+SUITS[t.s]+'</span></button>';
}
function toast(msg){toastEl.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.textContent='',3300)}
function head(){return '<header class="bar"><div class="brand"><i>✦</i> LEXIO <small>· 4인 대전</small></div><button class="mini alt" onclick="showRules()">규칙</button></header>'}
function popup(markup){overlay.innerHTML='<div class="dialog">'+markup+'<button class="alt full" onclick="closeOverlay()">닫기</button></div>';overlay.hidden=false}
function closeOverlay(){overlay.hidden=true;overlay.innerHTML=''}
function showRules(){popup('<h2>렉시오 룰북 · 4인</h2>'+
 '<p>☁ 구름(가장 약함) → ★ 별 → ☾ 달 → ☀ 해(가장 강함). 숫자는 3부터 13, 그다음 1, 2가 제일 높습니다.</p>'+
 '<ul><li>4명에게 1~13, 4문양 타일을 13장씩 나눠 줍니다.</li><li>☁ 구름3을 가진 사람이 첫 선입니다. 반드시 그 타일을 낼 필요는 없습니다.</li><li>1장 싱글, 2장 페어, 3장 트리플, 5장 메이드만 낼 수 있고 <b>4장만 내는 건 불가</b>합니다.</li><li>앞 사람이 낸 것과 같은 장수의 더 높은 족보만 낼 수 있어요.</li><li>5장 서열: 스트레이트 &lt; 플러시 &lt; 풀하우스 &lt; 포카드 &lt; 스트레이트 플러시.</li><li>특수 스트레이트 최고 1·2·3·4·5, 두 번째 2·3·4·5·6, 세 번째 10·11·12·13·1.</li><li>패스해도 이후 차례에 다시 낼 수 있습니다. 다른 3명이 연속 패스하면 마지막 제출자가 선을 잡습니다.</li><li>한 명이 패를 모두 내면 즉시 라운드 종료. 남은 2 타일마다 그 사람의 남은 장수는 2배가 됩니다.</li><li>플레이어끼리 실효 남은 장수의 차이만큼 칩을 주고받습니다. 총 다섯 판 후 칩이 가장 많은 사람이 승리합니다.</li></ul>'+
 '<p class="muted">본 게임은 원작 규칙을 참고한 친구끼리 플레이용 비공식 구현입니다. 타일 그래픽은 새로 디자인했습니다.</p>')}
async function request(url,body){
 const options=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
 const resp=await fetch(url,options),data=await resp.json();
 if(!resp.ok)throw Error(data.error||'서버 오류');return data;
}
function store(payload){session={code:payload.code,token:payload.token};localStorage.setItem(K,JSON.stringify(session));history.replaceState(null,'','/?room='+payload.code);state=payload.state;connect();render()}
function connect(){if(events)events.close();if(!session)return;events=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));events.onmessage=refresh}
async function refresh(){
 if(!session||pending)return;
 try{
  const s=await request('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
  state=s;selected=new Set([...selected].filter(id=>s.hand.includes(id)));render();
 }catch(e){
  if(/인증|방을 찾지/.test(e.message)){localStorage.removeItem(K);session=null;state=null;selected.clear();events?.close();history.replaceState(null,'','/');toast('방이 초기화되어 새 방을 만들어야 해요.');render();}
 }
}
async function invoke(type,extras={}){
 if(pending||!session)return;pending=true;
 try{
  const ret=await request('/api/action',{...session,type,...extras});
  if(ret.left){localStorage.removeItem(K);session=null;state=null;selected.clear();events?.close();history.replaceState(null,'','/');}
  else{state=ret;selected.clear()}
  render();
 }catch(e){toast(e.message)}finally{pending=false}
}
async function create(e){e.preventDefault();if(pending)return;pending=true;try{store(await request('/api/create',{name:document.getElementById('newname').value}))}catch(e){toast(e.message)}finally{pending=false}}
async function join(e){e.preventDefault();if(pending)return;pending=true;try{store(await request('/api/join',{name:document.getElementById('joinname').value,code:document.getElementById('joincode').value}))}catch(e){toast(e.message)}finally{pending=false}}
function welcome(){
 return head()+'<section class="intro"><span class="pill">☁ ★ ☾ ☀</span><h1>친구와 한 판,<br>렉시오</h1><p>각자 휴대폰으로 비밀 타일을 받고,<br>정면에서 친구와 심리전을 펼쳐 보세요.</p></section>'+
 '<section class="panel"><h2>새 게임 방 만들기</h2><form onsubmit="create(event)"><label for="newname">내 닉네임</label><input class="field" id="newname" maxlength="14" autocomplete="off" placeholder="이름 입력" required><button class="full">방 생성</button></form></section>'+
 '<section class="panel"><h2>친구 방에 참가</h2><form onsubmit="join(event)"><label for="joinname">내 닉네임</label><input class="field" id="joinname" maxlength="14" autocomplete="off" placeholder="이름 입력" required><label for="joincode">5자리 방 코드</label><input class="field" id="joincode" maxlength="5" autocomplete="off" placeholder="ABCDE" value="'+html(params.get('room')||'')+'" required><button class="alt full">참가</button></form></section>';
}
function lobby(){
 const names=state.players.map((p,i)=>'<div class="person"><h3>'+html(p.name)+(state.seat===p.seat?' (나)':'')+'</h3><p>자리 '+(i+1)+' · '+(p.ready?'준비 완료 ✅':'준비 대기 ⏳')+'</p></div>').join('');
 return head()+'<section class="panel"><span class="pill">대기실 · '+state.players.length+'/4명</span><div class="invite">'+html(state.code)+'</div><button class="alt full" onclick="copyInvite()">친구에게 초대 주소 복사 <span>↗</span></button><p class="muted">4명이 입장한 뒤 모두 준비 버튼을 누르세요.</p></section>'+
 '<h2>참가자</h2><div class="players">'+names+Array.from({length:4-state.players.length},(_,i)=>'<div class="person"><h3>빈 자리</h3><p>참가 대기 중</p></div>').join('')+'</div>'+
 '<section class="panel"><p>나의 자리: '+(state.seat+1)+'번</p><button class="full" onclick="invoke(\'ready\',{ready:'+(!state.players[state.seat].ready)+'})">'+(state.players[state.seat].ready?'준비 취소':'준비 완료')+'</button>'+
 (state.isHost?'<button class="alt full" onclick="invoke(\'shuffle\')">자리 순서 섞기</button><button class="full" '+(state.players.length===4&&state.players.every(p=>p.ready)?'':'disabled')+' onclick="invoke(\'start\')">게임 시작하기</button>':'<p class="muted">방장이 게임을 시작합니다.</p>')+
 '<button class="danger full" onclick="leaveRoom()">방 나가기</button></section>';
}
function playersList(){
 return '<div class="players">'+state.players.map(p=>'<div class="person'+(p.seat===state.turn&&state.stage==='playing'?' active':'')+'"><span class="count">'+p.count+'장</span><h3>'+html(p.name)+(p.seat===state.seat?' · 나':'')+'</h3><p>💰 <span class="bal">'+p.chips+'</span>점'+(p.seat===state.turn&&state.stage==='playing'?' · <b>현재 차례</b>':'')+'</p></div>').join('')+'</div>';
}
function center(){
 const tr=state.trick;
 return '<section class="tabletop"><div class="status">'+(state.stage==='playing'?'🎲 <strong>'+html(state.players[state.turn].name)+'</strong>의 차례':'라운드 종료')+'</div>'+
 (tr?'<h2>현재 족보 · '+html(tr.name)+' ('+tr.ids.length+'장)</h2><div class="tiles">'+tr.ids.map(id=>tileView(id,{short:true})).join('')+'</div><small>'+html(state.players[tr.by].name)+'님이 낸 타일 · 연속 패스 '+state.passes+'/3</small>':
 '<h2>🟡 새 선 플레이어가 자유롭게 냅니다</h2><div class="tiles"><span class="pill">싱글 · 페어 · 트리플 · 메이드</span></div>')+'</section>';
}
function hand(){
 const mine=state.stage==='playing'&&state.turn===state.seat;
 return '<section class="panel"><div class="hand-title"><h2>내 패 <small>'+state.hand.length+'장</small></h2><span class="pill '+(mine?'mine':'')+'">'+(mine?'내 차례 · 타일 선택':'내 차례 대기')+'</span></div>'+
 '<div class="hand">'+sortIDs(state.hand).map(id=>tileView(id,{selectable:mine})).join('')+'</div>'+
 '<p class="picked">선택 '+selected.size+'장 '+(selected.size? ' · '+[...selected].map(id=>{let t=tileInfo(id);return SYMS[t.s]+t.n}).join(' '):'')+'</p>'+
 '<p class="muted">같은 장수로 더 강한 패만 낼 수 있어요. 패스해도 이후에 다시 낼 수 있어요.</p></section>';
}
function controls(){
 if(state.stage!=='playing')return'';
 const mine=state.turn===state.seat;
 return '<div class="controls">'+
 '<button class="alt" onclick="invoke(\'pass\')" '+(!mine||!state.trick||pending?'disabled':'')+'>패스</button>'+
 '<button onclick="play()" '+(!mine||![1,2,3,5].includes(selected.size)||pending?'disabled':'')+'>선택한 '+selected.size+'장 내기 →</button></div>';
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
 const summary=state.results||[];
 const sorted=[...summary].sort((a,b)=>b.chips-a.chips);
 return head()+'<div class="panel"><span class="pill">'+state.round+' / '+state.maxRounds+' 라운드 완료</span><h1>🎉 '+html(state.players[state.winner].name)+'님 승리!</h1><p>남은 타일과 숫자 2의 페널티를 반영해서 칩을 정산했어요.</p>'+
 '<div class="summary">'+summary.map(p=>'<div class="sum"><b>'+html(p.name)+(p.seat===state.seat?' · 나':'')+'</b><p class="muted">잔여 '+p.left+'장'+(p.twos?' · 2 ×'+p.twos:'')+'<br>환산 '+p.effective+'장</p><p class="'+(p.delta<0?'neg':'pos')+'">'+(p.delta>0?'+':'')+p.delta+'점</p><p><strong>누적 '+p.chips+'점</strong></p></div>').join('')+'</div>'+
 (isEnd?'<h2 style="margin-top:18px">🏆 최종 순위</h2><ol class="recent">'+sorted.map(p=>'<li>'+html(p.name)+' · '+p.chips+'점</li>').join('')+'</ol><p class="success">최종 우승: '+html(sorted[0]?.name)+'님!</p>'+
 (state.isHost?'<button class="full" onclick="invoke(\'newMatch\')">새 경기 시작</button>':'<p class="muted">방장이 다음 경기를 준비할 수 있어요.</p>'):
 (state.isHost?'<button class="full" onclick="invoke(\'nextRound\')">다음 라운드 · '+(state.round+1)+' / '+state.maxRounds+'</button>':'<p class="muted">방장이 다음 라운드를 시작하면 새 패가 배분됩니다.</p>'))+'</div>'+
 '<details class="panel"><summary>정산 기준과 규칙</summary><p class="muted">각자 남은 타일 수에 남은 숫자 2 하나당 ×2를 적용하고, 다른 모든 플레이어와 비교한 차이만큼 칩을 주고받습니다. 5라운드 또는 파산 시 경기가 끝납니다.</p></details>';
}
function render(){el.innerHTML='<div class="wrap">'+(!state?welcome():state.stage==='lobby'?lobby():state.stage==='playing'?head()+'<div class="menu"><span class="pill">'+state.round+' / '+state.maxRounds+' 라운드</span><span class="pill">방 '+html(state.code)+'</span><button class="mini alt" onclick="copyInvite()">초대</button></div>'+playersList()+center()+hand()+controls()+historyList():result())+'</div>'}
async function copyInvite(){if(!state)return;const url=location.origin+'/?room='+state.code;try{await navigator.clipboard.writeText(url);toast('초대 주소를 복사했어요.')}catch{prompt('초대 주소를 복사하세요.',url)}}
function leaveRoom(){if(confirm('정말 방을 나갈까요?'))invoke('leave')}
async function boot(){if(session){await refresh();if(session)connect()}else render();}
boot();setInterval(()=>{if(session&&!document.hidden)refresh()},8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
