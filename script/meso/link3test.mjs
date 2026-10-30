// link3test: does the link engine form a lump? Baseline loop check.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(32,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(8);w._link3_emit(32);w._link3_phot(5);w._link3_drain_edge(2);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,100); }
for(let t=0;t<100;t++)w._link3_tick();
console.log(`rest=${w._link3_rest_mass()} mov=${w._link3_mov_mass()} phn=${w._link3_photons()} ev(emit)=${w._link3_ev(2)} deliv=${w._link3_ev(0)} refused=${w._link3_ev(6)}`);
