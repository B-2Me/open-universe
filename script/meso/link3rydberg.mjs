// link3rydberg: spectral line vs excitation — does site nu scale
// linearly or quadratically with charge? Compare to Rydberg 1/n^2.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
console.log('iE | site nu | (nu - winding) | sqrt spacing?');
for(const ie of [0,20,40,60,80,120,160,200,240]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);w._link3_egate(0);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,ie); w._link3_rset(x,y,z,12,96); }
  w._link3_tick();
  const nu=w._link3_snu(24,8,8);
  console.log(`${ie} | ${nu} | +${nu-12}`);
}
