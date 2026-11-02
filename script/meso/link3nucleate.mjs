// link3nucleate: spontaneous structure — photon bath -> photdecay
// seeds -> junction parks -> does a lump form from nothing?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,pd,fu] of [['fus=0',0,0],['fus=64',64,64],['fus=128',64,128]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_photdecay(pd);w._link3_egate(16);w._link3_fusion(fu);
  // tiny seed lump + broad photon bath — does it grow?
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=22;x<26;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,32);
  for(let t=0;t<150;t++){
    for(let z=2;z<14;z++)for(let y=2;y<14;y++)for(let x=2;x<46;x++)
      if(!((x+y+z)&1))for(let c=0;c<6;c++)w._link3_phset(x,y,z,c,8);
    w._link3_tick();
  }
  console.log(`${tag}: rest=${w._link3_rest_mass()} mov=${w._link3_mov_mass()} conv=${w._link3_ev(8)} phn=${w._link3_photons()}`);
}
