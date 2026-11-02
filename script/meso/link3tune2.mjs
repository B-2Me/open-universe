// link3tune2: deeper sweep — can the lump reach meso3i-scale retention?
// vary emission/park/wound drain + does photon feed help accrete?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,em,fr,ph,feed] of [
    ['emit=1 fric=32',1,32,5,0],
    ['emit=4 fric=8',4,8,5,0],
    ['emit=4 fric=64',4,64,5,0],
    ['emit=4+photfeed',4,32,5,1],   // photon rain -> accretion?
    ['emit=4 iq',4,32,5,0],
  ]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(32,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(fr);w._link3_emit(em);w._link3_phot(ph);w._link3_drain_edge(2);
  if(tag.includes('iq'))w._link3_iqmode(1);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,100); }
  for(let t=0;t<150;t++){
    if(feed) for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<26;x++)
      if(!((x+y+z)&1))w._link3_phset(x,y,z,13,16);
    w._link3_tick();
  }
  const iq = tag.includes('iq') ? ` iq=${w._link3_ev(5)}` : '';
  console.log(`${tag}: rest=${w._link3_rest_mass()} mov=${w._link3_mov_mass()} phn=${w._link3_photons()}${iq}`);
}
