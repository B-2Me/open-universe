// link3pairprod: does photon fusion create a particle+antiparticle
// PAIR (balanced winding) — and can they re-annihilate?
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
w._link3_friction(32);w._link3_emit(4);w._link3_phot(0);w._link3_drain_edge(2);
w._link3_fusion(96);w._link3_annih(64);w._link3_egate(16);
// dense opposing photon beams crossing — pair production at the crossing
for(let z=4;z<12;z++)for(let y=4;y<12;y++){
  for(let x=6;x<12;x++)if(!((x+y+z)&1))w._link3_phset(x,y,z,12,200);
  for(let x=36;x<42;x++)if(!((x+y+z)&1))w._link3_phset(x,y,z,13,200);
}
for(let t=0;t<100;t++)w._link3_tick();
// check for balanced winding — the fusion deposit should be {c,c^1} pairs
let plus=0,minus=0;
for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++){
  if((x+y+z)&1)continue;
  plus+=w._link3_drest(x,y,z,12);minus+=w._link3_drest(x,y,z,13);}
console.log(`drest +x=${plus} -x=${minus} fus=${w._link3_ev(9)} annih=${w._link3_ev(12)} rest=${w._link3_rest_mass()}`);
