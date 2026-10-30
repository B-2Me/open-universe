// link3falloff: exchange intensity vs separation — the honest
// ratio measurement. Count transactions (absorbs at B) driven by
// A's emission vs gap. Compare to 1/r^2 dilution / exp screening.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
// A emits +x (wound 12), B wound -x is the absorber. Measure
// photons hitting B's region vs the gap.
console.log('gap | photons reaching B zone | absorbs+conv at B');
for (const gap of [4,8,12,16,20,28]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(8);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  const x1=32-gap/2, x2=32+gap/2;
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=x1-2;x<x1+2;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=x2-2;x<x2+2;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
  }
  for(let t=0;t<120;t++)w._link3_tick();
  // photon density in B's zone + iE at B (absorbed energy proxy)
  let phB=0,ieB=0;
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=x2-4;x<x2+6;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)phB+=w._link3_phget(x,y,z,c);
    ieB+=w._link3_eget(x,y,z);
  }
  console.log(`${gap} | ${phB} | iE_B=${ieB}`);
}
