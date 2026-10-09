'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const allowed=new Set(['server.js','game.js','package.json','public/client.js','public/index.html','public/manifest.json','public/icon.svg']);
const dest=path.join(__dirname,'splendor-duel-mobile-app');
const tar=zlib.brotliDecompressSync(fs.readFileSync(path.join(__dirname,'splendor-source.br')));
let offset=0,count=0;
while(offset+512<=tar.length){
 const h=tar.subarray(offset,offset+512),name=h.toString('utf8',0,100).split('\0')[0];
 if(!name)break;
 const size=parseInt(h.toString('ascii',124,136).replace(/\0.*$/,'').trim(),8)||0;
 const kind=String.fromCharCode(h[156]||0);
 if(allowed.has(name)&&(kind==='0'||kind==='\0')){
  const filename=path.join(dest,name);
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,tar.subarray(offset+512,offset+512+size));
  count++;
 }
 offset+=512+Math.ceil(size/512)*512;
}
if(count!==allowed.size)throw Error('Incomplete game bundle: '+count+'/'+allowed.size);
console.log('Installed mobile Splendor Duel files: '+count);
