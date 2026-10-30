// link3nu: does the nu tag create a real spectrum? Feed photons
// carrying different nu signatures to a lump — does it absorb
// preferentially by frequency, not just direction?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
// lump wound +x: photons arriving +x with nu=12 should match;
// photons arriving +x but tagged differently should reject.
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_photdecay(96);w._link3_egate(16);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_rset(x,y,z,12,96); }
w._link3_ev_reset();
// feed +x photons — they arrive on c=12 with nu=12 (matching signature)
for(let t=0;t<120;t++){
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=4;x<10;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,16);} // nu=c=12 auto-tagged
  w._link3_tick();
}
console.log(`nu-matched feed: absorb=${w._link3_ev(7)} conv=${w._link3_ev(8)} reject=${w._link3_ev(15)}`);
