'use strict';
const colors=[['#9f83fa','#5136a1'],['#72c9b2','#20796d'],['#ed9f63','#a85b38'],['#f08aad','#9a456b'],['#82c3f6','#33649e'],['#edd77c','#a58d42'],['#9bdf7c','#52804c']];
const P=(d,fill,stroke,w)=>'<path d="'+d+'" fill="'+(fill||'none')+'" stroke="'+(stroke||'#30344a')+'" stroke-width="'+(w||6)+'" stroke-linecap="round" stroke-linejoin="round"/>';
function drawMonster(seed){
 let num=(seed*982451653+17)>>>0;const rand=()=>{num=(Math.imul(num,1664525)+1013904223)>>>0;return num/4294967296};
 const ri=(a,b)=>a+Math.floor(rand()*(b-a+1)),[c,dark]=colors[(seed-1)%colors.length];
 const body=[
 'M200 112 C276 101 309 154 296 244 Q294 330 200 348 C101 344 96 299 103 219 C101 145 140 104 200 112Z',
 'M200 116 Q249 115 255 194 Q330 253 284 316 Q252 358 196 348 Q134 354 109 317 Q75 247 142 195 Q155 115 200 116Z',
 'M170 87 Q245 68 254 139 L270 307 Q259 362 201 358 Q143 352 128 309 L141 135 Q143 98 170 87Z',
 'M199 135 Q306 110 333 228 Q348 330 199 337 Q63 337 68 240 Q72 146 199 135Z'][ri(0,3)];
 const art=[];
 if(rand()<.72)art.push(P('M270 251 Q357 192 358 282 Q366 330 315 333',null,dark,17));
 if(rand()<.4){art.push(P('M136 174 Q42 91 28 187 Q41 242 109 250Z',c,dark,6));art.push(P('M260 176 Q356 92 370 186 Q361 233 286 247Z',c,dark,6))}
 const legs=ri(2,6);for(let i=0;i<legs;i++){const x=120+i*155/(legs-1);art.push(P('M'+x+' 319 Q'+(x+(i%2?-21:18))+' 363 '+(x+(i%2?-37:37))+' '+ri(373,411),null,dark,ri(9,16)))}
 for(const dir of [-1,1]){const x=dir<0?115:282;art.push(P('M'+x+' 205 Q'+(x+dir*44)+' '+ri(200,275)+' '+(x+dir*72)+' '+ri(256,312),null,dark,13))}
 art.push(P(body,c,dark,8));
 const horns=ri(0,3);for(let i=0;i<horns;i++){const x=155+i*93/Math.max(1,horns-1);art.push(P('M'+(x-16)+' 128 Q'+(x+ri(-20,20))+' '+ri(11,45)+' '+(x+14)+' 121Z','#f2e2ca',dark,5))}
 if(rand()<.4){art.push(P('M182 117 Q155 51 128 64 M219 114 Q246 46 274 61',null,dark,5));art.push('<circle cx="128" cy="64" r="12" fill="#ffe18b" stroke="'+dark+'" stroke-width="5"/><circle cx="274" cy="61" r="12" fill="#ffe18b" stroke="'+dark+'" stroke-width="5"/>')}
 const eyes=[1,2,2,3,4,5][ri(0,5)];
 for(let i=0;i<eyes;i++){
  const x=eyes===1?200:110+i*180/(eyes-1),y=eyes>3?(i%2?188:153):172+ri(-15,17),rad=eyes===1?40:eyes>=4?16:25;
  art.push('<ellipse cx="'+x+'" cy="'+y+'" rx="'+rad+'" ry="'+(rad+ri(0,6))+'" fill="#fffdf3" stroke="'+dark+'" stroke-width="5"/>');
  art.push('<circle cx="'+(x+ri(-6,8))+'" cy="'+(y+ri(-2,8))+'" r="'+Math.ceil(rad*.38)+'" fill="#1e2634"/>');
 }
 const mouth=ri(0,4);
 if(mouth===0){art.push(P('M151 257 Q197 314 253 255 Q209 276 151 257Z','#6d365d',dark,6));art.push(P('M178 265 l11 25 12 -22 M215 272 l12 19 10 -27','#fff4df',dark,2))}
 if(mouth===1)art.push(P('M153 267 Q202 316 254 267',null,dark,8));
 if(mouth===2)art.push(P('M174 248 L225 266 188 293Z','#ffd271',dark,6));
 if(mouth===3){art.push(P('M145 254 Q198 249 254 258 L236 305 L164 302Z','#462c48',dark,6));for(let i=0;i<4;i++)art.push(P('M'+(166+i*20)+' 261 l8 16 l10 -15','#f9f2df',dark,2))}
 if(mouth===4)art.push('<circle cx="202" cy="270" r="13" fill="#60334f" stroke="'+dark+'" stroke-width="6"/>');
 if(rand()<.7)for(let i=0,ct=ri(4,12);i<ct;i++)art.push('<circle cx="'+ri(148,252)+'" cy="'+ri(293,331)+'" r="'+ri(3,10)+'" fill="#fff3d0" opacity=".56"/>');
 if(rand()<.3)art.push(P('M158 113 Q191 66 250 100 Q240 124 158 113Z','#f2d56b',dark,5));
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="420" height="480" viewBox="0 0 400 460"><rect width="400" height="460" rx="25" fill="#f5f4ed"/><path d="M0 354 Q200 322 400 363 L400 460 H0Z" fill="#dfe8e2"/><circle cx="324" cy="83" r="48" fill="#e6e2f6"/>'+art.join('')+'<text x="20" y="439" fill="#7c8b96" font-family="sans-serif" font-size="14" font-weight="bold">CREATURE No. '+String(seed).padStart(3,'0')+'</text></svg>';
 return 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
}
module.exports={drawMonster};
