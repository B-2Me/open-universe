// link3twoforce: does the potential split? High-nu mediator dies
// (nuclear short-range) vs low-nu travels (Coulomb long tail).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (R, nu) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(128,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);
  // photon burst on channel 12 (+x) with fixed nu, measure flux at R
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=20;x<24;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);
      for(let t=0;t<1;t++){}}
  // set the nu tags: phset tags with channel — override via direct phnu
  // (phnu(x,y,z,c,nu) if exported — else the tag IS the channel)
  for(let t=0;t<Math.floor(R/2)+3;t++)w._link3_tick();
  let rx=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=22;x<128;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)rx+=w._link3_phget(x,y,z,c);
  return rx;
};
console.log('flux arriving vs distance (phset nu=channel):');
for(const R of [4,8,12,16,20]){
  console.log(`R=${R}: flux=${await run(R)}`);
}
