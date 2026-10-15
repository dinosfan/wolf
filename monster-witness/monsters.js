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
   const left=Math.round(col*meta.width/10)+3,top=Math.round(row*meta.height/5)+3;
   const right=Math.round((col+1)*meta.width/10)-3,bottom=Math.round((row+1)*meta.height/5)-3;
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
module.exports={COUNT,drawMonster,prepareMonsterDeck};
