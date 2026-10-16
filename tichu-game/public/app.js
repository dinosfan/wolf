'use strict';
const ROOT=document.getElementById('app'),OVERLAY=document.getElementById('overlay'),TOAST=document.getElementById('toast');
const SESSION='tichu-friends-v1',params=new URLSearchParams(location.search);
const RANKS=['','1','2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const S= ['★','⚔','♣','◆'],TYPE={single:'싱글',pair:'페어',triple:'트리플',full:'풀하우스',steps:'연속 페어',straight:'스트레이트',fourBomb:'포카드 폭탄',straightBomb:'스트레이트 플러시 폭탄',dog:'개 카드'};
let session=null,state=null,events=null,pending=false,selected=[],assignments={},selectedVariant=0,choices=[],suggestions=[],wishValue=14,order='rank',toastTimer=null,requestId=0;
try{session=JSON.parse(localStorage.getItem(SESSION)||'null')}catch{localStorage.removeItem(SESSION)}
if(session&&params.get('room')&&params.get('room')!==session.code)session=null;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const self=()=>state?.players[state.seat];
function notify(message){TOAST.textContent=message;TOAST.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>TOAST.classList.remove('visible'),3500)}
async function api(path,body){const res=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const json=await res.json();if(!res.ok)throw Error(json.error||'서버 오류');return json}
function openInfo(content){OVERLAY.innerHTML='<section class="dialog">'+content+'<button class="secondary full" onclick="closeInfo()">닫기</button></section>';OVERLAY.hidden=false}
function closeInfo(){OVERLAY.hidden=true;OVERLAY.innerHTML=''}
function rules(){
 openInfo('<h2>🀄 티츄 빠른 규칙</h2>'+
 '<p>4명, 2대2 팀전. 마주 앉은 사람이 같은 팀! 기본 목표는 1,000점, 빠른 경기는 500점이야.</p>'+
 '<ol><li>처음 8장을 보고 그랜드 티츄(+200 / -200) 여부를 정해.</li>'+
 '<li>총 14장 중 팀원에게 1장, 양쪽 상대에게 각 1장씩 교환해.</li>'+
 '<li>마작을 가진 사람이 먼저 시작해. 싱글·페어·트리플·풀하우스·연속 페어·스트레이트로 높은 조합을 내거나 패스해.</li>'+
 '<li>폭탄(포카드, 같은 무늬 스트레이트)은 자기 턴이 아니어도 낼 수 있어.</li>'+
 '<li>마작은 2~A 중 숫자 하나를 요청, 피닉스는 와일드 카드, 개 카드는 팀원에게 선공권을 주고, 드래곤은 최고 싱글이지만 이긴 트릭을 상대에게 줘.</li>'+
 '<li>자신의 첫 카드 제출 전 티츄(+100 / -100)를 선언할 수 있어. 자신이 꼭 1등이어야 성공해.</li>'+
 '<li>같은 팀이 1·2등을 모두 차지하면 팀 +200점(선언 점수 별도), 아니면 카드 점수 합산이야.</li></ol>'+
 '<p class="muted">개인 손패나 교환 정보는 다른 사람에게 보이지 않아. 봇은 연습용이라 사람만큼 전략적이지는 않아.</p>');
}
function gameName(){return '<header class="header"><div class="brand"><div class="logo">🀄</div><div><b>TICHU <em>FRIENDS</em></b><small>4-PLAYER TEAM CARD GAME</small></div></div><button class="help" onclick="rules()">? 규칙</button></header>'}
const face=id=>{
 if(id==='MJ')return {rank:'1',suit:'🀄',name:'마작',special:true};
 if(id==='PH')return {rank:'PH',suit:'🔥',name:'피닉스',special:true};
 if(id==='DG')return {rank:'DG',suit:'🐉',name:'드래곤',special:true};
 if(id==='DO')return {rank:'DOG',suit:'🐕',name:'개',special:true};
 const parts=id.split('-'),rank=Number(parts[1]),suit=Number(parts[0]);
 return {rank:RANKS[rank],suit:S[suit],name:RANKS[rank]+S[suit],red:suit===0||suit===3,rankValue:rank,suitValue:suit};
};
function cardButton(id,available=true){
 const c=face(id),on=selected.includes(id);
 return '<button type="button" class="game-card '+(c.special?'special ':'')+(c.red?'red ':'')+(on?'selected ':'')+'"'+
 (available?' onclick="toggleCard(\''+safe(id)+'\')"':' disabled')+' aria-pressed="'+(on?'true':'false')+'" title="'+safe(c.name)+'">'+
 '<span class="card-rank">'+safe(c.rank)+'</span><span class="card-suit">'+c.suit+'</span>'+
 '<span class="card-small">'+(c.special?safe(c.name):safe(c.rank))+'</span></button>';
}
function sortHand(list){
 return [...list].sort((a,b)=>{
  const x=face(a),y=face(b);const ax=x.special?(a==='MJ'?1:a==='DO'?15:a==='PH'?16:17):x.rankValue;
  const ay=y.special?(b==='MJ'?1:b==='DO'?15:b==='PH'?16:17):y.rankValue;
  return order==='suit'?(x.special?5:x.suitValue)-(y.special?5:y.suitValue)||ax-ay:ax-ay||(x.suitValue||0)-(y.suitValue||0);
 });
}
function home(){
 return gameName()+'<div class="home-banner"><div class="eyebrow">팀원과 힘을 합쳐 패를 털어!</div><h1>손패를 털고,<br><span>팀을 승리로!</span></h1>'+
 '<div class="home-mascot">🐉 <span>🂡</span> 🔥</div><p>4인 2대2 카드 심리전 · 그랜드 티츄 · 폭탄 · 역전!</p>'+
 '<div class="pills"><span>👥 4인</span><span>🤖 봇 연습</span><span>🏁 500 / 1,000점</span></div></div>'+
 '<section class="panel"><h2>🎲 새 게임 만들기</h2><form onsubmit="create(event)">'+
 '<label for="name">닉네임</label><input id="name" maxlength="14" autocomplete="off" placeholder="닉네임" value="">'+
 '<label for="target">경기 목표</label><select id="target"><option value="500">⚡ 빠른 500점</option><option value="1000" selected>🏆 원작 1,000점</option></select>'+
 '<button type="submit" class="primary full">친구들과 방 만들기 →</button>'+
 '<button type="button" class="solo full" onclick="practice()">🤖 혼자 연습하기 · 봇 3명 자동!</button></form></section>'+
 '<section class="panel"><h2>🔗 친구 방 참가</h2><form onsubmit="join(event)">'+
 '<label for="joinName">닉네임</label><input id="joinName" maxlength="14" autocomplete="off" required placeholder="내 이름">'+
 '<label for="code">초대 코드</label><input id="code" maxlength="5" required placeholder="ABCDE" value="'+safe(params.get('room')||'')+'">'+
 '<button class="secondary full" type="submit">입장하기</button></form></section>';
}
function lobby(){
 const occupied=state.players.length,allReady=occupied===4&&state.players.every(p=>p.ready);
 return gameName()+'<section class="panel lobby-head"><span class="pill">대기실 · '+occupied+'/4명</span>'+
 '<h1>팀원 모집 중</h1><div class="room-code">'+safe(state.code)+'</div>'+
 '<button class="secondary full" onclick="copyInvite()">🔗 친구 초대 링크 복사</button><p class="muted">1번·3번 같은 팀, 2번·4번 같은 팀이야.</p></section>'+
 '<section class="panel"><h2>🏁 선원 · 4인 테이블</h2><div class="seats">'+
 state.players.map(p=>'<div class="seat '+(p.seat%2===0?'blue':'orange')+'">'+
 '<span class="avatar">'+(p.bot?'🤖':'🃏')+'</span><b>'+(p.seat+1)+'번 '+safe(p.name)+(p.seat===state.seat?' · 나':'')+'</b>'+
 '<small>'+(p.bot?'🤖 자동 준비':p.ready?'✅ 준비 완료':'⏳ 대기 중')+'</small>'+
 (p.bot&&state.isHost?'<button class="remove-bot" onclick="act(\'removeBot\',{seat:'+p.seat+'})">봇 제거</button>':'')+'</div>').join('')+
 Array.from({length:4-occupied},()=>'<div class="seat vacant"><span class="avatar">?</span><b>빈자리</b><small>참가 대기</small></div>').join('')+'</div></section>'+
 (state.isHost&&occupied<4?'<section class="panel"><h2>🤖 봇으로 채우기</h2><p class="muted">친구가 부족하면 봇을 추가해 연습할 수 있어.</p>'+
 '<div class="buttons"><button class="secondary" onclick="act(\'addBot\')">봇 1명 추가</button><button class="secondary" onclick="act(\'fillBots\')">빈자리 전부 봇</button></div></section>':'')+
 '<section class="panel"><button class="primary full" onclick="act(\'ready\',{ready:'+(!self().ready)+'})">'+(self().ready?'준비 취소':'✅ 준비 완료')+'</button>'+
 (state.isHost?'<button class="primary full" '+(allReady?'':'disabled')+' onclick="act(\'start\')">게임 시작하기 →</button>':
 '<div class="muted center">방장이 시작하면 출발!</div>')+
 '<button class="quiet full" onclick="leave()">방 나가기</button></section>';
}
function scoreboard(){
 const a=state.players.filter(p=>p.seat%2===0),b=state.players.filter(p=>p.seat%2!==0);
 return '<section class="scoreboard"><div class="score-team"><small class="blue-text">🔵 A팀 · '+a.map(p=>safe(p.name)).join(' & ')+'</small>'+
 '<strong>'+state.scores[0]+'</strong></div><div class="score-mid">VS<br><span>R'+state.round+'</span></div>'+
 '<div class="score-team right"><small class="orange-text">🟠 B팀 · '+b.map(p=>safe(p.name)).join(' & ')+'</small><strong>'+state.scores[1]+'</strong></div></section>';
}
function playerBox(p){
 return '<div class="player-chip '+(p.seat%2===0?'blue':'orange')+' '+(state.turn===p.seat&&state.phase==='play'?'turn':'')+'">'+
 '<div class="player-face">'+(p.bot?'🤖':'👤')+'</div><b>'+safe(p.name)+(p.seat===state.seat?' (나)':'')+'</b>'+
 '<small>'+(p.out?'🏁 '+p.out+'등':p.cardCount+'장')+'</small>'+
 (p.grand?'<span class="player-call">G TICHU</span>':p.small?'<span class="player-call">TICHU</span>':'')+'</div>';
}
function tablePeople(){
 const p=state.players,me=state.seat,bySeat=s=>p[(me+s)%4];
 return '<div class="opponents"><div>'+playerBox(bySeat(2))+'<small class="position-label">팀원</small></div>'+
 '<div class="opponents-bottom">'+playerBox(bySeat(1))+playerBox(bySeat(3))+'</div></div>';
}
function hand(labelText){
 return '<section class="hand-panel"><div class="hand-head"><b>🂠 내 손패 ('+state.hand.length+'장)</b>'+
 '<button class="sort-button" onclick="toggleSort()">↕ '+(order==='rank'?'숫자순':'무늬순')+'</button></div>'+
 (labelText?'<p class="hand-explain">'+labelText+'</p>':'')+
 '<div class="cards-grid">'+sortHand(state.hand).map(id=>cardButton(id)).join('')+'</div></section>';
}
function phaseGrand(){
 return gameName()+scoreboard()+'<section class="panel grand-panel"><div class="emblem">⚡</div><h2>그랜드 티츄를 선언할까?</h2>'+
 '<p>먼저 받은 <b>8장</b>만 보고 결정해. 선언해서 1등이면 <b>+200점</b>, 실패하면 <b>-200점</b>!</p>'+
 '<div class="stage-progress">결정한 사람 '+state.players.filter(p=>p.grandDecided).length+' / 4</div>'+
 (state.grand===null?'<div class="buttons"><button class="secondary" onclick="act(\'grand\',{value:false})">선언 안 함</button>'+
 '<button class="primary" onclick="act(\'grand\',{value:true})">⚡ 그랜드 티츄!</button></div>':
 '<div class="waiting">✅ 내 선택 완료. 나머지 플레이어를 기다려줘.</div>')+'</section>'+
 hand('14장이 아닌 8장만 보고 결정하는 단계야.');
}
function tradeAssignments(){
 return '<div class="trade-targets">'+state.players.filter(p=>p.seat!==state.seat).map(p=>{
 const id=assignments[p.seat];
 return '<button class="trade-target '+(id?'filled':'')+'" onclick="assign('+p.seat+')">'+
 '<b>'+(p.seat%2===state.seat%2?'🤝 팀원':'⚔ 상대')+' · '+safe(p.name)+'</b>'+
 '<span>'+(id?safe(face(id).name):'선택 카드 보내기 +')+'</span></button>';
 }).join('')+'</div>';
}
function tradeView(){
 const count=Object.keys(assignments).length;
 return gameName()+scoreboard()+'<section class="panel"><h2>↔ 카드 3장 교환하기</h2>'+
 '<p class="muted">손패를 하나 누르고 아래의 받는 사람을 눌러. 팀원과 상대 둘에게 각각 1장씩!</p>'+
 '<div class="stage-progress">교환 완료 '+state.players.filter(p=>p.traded).length+'/4명</div>'+
 tradeAssignments()+
 (!state.trade?'<button class="primary full" '+(count===3?'':'disabled')+' onclick="sendTrade()">교환 확정 · '+count+'/3</button>':
 '<div class="waiting">✅ 교환 완료! 4명이 모두 결정하면 카드를 받게 돼.</div>')+
 '</section>'+hand(state.trade?'이미 교환을 확정했어.':'카드를 선택한 후 받을 사람을 누르면 교환 카드로 지정돼.');
}
function pile(){
 const t=state.table;
 return '<section class="pile"><div class="pile-title"><b>🃏 현재 테이블</b><small>'+(t?'낸 사람: '+safe(state.players[t.owner]?.name):'새 트릭')+'</small></div>'+
 (t?'<div class="table-cards">'+t.cards.map(id=>cardButton(id,false)).join('')+'</div>'+
 '<p class="pile-kind">'+safe(TYPE[t.type]||t.type)+' · '+(t.bomb?'💣 폭탄':'강도 '+t.power)+'</p>':
 '<div class="pile-empty">카드가 없어. 새로운 조합으로 시작해!</div>')+
 (state.wish?'<div class="wish-chip">🀄 요청 숫자: '+RANKS[state.wish]+' (낼 수 있다면 의무)</div>':'')+'</section>';
}
function optionDescription(o){
 const w=o.wild&&o.type!=='single'?' (피닉스 → '+RANKS[o.wild]+')':'';
 return (TYPE[o.type]||o.type)+(o.type==='dog'?'':' · '+o.power)+w;
}
function playableBar(){
 const mine=state.turn===state.seat,inPlay=state.phase==='play';
 const available=choices.length>0,chosen=choices[selectedVariant];
 const containsMJ=selected.includes('MJ');
 const anyBomb=choices.some(x=>x.bomb),canAct=mine||anyBomb;
 const wishSelect=containsMJ?'<div class="wish-select"><label for="mahjongWish">🀄 원하는 숫자</label>'+
 '<select id="mahjongWish" onchange="wishValue=Number(this.value)">'+Array.from({length:13},(_,i)=>i+2).map(v=>'<option value="'+v+'" '+(v===wishValue?'selected':'')+'>'+RANKS[v]+'</option>').join('')+'</select></div>':'';
 return '<section class="actions '+(mine?'myturn':'')+'">'+
 '<div class="action-title">'+(mine?'✨ 내 차례야! 조합을 내거나 패스해.':'⏳ '+safe(state.players[state.turn]?.name)+'님 차례 · 폭탄은 끼어들기 가능')+'</div>'+
 (selected.length?'<div class="selection-summary">'+selected.length+'장 선택 · '+(available?choices.map(optionDescription).join(' / '):'낼 수 없는 카드 조합')+'</div>':
 '<div class="muted action-hint">내 손패를 눌러 카드를 선택해. 가능한 조합 안내도 있어.</div>')+
 (choices.length>1?'<label class="variant-label">피닉스 / 족보 해석</label><select id="variant" onchange="selectedVariant=Number(this.value)">'+
 choices.map((o,i)=>'<option value="'+i+'" '+(i===selectedVariant?'selected':'')+'>'+safe(optionDescription(o))+'</option>').join('')+'</select>':'')+
 wishSelect+
 '<div class="action-buttons"><button class="primary" '+(canAct&&available?'':'disabled')+' onclick="submitPlay()">'+
 (anyBomb&&!mine?'💣 폭탄 발동!':'카드 내기')+'</button>'+
 '<button class="secondary" '+(mine&&state.options?.canPass?'':'disabled')+' onclick="act(\'pass\')">패스</button>'+
 '<button class="secondary" '+(mine?'':'disabled')+' onclick="showHints()">💡 가능한 족보</button></div>'+
 (mine&&!state.hasPlayed&&!self().grand&&!self().small?'<button class="call-btn" onclick="callTichu()">⚡ 티츄 선언 (+100 / -100)</button>':'')+
 '</section>';
}
function playView(){
 return gameName()+scoreboard()+tablePeople()+
 '<div class="turn-message">'+(state.turn===state.seat?'🟢 지금 내 차례!':'🟡 현재 '+safe(state.players[state.turn].name)+'님 차례')+'</div>'+
 pile()+hand('여러 장을 터치해 선택해 봐. 선택된 카드는 위로 올라가.')+playableBar()+
 '<details class="activity panel"><summary>📜 최근 진행 기록</summary>'+state.logs.slice(-12).reverse().map(x=>'<p>'+safe(x)+'</p>').join('')+'</details>';
}
function dragonView(){
 const mine=state.seat===state.turn;
 return gameName()+scoreboard()+'<section class="panel center"><div class="emblem">🐉</div>'+
 '<h2>드래곤 트릭을 상대에게 줘!</h2><p>드래곤으로 이긴 트릭은 상대 팀 한 명에게 선물해야 해.</p>'+
 (mine?'<div class="buttons">'+state.players.filter(p=>p.seat%2!==state.seat%2).map(p=>
 '<button class="secondary" onclick="act(\'dragon\',{seat:'+p.seat+'})">'+safe(p.name)+'에게 주기</button>').join('')+'</div>':
 '<div class="waiting">드래곤 사용자가 받을 상대를 고르는 중...</div>')+'</section>';
}
function resultView(){
 const data=state.roundResult,finish=state.phase==='matchEnd',winner=state.result?.winner;
 if(!data)return gameName()+'<section class="panel">결과를 계산 중이야...</section>';
 return gameName()+scoreboard()+'<section class="panel result-panel"><div class="emblem">'+(finish?'🏆':'🎉')+'</div>'+
 '<h1>'+(finish?(winner===state.seat%2?'우리 팀 우승!':'상대 팀 우승!'):'라운드 종료!')+'</h1>'+
 '<p>'+ (data.doubleVictory?'1·2등이 같은 팀이어서 200점 기본 점수!':'획득 카드의 점수를 정산했어.')+'</p>'+
 '<div class="result-cols"><div><small>🔵 A팀</small><strong>'+(data.award[0]>=0?'+':'')+data.award[0]+'</strong>'+
 '<span>카드 '+data.base[0]+' / 선언 '+data.announcements[0]+'</span></div>'+
 '<div><small>🟠 B팀</small><strong>'+(data.award[1]>=0?'+':'')+data.award[1]+'</strong>'+
 '<span>카드 '+data.base[1]+' / 선언 '+data.announcements[1]+'</span></div></div>'+
 '<p class="result-order">이번 라운드 나간 순서: '+data.out.map((seat,i)=>(i+1)+'등 '+safe(state.players[seat].name)).join(' → ')+'</p>'+
 (state.isHost?'<button class="primary full" onclick="act(\''+(finish?'restart':'next')+'\')">'+
 (finish?'다시 한 판!':'다음 라운드 시작 →')+'</button>':
 '<div class="waiting">방장이 '+(finish?'새 경기를':'다음 라운드를')+' 시작할 때까지 기다려줘.</div>')+
 '</section>';
}
function render(){
 if(!state)ROOT.innerHTML='<div class="wrap">'+home()+'</div>';
 else {
  const body=state.phase==='lobby'?lobby():state.phase==='grand'?phaseGrand():state.phase==='trade'?tradeView():
   state.phase==='play'?playView():state.phase==='dragon'?dragonView():resultView();
  const scroll=window.scrollY||0;ROOT.innerHTML='<div class="wrap">'+body+'<footer>🀄 TICHU FRIENDS · 친구들과 카드 게임</footer></div>';
  if(state.phase!=='lobby')window.scrollTo(0,scroll);
 }
}
function setState(next){
 const previous=state,reset=!previous||previous.code!==next.code||previous.phase!==next.phase||
  previous.round!==next.round||previous.phase==='play'&&previous.turn!==next.turn;
 if(reset){selected=[];choices=[];suggestions=[];selectedVariant=0;assignments={};requestId++;}
 state=next;render();
}
async function refresh(){
 if(!session||pending)return;
 try{setState(await api('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token)))}
 catch(e){if(/찾을 수 없어|인증/.test(e.message)){forget();notify('방이 초기화됐어. 새 방을 만들어줘.')}}
}
function forget(){localStorage.removeItem(SESSION);session=null;state=null;events?.close();history.replaceState(null,'','/');render()}
function saveJoin(result){session={code:result.code,token:result.token};localStorage.setItem(SESSION,JSON.stringify(session));
 history.replaceState(null,'','/?room='+result.code);setState(result.state);connect();}
function connect(){
 events?.close();if(!session)return;
 events=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
 events.onmessage=refresh;events.onerror=()=>{};
}
async function create(e){e.preventDefault();if(pending)return;pending=true;try{saveJoin(await api('/api/create',{name:document.getElementById('name').value.trim()||'선원',target:Number(document.getElementById('target').value)}))}catch(e){notify(e.message)}finally{pending=false}}
async function practice(){if(pending)return;pending=true;try{saveJoin(await api('/api/create',{name:document.getElementById('name').value.trim()||'나',target:Number(document.getElementById('target').value),practice:true}))}catch(e){notify(e.message)}finally{pending=false}}
async function join(e){e.preventDefault();if(pending)return;pending=true;try{saveJoin(await api('/api/join',{name:document.getElementById('joinName').value.trim(),code:document.getElementById('code').value.toUpperCase().trim()}))}catch(e){notify(e.message)}finally{pending=false}}
async function act(type,extra={}){
 if(!session||pending)return;pending=true;
 try{const result=await api('/api/action',{...session,type,...extra});if(result.left)forget();else setState(result)}
 catch(e){notify(e.message)}
 finally{pending=false}
}
function toggleCard(id){
 if(pending||!state?.hand.includes(id))return;
 selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];
 selectedVariant=0;choices=[];render();if(state.phase==='play')updateOptions();
}
function toggleSort(){order=order==='rank'?'suit':'rank';render()}
function assign(seat){
 if(state.phase!=='trade'||state.trade)return;
 const id=selected.at(-1);if(!id){notify('먼저 보낼 카드 한 장을 선택해.');return}
 Object.keys(assignments).forEach(x=>{if(assignments[x]===id)delete assignments[x]});
 assignments[seat]=id;selected=[];render();
}
function sendTrade(){if(Object.keys(assignments).length!==3)return;act('trade',{cards:assignments})}
async function updateOptions(includeHints=false){
 if(!session||state?.phase!=='play')return;
 const stamp=++requestId,ids=[...selected];
 try{const reply=await api('/api/options',{...session,cards:ids,includeHints});
  if(stamp!==requestId)return;
  choices=reply.options||[];selectedVariant=0;
  if(includeHints){suggestions=reply.hints||[];showHintDialog();return}
  render();
 }catch(e){if(stamp===requestId)notify(e.message)}
}
function showHints(){updateOptions(true)}
function showHintDialog(){
 const entries=suggestions.map((x,i)=>'<button class="hint-item" onclick="selectHint('+i+')">'+
 '<span>'+x.cards.map(id=>safe(face(id).name)).join(' ')+'</span>'+
 '<strong>'+safe(optionDescription(x.variant))+'</strong></button>').join('');
 openInfo('<h2>💡 지금 낼 수 있는 조합</h2><p>서버가 계산한 합법적 조합이야. 전략적인 정답은 아니야.</p>'+
 (entries||'<p>낼 수 있는 조합이 없어. 패스를 선택해 줘.</p>'));
}
function selectHint(i){const x=suggestions[i];if(!x)return;closeInfo();selected=[...x.cards];choices=[x.variant];selectedVariant=0;render()}
function submitPlay(){
 if(!choices.length)return;
 const option=choices[selectedVariant]||choices[0];
 if(selected.includes('MJ')){
  const s=document.getElementById('mahjongWish');if(s)wishValue=Number(s.value);
 }
 act('play',{cards:[...selected],variant:option,wish:selected.includes('MJ')?wishValue:undefined});
}
function callTichu(){if(confirm('티츄 선언! 직접 1등이면 +100점, 실패하면 -100점이야. 선언할까?'))act('small')}
async function copyInvite(){
 const text=location.origin+'/?room='+state.code;
 try{await navigator.clipboard.writeText(text);notify('🔗 초대 링크 복사 완료!')}catch{prompt('초대 링크',text)}
}
function leave(){if(confirm('대기실을 나갈까?'))act('leave')}
function boot(){if(session)refresh().then(()=>{if(session)connect()});else render()}
boot();
setInterval(()=>{if(session&&!document.hidden&&(!events||events.readyState===2))refresh()},8000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
