// link3breathe: the lump's own charge cycle — no sustained feed.
// Seed iE, watch it dump (burst) then... does anything refill it?
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
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,180); }
const spark=(v)=>{const h=' .:+*#';return h[Math.min(6,Math.floor(v/255*7))]};
const tr=[];
for(let t=0;t<200;t++){
  w._link3_tick();
  // lump's OWN photons re-absorbing = self-feeding breath?
  let ie=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=21;x<27;x++){
    if((x+y+z)&1)continue;ie+=w._link3_eget(x,y,z);}
  tr.push(ie);
}
const mx=Math.max(...tr,1);
console.log(`lump iE total: ${tr.map(v=>spark(v/6)).join('')}`);
console.log(`bursts=${w._link3_ev(11)} conv=${w._link3_ev(8)} iE: ${tr[0]}->${tr[199]}`);
