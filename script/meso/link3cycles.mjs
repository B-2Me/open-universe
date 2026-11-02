// link3cycles: hunt for OSCILLATING registers — a lump's internal
// clock should be a cycle (something that returns to phase).
// Watch iE, iQ, photon counts over ticks on a charged lump.
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
w._link3_photdecay(64);w._link3_iqmode(1);
// charged lump + photon bath — does it breathe?
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,120); }
const spark=(v,mx)=>{const h=' .:+*#';return h[Math.min(6,Math.floor(v/mx*7))]};
const rows={ie:[],iq:[],ph:[]};
for(let t=0;t<120;t++){
  // gentle feed
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=28;x<32;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,13,8);
  w._link3_tick();
  let ie=0,iq=0;
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=16;x<32;x++){
    if((x+y+z)&1)continue;ie+=w._link3_eget(x,y,z);iq+=w._link3_qget(x,y,z);}
  rows.ie.push(ie);rows.iq.push(iq);rows.ph.push(w._link3_photons());
}
for(const k of ['ie','iq','ph']){
  const mx=Math.max(...rows[k],1);
  console.log(`${k}: ${rows[k].map(v=>spark(v,mx)).join('')}`);
}
console.log(`ie range: ${Math.min(...rows.ie)}-${Math.max(...rows.ie)} | iq: ${Math.min(...rows.iq)}-${Math.max(...rows.iq)} | ph: ${Math.min(...rows.ph)}-${Math.max(...rows.ph)}`);
