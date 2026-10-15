'use strict';
const app=document.getElementById('app'),overlay=document.getElementById('overlay'),toastEl=document.getElementById('toast');
const KEY='monster-witness-session-v1',qp=new URLSearchParams(location.search);
let session=null,state=null,events=null,pending=false,toastTimer=null;
let strokes=[],redoStack=[],color='#202a3b',width=5,eraser=false,activeStroke=null,draftRound='',saveTimer=null,uploading=false;
try{session=JSON.parse(localStorage.getItem(KEY)||'null')}catch{localStorage.removeItem(KEY)}
if(session&&qp.get('room')&&session.code!==qp.get('room'))session=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const own=()=>state?.players[state.seat];
function toast(text){toastEl.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.textContent='',3300)}
function modal(content){overlay.innerHTML='<div class="dialog">'+content+'<button class="secondary full" onclick="closeModal()">닫기</button></div>';overlay.hidden=false}
function closeModal(){overlay.hidden=true;overlay.innerHTML=''}
function request(url,data){return fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}).then(async resp=>{const x=await resp.json();if(!resp.ok)throw Error(x.error||'서버 오류');return x})}
function saveSession(ret){session={code:ret.code,token:ret.token};localStorage.setItem(KEY,JSON.stringify(session));history.replaceState(null,'','/?room='+ret.code);setState(ret.state);connect()}
function connect(){events?.close();if(!session)return;events=new EventSource('/api/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));events.onmessage=refresh;}
async function refresh(){
 if(!session||pending)return;
 try{setState(await request('/api/state?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token)))}
 catch(e){if(/방을 찾지|인증/.test(e.message)){localStorage.removeItem(KEY);session=null;state=null;events?.close();history.replaceState(null,'','/');render();toast('방이 초기화되어 다시 만들어야 해.')}}
}
function setState(next){
 const nextDraft=next.phase==='draw'&&next.seat!==next.witness?next.code+':'+next.round+':'+next.seat:'';
 if(nextDraft!==draftRound){
  if(nextDraft){try{strokes=JSON.parse(localStorage.getItem('monster-sketch:'+nextDraft)||'[]')}catch{strokes=[]}}
  else strokes=[];
  redoStack=[];draftRound=nextDraft;
 }
 if(nextDraft&&strokes.length===0&&next.myDrawing){} // server snapshots appear as submitted images; live local strokes take precedence.
 state=next;render();
}
async function create(e){e.preventDefault();if(pending)return;pending=true;try{
 const name=document.getElementById('nick').value.trim()||'화가',size=Number(document.getElementById('size').value),cycles=Number(document.getElementById('cycles').value);
 saveSession(await request('/api/create',{name,size,cycles}));
 }catch(err){toast(err.message)}finally{pending=false}}
async function join(e){e.preventDefault();if(pending)return;pending=true;try{
 saveSession(await request('/api/join',{name:document.getElementById('joinname').value.trim(),code:document.getElementById('roomcode').value.toUpperCase().trim()}))
 }catch(err){toast(err.message)}finally{pending=false}}
async function act(type,extra={}){
 if(pending||!session)return;pending=true;
 try{const s=await request('/api/action',{...session,type,...extra});
  if(s.left){localStorage.removeItem(KEY);session=null;state=null;events?.close();history.replaceState(null,'','/');render()}
  else setState(s);
 }catch(e){toast(e.message)}finally{pending=false}
}
function leaveRoom(){if(confirm('방에서 나갈까?'))act('leave')}
async function copyInvite(){const url=location.origin+'/?room='+state.code;try{await navigator.clipboard.writeText(url);toast('초대 링크 복사 완료!')}catch{prompt('초대 링크',url)}}
function drawStroke(ctx,stroke){
 const pts=stroke.p;if(!pts||!pts.length)return;
 ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=stroke.c;ctx.fillStyle=stroke.c;ctx.lineWidth=stroke.w;
 if(pts.length===1){ctx.beginPath();ctx.arc(pts[0][0],pts[0][1],stroke.w/2,0,Math.PI*2);ctx.fill();return}
 ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
 for(let i=1;i<pts.length-1;i++){const mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2;ctx.quadraticCurveTo(pts[i][0],pts[i][1],mx,my)}
 const last=pts[pts.length-1];ctx.lineTo(last[0],last[1]);ctx.stroke();
}
function paint(){
 const canvas=document.getElementById('pad');if(!canvas)return;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,400,500);
 strokes.forEach(s=>drawStroke(ctx,s));if(activeStroke)drawStroke(ctx,activeStroke);
}
function pos(canvas,e){
 const box=canvas.getBoundingClientRect();
 return [Math.max(0,Math.min(400,Math.round((e.clientX-box.left)*400/box.width))),
 Math.max(0,Math.min(500,Math.round((e.clientY-box.top)*500/box.height)))];
}
function commitStroke(){
 if(!activeStroke)return;
 strokes.push(activeStroke);activeStroke=null;redoStack=[];
 try{localStorage.setItem('monster-sketch:'+draftRound,JSON.stringify(strokes))}catch{}
 paint();scheduleSave();
}
function attachPad(){
 const canvas=document.getElementById('pad');if(!canvas)return;
 const p=own();if(p?.submitted){paint();return}
 canvas.onpointerdown=e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
  activeStroke={c:eraser?'#ffffff':color,w:eraser?24:width,p:[pos(canvas,e)]};paint()};
 canvas.onpointermove=e=>{if(!activeStroke)return;e.preventDefault();const point=pos(canvas,e);const prev=activeStroke.p.at(-1);if(Math.abs(prev[0]-point[0])+Math.abs(prev[1]-point[1])>=2){activeStroke.p.push(point);paint()}};
 canvas.onpointerup=e=>{e.preventDefault();commitStroke()};
 canvas.onpointercancel=e=>{e.preventDefault();commitStroke()};
 paint();
}
function snapshot(){
 const canvas=document.getElementById('pad');
 if(canvas){paint();return canvas.toDataURL('image/jpeg',.72)}
 const off=document.createElement('canvas');off.width=400;off.height=500;const ctx=off.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,400,500);strokes.forEach(s=>drawStroke(ctx,s));return off.toDataURL('image/jpeg',.72);
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveDraft()},1100)}
async function saveDraft(){
 if(!session||state?.phase!=='draw'||own()?.submitted||pending)return;
 try{const image=snapshot();await request('/api/action',{...session,type:'save',image})}catch{}
}
function undo(){if(!strokes.length)return;redoStack.push(strokes.pop());persist();paint()}
function redo(){if(!redoStack.length)return;strokes.push(redoStack.pop());persist();paint()}
function clearPad(){if(!confirm('그림 전체를 지울까?'))return;strokes=[];redoStack=[];persist();paint()}
function persist(){try{localStorage.setItem('monster-sketch:'+draftRound,JSON.stringify(strokes))}catch{}scheduleSave()}
function pen(c){color=c;eraser=false;renderTools()}
function thickness(v){width=Number(v);eraser=false;renderTools()}
function useEraser(){eraser=!eraser;renderTools()}
function renderTools(){
 document.querySelectorAll('[data-pencolor]').forEach(el=>el.classList.toggle('active',!eraser&&el.dataset.pencolor===color));
 document.querySelectorAll('[data-width]').forEach(el=>el.classList.toggle('active',!eraser&&Number(el.dataset.width)===width));
 document.getElementById('eraser')?.classList.toggle('active',eraser);
}
async function submitArt(){if(!state||state.phase!=='draw'||own().submitted)return;commitStroke();
 clearTimeout(saveTimer);await act('submit',{image:snapshot()});
}
async function uploadPhotos(input){
 if(!session||!state?.isHost||state.phase!=='lobby'||uploading)return;
 uploading=true;
 try{
  const files=[...input.files].slice(0,100-state.deckCount);
  for(const file of files){
   if(!file.type.startsWith('image/'))continue;
   const img=await new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('사진을 읽을 수 없어.'))};img.src=url});
   const canvas=document.createElement('canvas'),ratio=Math.min(1,640/Math.max(img.width,img.height));
   canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
   const cx=canvas.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,canvas.width,canvas.height);cx.drawImage(img,0,0,canvas.width,canvas.height);
   let photo=canvas.toDataURL('image/jpeg',.72);
   if(photo.length>275000)photo=canvas.toDataURL('image/jpeg',.48);
   await act('upload',{image:photo});
  }
  toast('몬스터 카드 이미지 등록 완료!');
 }catch(e){toast(e.message)}finally{uploading=false;input.value=''}
}
function remain(){return state?.deadline?Math.max(0,Math.ceil((state.deadline-Date.now())/1000)):0}
function countdown(){const target=document.getElementById('countdown');if(target&&state?.deadline)target.textContent=Math.floor(remain()/60)+':'+String(remain()%60).padStart(2,'0')}
