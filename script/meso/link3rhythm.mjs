// link3rhythm: does the iE beat have a real PERIOD? Autocorrelation
// of the charge trace — is the heartbeat rhythmic or just bursty?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,80); }
const tr=[];
for(let t=0;t<300;t++){
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=28;x<32;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,13,6);
  w._link3_tick();
  tr.push(w._link3_eget(24,8,8));
}
// autocorrelation — is there a period?
const mean=tr.reduce((a,b)=>a+b)/tr.length;
for(const lag of [1,2,4,8,16,24,32]){
  let num=0,den=0;
  for(let i=0;i<tr.length-lag;i++){num+=(tr[i]-mean)*(tr[i+lag]-mean);den+=(tr[i]-mean)**2;}
  process.stdout.write(`lag${lag}:${(num/den).toFixed(2)} `);
}
console.log(`\niE trace: ${tr.slice(-40).map(v=>{const h=' .:+*#';return h[Math.min(6,Math.floor(v/255*7))]}).join('')}`);
