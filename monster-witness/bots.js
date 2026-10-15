'use strict';
// Lightweight, intentionally imperfect simulation drawings for solo practice.
// Traits are hand-authored from the 50 original illustrated monster cards.
const sharp=require('sharp');
const traits=[
 ['초록색 촉수 덩어리에 서로 다른 높이의 눈이 네 개 있어. 아래로 여러 촉수가 뻗어 있어.','blob','#7fba47',4,0,8],
 ['하얀색과 하늘색의 털북숭이야. 휘어진 뿔 두 개, 큰 입과 뾰족한 이빨이 있어.','furry','#afcddc',2,2,2],
 ['기린처럼 목이 아주 길고 노란색 몸에 갈색 점이 있어. 머리 위에 눈들이 튀어나와.','giraffe','#deb65b',4,0,4],
 ['분홍 문어 같은 괴물이야. 눈은 큰 것 하나, 다리 대신 휘어진 촉수가 여러 개야.','octopus','#ee89a5',1,0,8],
 ['커다란 회색 바위 골렘이야. 이끼가 자라고 굵은 두 팔과 다리가 있어.','golem','#929f91',2,0,4],
 ['까맣고 마른 고양이처럼 생겼어. 뾰족한 귀, 노란 눈, 긴 꼬리를 가지고 있어.','cat','#454147',2,2,4],
 ['햄버거에 다리가 달린 듯해. 위에는 긴 눈자루 두 개, 입에는 긴 혀가 있어.','burger','#c88c48',2,0,4],
 ['크림색 털북숭이인데 박쥐 날개와 굵은 뿔이 있고 입이 아주 커.','furry','#e3dac5',2,2,2],
 ['초록 드래곤인데 보라색 박쥐 날개, 긴 꼬리와 뿔이 있어.','dragon','#81bb78',2,2,4],
 ['보라색 먹구름 같은 몸에서 촉수가 나오고, 주황빛 두 눈이 빛나.','cloud','#8c74ad',2,0,8],
 ['오래된 나무 괴물이야. 몸통 한가운데 눈 하나, 팔은 나뭇가지처럼 뻗어 있어.','tree','#78824c',1,3,4],
 ['보라색 가시가 등 전체에 난 공룡 같은 괴물이야. 커다란 입과 발톱이 있어.','dragon','#8c72b0',2,5,4],
 ['반투명 파란 해파리야. 둥근 우산 모양 머리 아래에 수많은 촉수가 달렸어.','jelly','#8bbcdc',2,0,10],
 ['까만 덩어리인데 눈이 여러 개 붙어 있고 아래쪽으로 짧은 다리가 나와.','blob','#44454a',5,0,7],
 ['푸른 얼음 결정으로 된 괴물이야. 온몸에 뾰족한 수정이 솟아 있고 팔 두 개가 있어.','crystal','#84cfe4',2,6,4],
 ['노란 해바라기 얼굴에 눈과 입이 있고 줄기와 잎이 다리처럼 연결되어 있어.','flower','#e9cb66',2,0,2],
 ['갈색 상자 몸통에 얼굴이 있고, 아래는 길고 가느다란 거미 다리야.','box','#ae8861',2,0,8],
 ['희고 흐릿한 유령에 커다랗고 검은 입, 몸 아래로 길게 흐르는 촉수가 있어.','ghost','#dcd2da',2,0,8],
 ['분홍 털괴물인데 굵은 검은 뿔이 두 개, 눈이 세 개, 뾰족한 이빨이 있어.','furry','#de87ae',3,2,2],
 ['나뭇가지 뿔이 달린 사슴 해골이 네 발로 서 있어.','skeleton','#d8d6c9',2,5,4],
 ['펭귄처럼 생겼는데 눈이 크고 부리가 길어. 검은 날개와 노란 발이 있어.','bird','#bcc9cf',2,0,2],
 ['등에 작은 나무가 자라는 돌 거북이야. 네 발은 굵고 몸 전체는 회색이야.','turtle','#8f9b8e',2,0,4],
 ['빨간 공 몸체를 중심으로 눈 달린 긴 자루가 사방으로 뻗어 있어.','eyeball','#ce6865',9,0,4],
 ['매끈한 검은 유령이야. 눈 두 개만 보이고 아래는 검은 액체처럼 흘러내려.','ghost','#2f323c',2,0,8],
 ['연한 회색 작은 공룡 해골에 거대한 눈 하나가 있어.','skeleton','#dddbc9',1,0,4],
 ['보라색 푸른 덩어리인데 곳곳에 눈이 여덟 개 이상 박혀 있어.','blob','#8d9bcc',9,0,7],
 ['한가운데 눈 하나가 달린 짙은 파란 박쥐 괴물이야. 커다란 보라 날개가 있어.','bat','#55518f',1,0,2],
 ['빨간 갓에 흰 점이 있는 버섯 괴물이야. 줄기 대신 촉수와 얼굴이 있어.','mushroom','#c67b65',2,0,7],
 ['커다란 하얀 물고기 해골에 날카로운 이빨과 지느러미가 있어.','fish','#c5c7c0',2,0,2],
 ['분홍 토끼 같은 괴물인데 긴 귀 두 개와 눈이 여러 개야.','rabbit','#efabc2',5,2,4],
 ['큰 입이 원형으로 열린 분홍 애벌레야. 몸은 마디로 되어 있고 짧은 다리가 있어.','worm','#d48e80',0,0,8],
 ['구름 모양 흰색 몸에 얼굴이 있고 아래로 번개가 내려와.','cloud','#d5dfdf',2,0,3],
 ['낡은 갈색 책에 얼굴이 있는데 커다란 이빨과 팔·다리가 달려 있어.','box','#936e4c',2,0,4],
 ['초록 선인장 몸에 작은 꽃이 피어 있고 눈 세 개, 짧은 팔이 있어.','cactus','#7eae76',3,5,2],
 ['나뭇가지 뿔이 넓게 퍼진 작은 사슴 해골이야.','skeleton','#c9bfaf',2,6,4],
 ['민트색 물방울 젤리인데 눈들이 위쪽에 불쑥 튀어나와.','blob','#83d6be',3,0,5],
 ['파란 회색 털북숭이에 뿔 두 개, 커다란 이빨이 있어.','furry','#7e99ac',2,2,2],
 ['작은 초록 헬멧 같은 머리를 가진 거미 로봇이야. 길고 얇은 다리가 여럿 있어.','spider','#95b2a0',2,0,8],
 ['회색 돌덩어리 같은 네발 괴물인데 눈이 여러 개야.','golem','#8f8e90',5,0,4],
 ['눈처럼 하얗고 반투명한 유령이야. 아래가 촉수처럼 갈라져 있어.','ghost','#dbe9ed',2,0,8],
 ['초록색 식물 공룡인데 얼굴 전체가 거대한 이빨 가득한 입이야.','plant','#76a46d',2,5,4],
 ['길고 분홍색인 애벌레가 세로로 서 있어. 눈자루 두 개와 아주 큰 입이 있어.','worm','#d29b92',2,0,2],
 ['옅은 갈색 털뭉치 몸에서 눈 세 개가 자루처럼 튀어나와.','furry','#c8b17b',3,0,2],
 ['남색 밤하늘처럼 반짝이는 몸에 뿔 두 개와 빨간 눈이 있어.','blob','#5554a4',2,2,4],
 ['긴 턱의 공룡 해골이야. 큰 해골 머리, 드러난 갈비뼈, 네 다리가 있어.','skeleton','#d7d0bc',2,0,4],
 ['분홍색 컵케이크 괴물인데 눈이 여러 개, 꼭대기에 빨간 체리가 있어.','cake','#e9a7b3',4,0,4],
 ['매끄러운 검은 유령인데 밝은 노란 눈이 작게 빛나. 아래로 흘러내린 촉수가 있어.','ghost','#37313c',2,0,8],
 ['복슬복슬한 흰색 몸에 검은 뿔 두 개, 팔이 네 개 있어.','furry','#e2e0d7',3,2,4],
 ['커다란 껍질을 짊어진 달팽이인데 눈자루 두 개가 길게 솟아 있어.','snail','#ab926c',2,0,1],
 ['검은 낡은 모니터에 커다란 눈 하나가 있고, 아래로 여러 촉수가 늘어져.','robot','#505a6c',1,0,8]
];
function traitFor(card){
 const index=card?.type==='builtin'?card.seed:0;
 return index>=1&&index<=traits.length?traits[index-1]:['몸통, 눈, 팔다리 모양을 묘사해 줘.','blob','#81acae',2,0,4];
}
function botHint(card){
 const [hint]=traitFor(card);
 return '🤖 목격자 증언: '+hint+' 기억이 완벽하진 않으니까 그림을 잘 보고 그려줘!';
}
function escapeXml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'}[c]))}
function botSvg(card,seat){
 const [hint,type,base,eyes,horns,legs]=traitFor(card),offset=(seat*31+((card?.seed||3)*13))%41;
 const dark='#384554',p=[];
 const line=(path,width=5)=>'<path d="'+path+'" stroke="'+dark+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
 const ellipse=(x,y,rx,ry,color=base)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+color+'" stroke="'+dark+'" stroke-width="5"/>';
 const cx=200+Math.floor(offset/5-4),cy=246;
 // Differing beginner-style scribbles intentionally simplify the real illustrated cards.
 p.push('<rect width="400" height="500" fill="#fff"/>');
 if(['ghost','octopus','jelly','blob','cloud','worm','plant','cactus'].includes(type)){
  if(type==='worm')p.push(line('M'+(cx-30)+' 366 Q'+(cx-90)+' 276 '+(cx-15)+' 188 Q'+(cx+60)+' 112 '+(cx+20)+' 94',25));
  else p.push(ellipse(cx,cy,72+(offset%27),102,base));
 }else if(['box','robot'].includes(type))p.push('<rect x="'+(cx-78)+'" y="155" width="156" height="167" rx="'+(type==='robot'?12:5)+'" fill="'+base+'" stroke="'+dark+'" stroke-width="6"/>');
 else if(type==='tree'||type==='flower')p.push(line('M'+cx+' 345 L'+cx+' 183',17),ellipse(cx,180,80,66,base));
 else if(type==='giraffe')p.push(ellipse(cx,290,88,58,base),line('M'+(cx-35)+' 278 Q'+(cx-50)+' 195 '+(cx-19)+' 103',30),ellipse(cx-19,102,34,31,base));
 else if(type==='skeleton')p.push(ellipse(cx,162,67,61,'#f2e8d8'),line('M'+cx+' 222 L'+cx+' 326',12),line('M'+(cx-40)+' 266 L'+(cx+40)+' 266',7));
 else if(type==='mushroom'){p.push(ellipse(cx,185,100,55,'#bf6b6b'),ellipse(cx,292,50,75,'#d5c5a0'))}
 else if(type==='burger'){p.push(ellipse(cx,222,94,42,'#dfb769'),ellipse(cx,268,94,18,'#ce7359'),ellipse(cx,293,92,22,'#dfb769'))}
 else if(type==='snail'){p.push(ellipse(cx+40,276,70,69,'#867397'),ellipse(cx-54,308,43,40,base),line('M'+(cx-55)+' 300 L'+(cx-58)+' 174',9))}
 else p.push(ellipse(cx,cy,87,104,base));
 if(type==='bat'||type==='dragon'||type==='furry'&&horns) {
  if(type==='bat'||type==='dragon')p.push(line('M'+(cx-62)+' 198 L'+(cx-132)+' 143 L'+(cx-158)+' 250 L'+(cx-92)+' 230'),line('M'+(cx+62)+' 198 L'+(cx+132)+' 143 L'+(cx+158)+' 250 L'+(cx+92)+' 230'));
 }
 if(horns>0){
  const h=Math.min(5,horns);
  for(let i=0;i<h;i++){const x=cx-57+i*(114/Math.max(1,h-1));p.push(line('M'+x+' 161 L'+(x-7)+' '+(86+(i%2)*22),6))}
 }
 const e=Math.min(eyes,9);
 for(let i=0;i<e;i++){
  const ex=cx+(e===1?0:(i%3-1)*39),ey=205+Math.floor(i/3)*32;
  p.push(ellipse(ex,ey,15,16,'#fff'),'<circle cx="'+(ex+2)+'" cy="'+ey+'" r="6" fill="#26374a"/>');
 }
 if(!e)p.push('<circle cx="'+cx+'" cy="220" r="14" fill="#293746"/>');
 p.push(line('M'+(cx-25)+' 278 Q'+cx+' '+(300+offset%18)+' '+(cx+27)+' 276',5));
 const legN=Math.min(legs,10);
 for(let i=0;i<legN;i++){
  const x=cx+(i-(legN-1)/2)*Math.min(22,160/legN),end=x+(i%2?20:-20);
  p.push(line('M'+x+' 322 Q'+end+' 357 '+(end+(i%2?15:-15))+' '+(372+i%3*13),5));
 }
 if(type==='octopus'||type==='jelly')p.push(line('M'+(cx-65)+' 240 Q'+(cx-130)+' 292 '+(cx-115)+' 365'),line('M'+(cx+65)+' 240 Q'+(cx+130)+' 290 '+(cx+115)+' 363'));
 p.push('<text x="18" y="470" font-size="14" font-family="sans-serif" fill="#8c8c8c">BOT SKETCH</text>');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">'+p.join('')+'</svg>';
}
async function botPicture(card,seat){
 const svg=botSvg(card,seat);
 const img=await sharp(Buffer.from(svg)).jpeg({quality:61,mozjpeg:true}).toBuffer();
 return 'data:image/jpeg;base64,'+img.toString('base64');
}
module.exports={botHint,botPicture,botSvg,traitFor};
