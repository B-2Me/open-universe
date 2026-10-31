// link3pe2: photoelectric threshold — does absorption cut off
// sharply below the lump's line? (work function: photon needs
// nu >= W to liberate charge)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (nu) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(5);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);
  for(let z=7;z<13;z++)for(let y=7;y<13;y++)for(let x=40;x<46;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_snu_set(x,y,z,32);w._link3_eset(x,y,z,0);}
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=8;x<14;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);w._link3_phnu_set(x,y,z,12,nu);}
  for(let t=0;t<60;t++)w._link3_tick();
  return {abs:w._link3_ev(7),tr:w._link3_ev(17)};
};
console.log('photon nu | absorbed (lump line=32)');
for(const nu of [4,8,12,16,24,32,48]){
  const r=await run(nu);
  console.log(`nu=${nu}: absorbed=${r.abs}`);
}
