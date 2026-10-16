'use strict';
function head(){return '<header class="bar"><div class="brand"><span>👾</span><div><strong>몬스터 목격자</strong><small>WITNESS & SKETCH</small></div></div><button class="mini alt" onclick="rules()">규칙</button></header>'}
function rules(){
 modal('<h2>👾 몬스터 목격자 · 규칙</h2><p>3~8명이 한자리에 모여 직접 대화하면서 각자 휴대폰으로 괴물을 그리는 게임이야.</p>'+
 '<ol><li>목격자 한 명만 원본 몬스터를 20초 동안 본다.</li><li>원본이 사라지면 120초 동안 말로 묘사한다. 그림을 보여주거나 몸짓하면 안 돼.</li>'+
 '<li>화가들은 설명을 듣고 각자 그림을 그린다. 질문은 할 수 있어.</li><li>그림이 공개되면 목격자가 원본을 다시 보기 전에 마음에 드는 그림을 고른다.</li>'+
 '<li>그다음 원본을 공개하고 화가들이 자기 그림을 제외한 다른 사람 그림에 투표한다.</li>'+
 '<li>화가 투표의 최다 득표자(동점 포함) +1, 목격자 선택을 받은 화가 +1, 목격자 선택이 최다 득표 그룹에 속하면 목격자 +1.</li>'+
 '<li>3인에서는 화가 투표 없이 목격자 선택을 받은 화가만 +1. 모두 목격자를 1회(빠른 모드) 또는 2회(원작 모드) 맡으면 끝!</li></ol>'+
 '<p class="muted">카드는 기본 제공 오리지널 몬스터 50종으로 시작하며, 방장은 자신의 몬스터 카드 사진을 추가할 수 있어. 등록한 사진은 그 방에서만 사용돼.</p>');
}
function home(){
 return head()+'<section class="hero"><div class="hero-monster">👁️👾🖍️</div><span class="eyebrow">GUESS WHAT I SAW</span>'+
 '<h1>방금 그 괴물,<br><em>정말 그렇게 생겼어?</em></h1><p>20초의 기억, 2분의 설명. 가장 엉뚱한 그림이 나올 때까지!</p>'+
 '<div class="tags"><span>3~8인</span><span>모바일 그림판</span><span>실시간 투표</span></div></section>'+
 '<section class="panel"><h2>새 게임 만들기</h2><form onsubmit="create(event)"><label>닉네임<input id="nick" maxlength="16" placeholder="내 이름"></label>'+
 '<label>플레이 인원<select id="size">'+[3,4,5,6,7,8].map(n=>'<option value="'+n+'" '+(n===5?'selected':'')+'>'+n+'명</option>').join('')+'</select></label>'+
 '<label>경기 길이<select id="cycles"><option value="1">빠른 게임 · 목격자 1번씩</option><option value="2">원작형 · 목격자 2번씩</option></select></label>'+
 '<button class="primary full">🎨 방 만들기 →</button></form></section>'+
 '<section class="panel"><h2>친구 방 참가</h2><form onsubmit="join(event)"><label>닉네임<input id="joinname" maxlength="16" placeholder="닉네임" required></label>'+
 '<label>방 코드<input id="roomcode" maxlength="5" placeholder="ABCDE" value="'+esc(qp.get('room')||'')+'" required></label>'+
 '<button class="alt full">입장하기</button></form></section>';
}
function lobby(){
 const players=state.players,canStart=players.length===state.size&&players.every(p=>p.ready);
 return head()+'<section class="panel center"><span class="tag">대기실 '+players.length+'/'+state.size+'명</span><h1>수사팀을 모으는 중</h1>'+
 '<div class="invite">'+esc(state.code)+'</div><button class="alt full" onclick="copyInvite()">🔗 초대 링크 복사</button></section>'+
 '<section class="panel"><h2>참가자</h2><div class="seats">'+players.map(p=>'<div class="seat"><span class="avatar" style="--seat:'+p.color+'">'+(p.bot?'🤖':'🎨')+'</span><b>'+esc(p.name)+(p.seat===state.seat?' · 나':'')+'</b>'+
 '<small>'+(p.bot?'🤖 연습용 봇':p.ready?'✅ 준비 완료':'⏳ 준비 중')+'</small>'+(p.bot&&state.isHost?'<button class="mini alt" onclick="act(\'removeBot\',{seat:'+p.seat+'})">봇 제거</button>':'')+'</div>').join('')+
 Array.from({length:state.size-players.length},()=>'<div class="seat vacant"><span class="avatar">?</span><b>빈자리</b><small>참가 대기</small></div>').join('')+'</div></section>'+
 (state.isHost?'<section class="panel"><h2>🗂 몬스터 카드 모음</h2>'+
 '<p class="muted">기본 제공 오리지널 몬스터 50종. 직접 촬영한 카드 사진을 등록하면 <b>등록한 카드만</b> 이번 방에서 사용해.</p>'+
 '<div class="upload-row"><b>사진 덱: '+state.deckCount+'장</b><label class="upload-button">+ 카드 이미지 등록<input type="file" accept="image/*" multiple onchange="uploadPhotos(this)" hidden></label></div>'+
 (state.deckCount?'<button class="alt full" onclick="act(\'clearDeck\')">사진 덱 비우고 기본 카드 사용</button>':'')+'</section>':'')+
 '<section class="panel"><button class="primary full" onclick="act(\'ready\',{ready:'+(!players[state.seat].ready)+'})">'+
 (players[state.seat].ready?'준비 취소':'✅ 준비 완료')+'</button>'+
 (state.isHost?'<button class="primary full" '+(canStart?'':'disabled')+' onclick="act(\'start\')">게임 시작하기 →</button>':
 '<p class="muted center">방장이 시작하면 자동 진행돼.</p>')+
 '<button class="quiet full" onclick="leaveRoom()">방 나가기</button></section>';
}
function progress(){
 const witness=state.players[state.witness];
 return '<section class="status"><div class="status-top"><span class="tag">라운드 '+state.round+' / '+state.totalRounds+'</span><span class="tag">방 '+esc(state.code)+'</span>'+
 '<span class="timer" id="countdown">'+Math.floor(remain()/60)+':'+String(remain()%60).padStart(2,'0')+'</span></div>'+
 '<div class="witness"><span>👁️</span><div><small>이번 라운드 목격자</small><strong>'+esc(witness.name)+(state.witness===state.seat?' · 나':'')+'</strong></div>'+
 '<small>'+({observe:'원본 관찰',draw:'설명·그림',witnessVote:'목격자 선택',artistVote:'원본 공개·투표',result:'결과'}[state.phase]||'')+'</small></div></section>';
}
function playerScore(){return '<section class="score-strip">'+state.players.map(p=>
 '<div class="score-unit" style="--seat:'+p.color+'"><b>'+esc(p.name)+(p.seat===state.seat?' · 나':'')+'</b><span>'+p.score+'점</span></div>').join('')+'</section>'}
function imagePanel(image,caption){
 return '<div class="monster-image">'+(image?'<img src="'+esc(image)+'" alt="이번 라운드 원본 괴물">':'<div class="silhouette">?</div>')+
 '<div class="monster-caption">'+esc(caption)+'</div></div>';
}
function observe(){
 const mine=state.witness===state.seat;
 return head()+progress()+
 '<section class="panel center"><h2>'+(mine?'👀 20초 동안 몬스터를 기억해!':'🔒 목격자가 몬스터를 관찰하고 있어')+'</h2>'+
 '<p class="muted">'+(mine?'색, 눈 개수, 몸통, 다리와 특이한 장식을 잘 기억해. 시간이 되면 원본은 자동으로 사라져.':
 '목격자만 괴물을 볼 수 있어. 잠시 기다리면 그림판이 열려.')+'</p>'+
 imagePanel(mine?state.image:null,mine?'20초 후 자동 숨김':'비밀 이미지 · 목격자만 열람')+'</section>'+playerScore();
}
function toolbox(){
 const colors=['#202a3b','#e96168','#3b81de','#3dba81','#edb24c','#9e64cc'];
 const picker=colors.map(c=>'<button type="button" class="colorpick" style="--ink:'+c+'" data-pencolor="'+c+'" onclick="pen(\''+c+'\')" aria-label="'+c+' 색상"><span></span></button>').join('');
 return '<div class="tools"><div class="toolrow">'+picker+'</div>'+
 '<div class="toolrow"><div class="widths">'+[3,5,9,15].map(n=>'<button class="chip" data-width="'+n+'" onclick="thickness('+n+')">'+n+'px</button>').join('')+'</div>'+
 '<button id="eraser" class="chip" onclick="useEraser()">지우개</button></div>'+
 '<div class="toolrow"><button class="chip wide" onclick="undo()">↶ 되돌리기</button><button class="chip wide" onclick="redo()">↷ 다시 실행</button><button class="chip" onclick="clearPad()">전체 지우기</button></div></div>';
}
function drawing(){
 const isWitness=state.witness===state.seat,p=own();
 if(isWitness)return head()+progress()+'<section class="panel center"><div class="bigemoji">🗣️</div><h2>이제 괴물을 설명해!</h2>'+
 '<p>방금 본 괴물을 기억해서 친구들에게 말로 알려줘. 그림이나 사진은 보여주지 말고 <b>말로만</b> 설명해야 해.</p>'+
 '<p class="muted">다른 사람의 그림은 제출 단계까지 볼 수 없어.</p></section>'+submissionProgress()+playerScore();
 return head()+progress()+
 '<section class="drawing-page"><div class="drawing-heading"><strong>✏️ 설명을 듣고 그려봐!</strong><small>손가락으로 그림 그리기</small></div>'+
 '<div class="canvas-frame"><canvas id="pad" width="400" height="500" aria-label="몬스터 그림판"></canvas></div>'+
 (p.submitted?'<div class="saved-banner">✅ 제출 완료! 다른 친구들을 기다려줘.</div>':toolbox()+
 '<button class="primary full submit" onclick="submitArt()">📤 그림 제출하기</button>')+
 '<p class="muted center">그림은 내 화면에서만 보여. 제한시간이 끝나면 저장된 그림으로 자동 제출돼.</p></section>'+
 submissionProgress();
}
function submissionProgress(){const artists=state.players.filter(p=>p.seat!==state.witness);return '<div class="panel center"><strong>그림 제출 '+artists.filter(p=>p.submitted).length+' / '+artists.length+'명</strong>'+
 '<div class="names">'+artists.map(p=>'<span>'+esc(p.name)+' '+(p.submitted?'✅':'✏️')+'</span>').join('')+'</div></div>'}
function gallery(options){
 return '<div class="gallery">'+state.players.filter(p=>p.seat!==state.witness).map(p=>{
  const canClick=options?.allowed?.includes(p.seat),selected=options?.selected===p.seat;
  return '<div class="art-card'+(selected?' selected':'')+'">'+
 '<div class="paper">'+(p.drawing?'<img src="'+esc(p.drawing)+'" alt="'+esc(p.name)+'님의 몬스터 그림">':'<div class="empty-art">제출된 그림 없음</div>')+'</div>'+
 '<div class="art-bottom"><b>'+esc(p.name)+'</b>'+(canClick?'<button class="mini primary" onclick="'+options.handler+'('+p.seat+')">선택</button>':'')+
 (options?.picked===p.seat?' <span class="pick">👁️ 목격자 선택</span>':'')+'</div></div>';
 }).join('')+'</div>';
}
function witnessVote(){
 const mine=state.witness===state.seat;
 return head()+progress()+'<section class="panel"><h2>🖼 화가들의 그림 공개!</h2><p class="muted">'+
 (mine?'원본을 다시 보기 전에 가장 비슷하다고 생각하는 그림 하나를 골라줘.':'목격자가 기억을 바탕으로 한 그림을 고르는 중이야. 원본은 아직 비밀!')+
 '</p></section>'+gallery({allowed:mine?state.players.filter(x=>x.seat!==state.witness).map(x=>x.seat):[],
 handler:"chooseWitness"})+playerScore();
}
function chooseWitness(seat){if(confirm(state.players[seat].name+'님의 그림으로 선택할까?'))act('witnessPick',{seat})}
function artistVote(){
 const mine=state.witness===state.seat,me=own(),allowed=mine||me.voted?[]:state.players.filter(x=>x.seat!==state.witness&&x.seat!==state.seat).map(x=>x.seat);
 return head()+progress()+'<section class="panel"><h2>👾 원본 괴물 공개!</h2><p class="muted">'+
 (mine?'화가들이 원본과 그림을 비교하고 투표하는 중이야.':'원본과 가장 닮은 다른 화가의 그림에 투표해. 본인 작품에는 투표할 수 없어.')+
 '</p>'+imagePanel(state.image,'이번 라운드 원본')+'</section>'+
 (me.voted?'<div class="saved-banner">✅ 투표 완료! 다른 친구들을 기다리는 중.</div>':'')+
 gallery({allowed,handler:"chooseArtist"})+playerScore();
}
function chooseArtist(seat){if(confirm(state.players[seat].name+'님의 그림에 투표할까?'))act('artistVote',{seat})}
function result(){
 const final=state.stage==='finished',ranking=[...state.players].sort((a,b)=>b.score-a.score);
 return head()+'<section class="panel center"><div class="bigemoji">'+(final?'🏆':'🎉')+'</div>'+
 '<h1>'+(final?'최종 게임 결과':'그림 비교 결과!')+'</h1>'+
 '<p class="muted">원본 괴물과 그림, 목격자의 선택을 비교해봐 ㅋㅋ</p>'+
 imagePanel(state.image,'실제 몬스터 카드')+'</section>'+
 '<section class="panel"><h2>화가들 작품</h2>'+gallery({picked:state.witnessPick})+'</section>'+
 '<section class="panel"><h2>🏆 현재 점수</h2><div class="score-results">'+ranking.map((p,i)=>
 '<div class="score-line"><b>'+(i+1)+'위 · '+esc(p.name)+'</b><strong>'+p.score+'점</strong></div>').join('')+'</div></section>'+
 (state.isHost?'<button class="primary full next" onclick="act(\''+(final?'again':'next')+'\')">'+
 (final?'새 게임 준비하기':'다음 목격자 시작 →')+'</button>':
 '<p class="panel center muted">'+(final?'방장이 새 게임을 준비할 때까지 기다려줘.':'방장이 다음 라운드를 시작할 때까지 기다려줘.')+'</p>')+
 '<details class="panel"><summary>진행 기록 보기</summary>'+state.history.slice().reverse().map(s=>'<p class="muted">'+esc(s)+'</p>').join('')+'</details>';
}
function render(){
 app.innerHTML='<div class="wrap">'+(!state?home():state.phase==='lobby'?lobby():
 state.phase==='observe'?observe():state.phase==='draw'?drawing():state.phase==='witnessVote'?witnessVote():
 state.phase==='artistVote'?artistVote():result())+'<footer>MONSTER WITNESS · 친구들과 함께하는 그림 추리 게임</footer></div>';
 if(state?.phase==='draw'&&state.witness!==state.seat){attachPad();renderTools()}
 countdown();
}

const DIFFICULTY_NAMES={all:'🌈 전체 50장',beginner:'🌱 쉬움 20장',standard:'🎨 쉬움·보통 34장',challenge:'🔥 어려움 16장'};
const D_NAME={easy:'쉬움',medium:'보통',hard:'어려움'};
async function openCatalog(){
 if(state&&state.phase!=='lobby'&&state.stage!=='finished'){
  toast('게임 진행 중에는 도감을 열 수 없어. 다음 몬스터가 미리 보일 수 있거든!');return;
 }
 if(!confirm('⚠️ 스포일러 주의! 몬스터 카드 50장을 모두 볼 수 있어. 계속할까?'))return;
 try{
  const {cards,count}=await request('/api/catalog');
  modal('<h2>👾 몬스터 도감 · '+count+'장</h2>'+
   '<p class="muted">오리지널 몬스터 카드 전체와 난이도야. 플레이 전에는 스포일러가 될 수 있어!</p>'+
   '<div class="card-collection">'+cards.map(c=>'<div class="collection-item">'+
    '<img loading="lazy" decoding="async" src="/api/card/'+c.id+'.webp?v=2" alt="몬스터 카드 '+c.id+'">'+
    '<div><b>#'+String(c.id).padStart(2,'0')+'</b><span class="difficulty d-'+c.difficulty+'">'+D_NAME[c.difficulty]+'</span></div></div>').join('')+
   '</div>');
 }catch(e){toast('도감 로딩 실패: '+e.message)}
}
function deckSettings(){
 const filter=state.cardFilter||'all',count=state.activeCardCount||50;
 const option=state.isHost?'<label for="deckDifficulty">난이도 선택</label>'+
  '<select id="deckDifficulty" onchange="act(\'setDifficulty\',{filter:this.value})">'+
  Object.entries(DIFFICULTY_NAMES).map(([id,label])=>'<option value="'+id+'"'+(filter===id?' selected':'')+'>'+label+'</option>').join('')+'</select>':'';
 return '<section class="panel deck-settings"><h2>👾 기본 몬스터 카드</h2>'+
 '<p>✅ <b>50장 내장 완료!</b> 사진 업로드 없이 바로 게임할 수 있어.</p>'+
 '<p class="muted">현재 모드: '+esc(DIFFICULTY_NAMES[filter])+' · '+count+'장 후보 · 중복 출제 방지</p>'+
 option+
 '<button type="button" class="alt full" onclick="openCatalog()">🗂 몬스터 도감 · 카드 미리보기 (스포일러)</button>'+
 '</section>';
}
const beforeLobby=lobby;
lobby=function(){
 let html=beforeLobby();
 const target='<section class="panel"><button class="primary full"';
 if(html.includes(target))html=html.replace(target,deckSettings()+target);
 return html;
};
const beforeHome=home;
home=function(){
 return beforeHome().replace('</form></section>', '</form><button type="button" class="alt full" onclick="openCatalog()">🗂 50장 몬스터 도감 보기 (스포일러)</button></section>');
};
const beforeResult=result;
result=function(){
 let html=beforeResult();
 const seen=state.usedCardIds||[];
 const detail='<section class="panel"><h2>📋 이번 판에 나온 몬스터</h2>'+
 (state.currentCard?'<p class="muted">이번 몬스터: #'+String(state.currentCard.id).padStart(2,'0')+' · '+D_NAME[state.currentCard.difficulty]+'</p>':'')+
 '<div class="played-cards">'+seen.map(id=>'<span>#'+String(id).padStart(2,'0')+'</span>').join('')+'</div></section>'+
 (state.stage==='finished'?'<button type="button" class="alt full" onclick="openCatalog()">🗂 몬스터 도감 열기</button>':'');
 return html.replace('<details class="panel">',detail+'<details class="panel">');
};


async function practiceNow(){
 if(pending)return;
 pending=true;
 try{
  const name=document.getElementById('nick')?.value.trim()||'나',
  size=Number(document.getElementById('size')?.value||4),
  cycles=Number(document.getElementById('cycles')?.value||1);
  saveSession(await request('/api/create',{name,size,cycles,practice:true}));
 }catch(e){toast(e.message)}finally{pending=false}
}
const normalHome=home;
home=function(){
 const markup=normalHome();
 return markup.replace('</form><button type="button" class="alt full" onclick="openCatalog()">',
 '</form><button type="button" class="primary full practice-btn" onclick="practiceNow()">🤖 혼자 연습하기 · 봇과 바로 시작!</button><button type="button" class="alt full" onclick="openCatalog()">');
};
const normalLobby=lobby;
lobby=function(){
 const markup=normalLobby();
 const controls=state.isHost&&state.players.length<state.size?
 '<section class="panel bot-controls"><h2>🤖 빈자리에 봇 추가하기</h2>'+
 '<p class="muted">친구가 부족하면 연습용 봇이 대신 그림을 그리고 투표해. 봇은 자동 준비 완료!</p>'+
 '<div class="bot-buttons"><button class="alt" onclick="act(\'addBot\')">🤖 봇 1명 추가</button>'+
 '<button class="primary" onclick="act(\'fillBots\')">🤖 빈자리 모두 채우기</button></div></section>':'';
 return markup.replace('<section class="panel"><button class="primary full" ',controls+'<section class="panel"><button class="primary full" ');
};
const normalDrawing=drawing;
drawing=function(){
 const markup=normalDrawing();
 if(state.botHint&&state.witness!==state.seat){
  const help='<section class="panel bot-hint"><h2>🗣️ 봇 목격자의 설명</h2>'+
   '<p>'+esc(state.botHint)+'</p><small>이 특징을 듣고 자기 그림판에 그려봐!</small></section>';
  return markup.replace('<section class="drawing-page">',help+'<section class="drawing-page">');
 }
 return markup;
};

async function boot(){if(session){await refresh();if(session)connect()}else render()}
boot();
setInterval(()=>{countdown();if(session&&!document.hidden&&(!events||events.readyState===2))refresh()},800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
