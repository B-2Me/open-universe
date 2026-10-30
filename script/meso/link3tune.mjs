// link3tune: sweep the retention knobs — emission rate vs park threshold
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [em,fr] of [[32,8],[8,8],[8,32],[4,32],[2,64]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(32,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(fr);w._link3_emit(em);w._link3_phot(5);w._link3_drain_edge(2);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,100); }
  for(let t=0;t<150;t++)w._link3_tick();
  console.log(`emit=${em} fric=${fr}: rest=${w._link3_rest_mass()} mov=${w._link3_mov_mass()} phn=${w._link3_photons()}`);
}
