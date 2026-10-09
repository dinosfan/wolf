'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {spawnSync}=require('node:child_process');
const dir=__dirname;
const encoded=fs.readFileSync(path.join(dir,'source.tar.br.b64'),'utf8').trim();
if(!/^[A-Za-z0-9+/]+=*$/.test(encoded)) throw Error('Invalid source bundle');
const tar=zlib.brotliDecompressSync(Buffer.from(encoded,'base64'));
const result=spawnSync('tar',['-xf','-','-C',dir],{input:tar,stdio:['pipe','inherit','inherit']});
if(result.status!==0) throw Error('Failed to extract app source');
for(const p of ['server.js','public/index.html','public/app.js','public/style.css','public/arts.js']) {
 if(!fs.existsSync(path.join(dir,p))) throw Error('Missing game file: '+p);
}
console.log('Picture Spies game unpacked');
