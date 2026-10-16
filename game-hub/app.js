'use strict';
const GAMES=[
 {id:'mound-vs-plate',title:'마운드 VS 타석',short:'한 구 승부에서 상대의 수를 읽어라!',desc:'투수는 구종과 코스를 선택하고 타자는 궤적을 보고 스윙! 1·3이닝 친구 대전과 봇 연습이 가능한 야구 심리전.',url:'https://mound-vs-plate-2026.onrender.com',min:2,max:2,category:'board',tags:['2인 전용','야구','심리전','봇'],theme:'night',emoji:'⚾',motif:'🏟️',stamp:'NEW'},
 {id:'battleline',title:'배틀라인',short:'아홉 전선에서 벌어지는 전략 대결!',desc:'9개의 깃발을 놓고 카드 조합으로 맞붙는 2인 온라인 게임. 기본 병력전과 전술전 중 선택해서 플레이!',url:'https://battleline-mobile-2026.onrender.com',min:2,max:2,category:'board',tags:['2인 전용','전략','카드','전술'],theme:'dawn',emoji:'⚔️',motif:'🚩',stamp:'NEW'},
 {"id":"nine-dragons","title":"구룡투","short":"1대1 전략 승부!","desc":"친구와 머리를 맞대고 겨루는 2인 전략 대결 게임. 누가 더 영리하게 승부할까?","url":"https://nine-dragons-duel.aglowpin8.chatgpt.site","min":2,"max":2,"category":"board","tags":["2인 전용","전략","대결"],"theme":"dawn","emoji":"🐉","motif":"⚔️","stamp":"NEW"},
 {"id":"indian-poker","title":"인디언 포커","short":"상대 숫자만 보고 블러핑!","desc":"상대에게 보이는 카드를 읽고 베팅과 심리전으로 승부하는 2인 카드게임.","url":"https://indian-poker-duel.aglowpin8.chatgpt.site","min":2,"max":2,"category":"mystery","tags":["2인 전용","카드","블러핑"],"theme":"peach","emoji":"🃏","motif":"🪙","stamp":"NEW"},
 {"id":"number-baseball","title":"숫자야구","short":"스트라이크와 볼로 숫자 추리!","desc":"숨겨진 숫자를 추측하고 스트라이크·볼 힌트로 정답을 먼저 찾아내는 2인 대결.","url":"https://number-baseball-duel.aglowpin8.chatgpt.site","min":2,"max":2,"category":"mystery","tags":["2인 전용","숫자","추리"],"theme":"mint","emoji":"⚾","motif":"🔢","stamp":"NEW"},
 {id:'tichu',title:'티츄 프렌즈',short:'2대2 팀플레이로 대역전!',desc:'팀원에게 카드를 교환하고, 마작 요청·폭탄·티츄 선언으로 1등을 노리는 전략 카드게임. 혼자서 봇과 연습도 가능!',url:'https://tichu-friends-mobile-2026.onrender.com',min:4,max:4,category:'board',tags:['팀전','전략','카드','봇'],theme:'purple',emoji:'🐉',motif:'🀄',stamp:'NEW'},
 {id:'monster',title:'몬스터 목격자',short:'이상한 괴물을 설명해 봐!',desc:'한 명이 몬스터를 보고 설명하면 친구들이 각자 그림을 그려. 누가 가장 비슷하게 그렸을까?',url:'https://monster-witness-friends-2026.onrender.com',min:3,max:8,category:'drawing',tags:['그림','웃긴 게임','파티'],theme:'mint',emoji:'👾',motif:'🎨',stamp:'NEW'},
 {id:'kraken',title:'노터치 크라켄',short:'크라켄을 건드리지 마!',desc:'비밀 역할을 감추고 다른 사람의 카드를 공개해. 보물을 찾는 탐험대와 스켈레톤의 속고 속이는 대결!',url:'https://no-touch-kraken-2026.onrender.com',min:3,max:8,category:'mystery',tags:['추리','블러핑','역할'],theme:'sea',emoji:'🐙',motif:'⚓',stamp:'HOT'},
 {id:'deepsea',title:'딥 씨 어드벤처',short:'욕심내면 산소가 모자라!',desc:'보물을 챙길수록 발걸음은 무거워지고 산소는 줄어들어. 과연 잠수함까지 돌아올 수 있을까?',url:'https://deep-sea-friends-2026.onrender.com',min:2,max:6,category:'board',tags:['주사위','눈치','보드'],theme:'ocean',emoji:'🤿',motif:'💎',stamp:'PICK'},
 {id:'lexio',title:'렉시오',short:'패를 읽고 판을 뒤집어!',desc:'보유한 타일로 족보를 만들고 상대 패를 눌러 이기는 전략 카드 게임. 친구들이랑 제대로 승부!',url:'https://lexio-four-friends-2026.onrender.com',min:3,max:6,category:'board',tags:['카드','전략','봇'],theme:'peach',emoji:'🀄',motif:'♠',stamp:''},
 {id:'splendor',title:'스플렌더 듀얼',short:'딱 둘이서 두뇌 싸움!',desc:'보석을 모아 카드를 사고 우위를 만들어 봐. 2인에게 딱 좋은 보석 전략 게임.',url:'https://splendor-duel-mobile-2026.onrender.com',min:2,max:2,category:'board',tags:['2인 전용','전략','보석'],theme:'purple',emoji:'💎',motif:'👑',stamp:'2P'},
 {id:'werewolf',title:'한밤의 늑대인간',short:'하룻밤 사이에 누가 바뀌었지?',desc:'각자 비밀 역할을 받고 밤의 능력을 사용해. 토론과 투표로 늑대인간을 찾아보자!',url:'https://midnight-werewolf-mobile.onrender.com',min:3,max:10,category:'mystery',tags:['마피아','추리','토론'],theme:'night',emoji:'🐺',motif:'🌕',stamp:''},
 {id:'daybreak',title:'한밤의 늑대인간: 확장',short:'더 많은 역할, 더 복잡한 밤!',desc:'기본판에 새로운 역할과 유물을 더한 데이브레이크 확장판. 늑대인간 고수들에게 추천!',url:'https://midnight-werewolf-daybreak.onrender.com',min:3,max:10,category:'mystery',tags:['확장판','마피아','상급'],theme:'dawn',emoji:'🌄',motif:'🪄',stamp:'PLUS'},
 {id:'picture',title:'그림 암호국',short:'그림만 보고 팀원을 찾아!',desc:'4명이 2대2로 겨뤄. 그림 힌트를 주고받으며 우리 팀 그림을 찾아내는 팀 추리 게임.',url:'https://picture-spies-four-2026.onrender.com',min:4,max:4,category:'drawing',tags:['그림','팀전','추리'],theme:'yellow',emoji:'🕵️',motif:'🖼️',stamp:'4P'}
];
const META={
 all:'전체 게임',mystery:'추리 게임',board:'보드·전략',drawing:'그림 게임',duo:'2인 가능',favorite:'찜한 게임'
};
const store={
 get(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:fallback}catch{return fallback}},
 set(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
};
const STAR_KEY='waggle-gamehub-favorites-v1';
const RECENT_KEY='waggle-gamehub-recent-v1';
let favorites=store.get(STAR_KEY,[]).filter(x=>GAMES.some(g=>g.id===x));
let recent=store.get(RECENT_KEY,[]).filter(x=>GAMES.some(g=>g.id===x));
let category='all',search='',modalOpen=false,lastFocus=null,toastTimeout=0;
const $=(selector)=>document.querySelector(selector);
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isFavorite=id=>favorites.includes(id);
function visibleGames(){
 const q=search.toLocaleLowerCase('ko-KR').trim();
 return GAMES.filter(g=>{
  const tag=category==='all'||category==='favorite'&&isFavorite(g.id)||category==='duo'&&g.min<=2||g.category===category;
  const query=!q||[g.title,g.short,g.desc,...g.tags].join(' ').toLocaleLowerCase('ko-KR').includes(q);
  return tag&&query;
 });
}
const countLabel=g=>g.min===g.max?g.min+'명':g.min+'~'+g.max+'명';
const iconArt=g=>'<div class="game-art art-'+g.theme+'" aria-hidden="true"><span class="art-star as-a">✦</span><span class="art-star as-b">✿</span>'+
 '<span class="art-ring ring-one"></span><span class="art-ring ring-two"></span>'+
 '<span class="art-motif">'+g.motif+'</span><span class="art-emoji">'+g.emoji+'</span>'+
 '<span class="art-caption">PLAY WITH FRIENDS</span></div>';
function gameCard(g,i){
 return '<article class="game-card" style="--card-index:'+i+'" data-id="'+g.id+'">'+
 '<div class="card-art-box">'+iconArt(g)+(g.stamp?'<span class="card-stamp">'+g.stamp+'</span>':'')+
 '<button type="button" class="favorite-btn '+(isFavorite(g.id)?'on':'')+'" data-favorite="'+g.id+'" title="'+(isFavorite(g.id)?'찜 해제':'찜하기')+'" aria-label="'+safe(g.title)+' '+(isFavorite(g.id)?'찜 해제':'찜하기')+'" aria-pressed="'+(isFavorite(g.id)?'true':'false')+'">'+(isFavorite(g.id)?'♥':'♡')+'</button></div>'+
 '<div class="card-content"><div class="card-meta"><span>👥 '+countLabel(g)+'</span><span>'+({drawing:'🎨 그림',mystery:'🎭 추리',board:'🎲 전략'}[g.category])+'</span></div>'+
 '<h3>'+safe(g.title)+'</h3><p class="card-one-liner">'+safe(g.short)+'</p><p class="card-description">'+safe(g.desc)+'</p>'+
 '<div class="card-tags">'+g.tags.map(t=>'<span>#'+safe(t.replace(/\s/g,''))+'</span>').join('')+'</div>'+
 '<a class="card-link" href="'+g.url+'" target="_blank" rel="noopener noreferrer" data-play="'+g.id+'" aria-label="'+safe(g.title)+' 새 탭에서 플레이">게임 시작하기 <span aria-hidden="true">↗</span></a></div></article>';
}
function renderCards(){
 const data=visibleGames();
 $('#gameGrid').innerHTML=data.map(gameCard).join('');
 $('#emptyState').hidden=data.length!==0;
 $('#itemCount').textContent=data.length+'개의 게임';
 document.querySelectorAll('.filter-chip').forEach(el=>{
  const active=el.dataset.category===category;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));
 });
}
function renderRecent(){
 const box=$('#recentGames');
 if(!recent.length){box.innerHTML='<div class="recent-empty"><span>🌱</span><div><b>아직 기록이 없어!</b><small>게임을 시작하면 여기에 표시돼.</small></div></div>';return;}
 box.innerHTML=recent.slice(0,3).map(id=>{
  const g=GAMES.find(g=>g.id===id);if(!g)return '';
  return '<a class="recent-entry" href="'+g.url+'" target="_blank" rel="noopener noreferrer" data-play="'+g.id+'">'+
   '<span class="recent-emoji art-'+g.theme+'">'+g.emoji+'</span><span><b>'+safe(g.title)+'</b><small>'+safe(g.short)+'</small></span><i aria-hidden="true">→</i></a>';
 }).join('');
}
function showToast(message){
 const toast=$('#toast');toast.textContent=message;toast.classList.add('show');
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.classList.remove('show'),2700);
}
function toggleFavorite(id){
 if(!GAMES.some(g=>g.id===id))return;
 favorites=isFavorite(id)?favorites.filter(x=>x!==id):[...favorites,id];
 store.set(STAR_KEY,favorites);renderCards();
 showToast(isFavorite(id)?'💗 찜한 게임에 추가했어!':'찜을 해제했어.');
}
function recordPlay(id){
 if(!GAMES.some(g=>g.id===id))return;
 recent=[id,...recent.filter(x=>x!==id)].slice(0,5);
 store.set(RECENT_KEY,recent);renderRecent();
}
function openModal(inner){
 const layer=$('#modal');lastFocus=document.activeElement;
 $('#modalBody').innerHTML=inner;layer.hidden=false;modalOpen=true;
 document.body.classList.add('modal-visible');$('#closeModal').focus();
}
function closeModal(){
 const layer=$('#modal');if(!modalOpen)return;
 layer.hidden=true;modalOpen=false;document.body.classList.remove('modal-visible');
 $('#modalBody').innerHTML='';lastFocus?.focus?.();
}
function surprise(){
 const pool=visibleGames().length?visibleGames():GAMES,g=pool[Math.floor(Math.random()*pool.length)];
 openModal('<div class="roulette-caption">★ TODAY\'S PICK ★</div>'+
 '<div class="roulette-img">'+iconArt(g)+'</div>'+
 '<h2 id="modalTitle">이 게임 어때? <span>🎉</span></h2>'+
 '<p class="modal-game-title">'+safe(g.title)+'</p><p class="modal-game-copy">'+safe(g.desc)+'</p>'+
 '<div class="roulette-meta"><span>👥 '+countLabel(g)+'</span><span>'+g.tags.map(safe).join(' · ')+'</span></div>'+
 '<div class="modal-actions"><button type="button" class="button button-white" id="tryAgain">🔄 다시 뽑기</button>'+
 '<a class="button button-primary" href="'+g.url+'" target="_blank" rel="noopener noreferrer" data-play="'+g.id+'">플레이하기 ↗</a></div>');
 $('#tryAgain').addEventListener('click',surprise);
}
async function sharePortal(){
 const url=location.origin+location.pathname;
 if(navigator.share){try{await navigator.share({title:'와글와글 게임랜드',text:'우리 게임 모음! 오늘 여기서 같이 놀자 🎮',url});return}catch(e){if(e?.name==='AbortError')return;}}
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);showToast('🔗 게임랜드 주소를 복사했어!');return}catch{}}
 const field=document.createElement('textarea');field.value=url;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
 try{document.execCommand('copy');showToast('🔗 주소 복사 완료!')}catch{prompt('주소 복사하기',url)}finally{field.remove()}
}
function showInstall(){
 openModal('<div class="install-icon">📲</div><h2 id="modalTitle">핸드폰 홈 화면에 붙여두자!</h2><p class="install-lead">앱처럼 아이콘 하나로 게임랜드에 들어올 수 있어.</p>'+
 '<div class="install-steps"><div><b>🍎 아이폰 · Safari</b><p>아래쪽 <strong>공유</strong> → <strong>홈 화면에 추가</strong> → 추가</p></div>'+
 '<div><b>🤖 안드로이드 · Chrome</b><p>오른쪽 위 <strong>⋮</strong> → <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong></p></div></div>'+
 '<button type="button" class="button button-primary install-done" id="installDone">알겠어!</button>');
 $('#installDone').onclick=closeModal;
}
function resetFilters(){
 category='all';search='';$('#searchInput').value='';renderCards();
}
function bind(){
 $('#metricCount').textContent=GAMES.length;
 $('#filters').addEventListener('click',e=>{
  const button=e.target.closest('[data-category]');if(!button)return;
  category=button.dataset.category;renderCards();
 });
 $('#searchInput').addEventListener('input',e=>{search=e.target.value;renderCards()});
 $('#resetButton').addEventListener('click',resetFilters);
 document.addEventListener('click',e=>{
  const favorite=e.target.closest('[data-favorite]');
  if(favorite){toggleFavorite(favorite.dataset.favorite);return;}
  const play=e.target.closest('[data-play]');
  if(play){recordPlay(play.dataset.play);}
  if(e.target.closest('[data-close-modal]'))closeModal();
 });
 $('#randomButton').addEventListener('click',surprise);
 $('#randomButtonBottom').addEventListener('click',surprise);
 $('#closeModal').addEventListener('click',closeModal);
 $('#shareButton').addEventListener('click',sharePortal);
 $('#shareButtonBottom').addEventListener('click',sharePortal);
 $('#installButton').addEventListener('click',showInstall);
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();return;}
  if(e.key==='/'&&!modalOpen&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')){e.preventDefault();$('#searchInput').focus();}
  if(e.key==='Tab'&&modalOpen){const focusable=[...$('#modal').querySelectorAll('button:not([disabled]),a[href]')];if(!focusable.length)return;
   const first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 renderCards();renderRecent();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
