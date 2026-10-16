'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const COUNT=50;
let cached=[],preparing=null;
async function prepareMonsterDeck(){
 if(cached.length===COUNT)return cached;
 if(preparing)return preparing;
 preparing=(async()=>{
  const sheet=fs.readFileSync(path.join(__dirname,'assets','monster-50-sprite.webp'));
  const meta=await sharp(sheet).metadata();
  if(!meta.width||!meta.height)throw Error('몬스터 카드 시트 크기를 읽지 못했습니다.');
  const cards=await Promise.all(Array.from({length:COUNT},async(_,idx)=>{
   const col=idx%10,row=Math.floor(idx/10);
   // The illustrated sheet's painted card frames are slightly taller than
   // the nominal 10 x 5 grid. A symmetric 3px inset included the next row's
   // rounded border (particularly visible under card #27).
   // Keep the full card header and footer, but stop before the next frame.
   const cellWidth=meta.width/10,cellHeight=meta.height/5;
   const left=Math.round(col*cellWidth)+2;
   const right=Math.round((col+1)*cellWidth)-2;
   const top=Math.max(0,Math.round(row*cellHeight)-3);
   const bottom=row===4?meta.height-4:Math.round((row+1)*cellHeight)-18;
   const buf=await sharp(sheet).extract({left,top,width:right-left,height:bottom-top}).webp({quality:84,effort:5}).toBuffer();
   return 'data:image/webp;base64,'+buf.toString('base64');
  }));
  cached=cards;return cards;
 })().catch(err=>{preparing=null;throw err});
 return preparing;
}
function drawMonster(seed){
 if(cached.length!==COUNT)throw Error('몬스터 카드 이미지를 준비하는 중입니다.');
 if(!Number.isInteger(seed)||seed<1||seed>COUNT)throw Error('올바르지 않은 몬스터 카드 번호입니다.');
 return cached[seed-1];
}

const EASY_IDS=Object.freeze([2,3,4,6,7,8,9,12,16,18,19,21,24,25,27,30,32,34,37,40]);
const HARD_IDS=Object.freeze([1,5,11,14,15,20,23,26,29,33,35,38,39,41,45,50]);
function difficultyOf(seed){
 if(!Number.isInteger(seed)||seed<1||seed>COUNT)throw Error('올바르지 않은 카드 번호입니다.');
 return EASY_IDS.includes(seed)?'easy':HARD_IDS.includes(seed)?'hard':'medium';
}
const FILTERS=['all','beginner','standard','challenge'];
function filteredIds(filter='all'){
 if(!FILTERS.includes(filter))throw Error('난이도 필터가 올바르지 않아.');
 return Array.from({length:COUNT},(_,i)=>i+1).filter(n=>{
  const d=difficultyOf(n);
  return filter==='all'||filter==='beginner'&&d==='easy'||filter==='standard'&&d!=='hard'||filter==='challenge'&&d==='hard';
 });
}
function cardCatalog(){return Array.from({length:COUNT},(_,i)=>({id:i+1,difficulty:difficultyOf(i+1)}))}

module.exports={COUNT,drawMonster,prepareMonsterDeck,difficultyOf,filteredIds,cardCatalog,FILTERS};
