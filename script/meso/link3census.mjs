// link3census: the element spectrum — sweep charge x winding,
// map each species' spectral line and stability. The substrate's
// periodic table as a charge/winding matrix.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
console.log('species matrix (site nu | stability=rest after 120t):');
for (const [tag,ie,wind] of [['',80,12],['',160,12],['',240,12],['',160,0],['',160,4],['',160,8],['',160,16]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,ie); w._link3_rset(x,y,z,wind,96); }
  for(let t=0;t<10;t++)w._link3_tick();
  const nu=w._link3_snu(24,8,8);
  for(let t=0;t<120;t++)w._link3_tick();
  console.log(`  iE=${ie} wind=${wind}: line=${nu} rest=${w._link3_rest_mass()}`);
}
