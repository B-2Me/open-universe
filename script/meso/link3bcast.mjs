// link3bcast: broadcast "bond" — does received FLUX fall off with
// distance (1/r^2 field) where the session bond was flat?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (R) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(160,32,32,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  // hub at center — broadcast emitter (no winding: emits isotropically)
  for(let z=13;z<19;z++)for(let y=13;y<19;y++)for(let x=77;x<83;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,255);}
  for(let t=0;t<200;t++)w._link3_tick();
  // flux received at a test site at distance R (photons arriving there)
  let rx=0;
  for(let z=14;z<18;z++)for(let y=14;y<18;y++)for(let x=80-R-2;x<80-R+2;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)rx+=w._link3_phget(x,y,z,c);
  return rx;
};
console.log('received flux vs distance (broadcast):');
for(const R of [4,8,12,16,20,24,32]){
  console.log(`gap=${R}: flux=${await run(R)}`);
}
