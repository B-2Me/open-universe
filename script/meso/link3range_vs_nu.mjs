// link3range_vs_nu: does mediator range scale as 1/nu?
// (Compton law: range ~ 1/mass — heavy mediator = short range)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (nu, hops) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(128,20,20,1);
  const NMOV=w._link3_nch()-1;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=20;x<24;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);w._link3_phnu_set(x,y,z,12,nu);}
  for(let t=0;t<hops;t++)w._link3_tick();
  let n=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<128;x++)
    for(let c=0;c<NMOV;c++)n+=w._link3_phget(x,y,z,c);
  return n;
};
for(const nu of [4,8,16,32,64]){
  const s=await run(nu,12);
  console.log(`nu=${nu}: survivors after 12 hops = ${s} (${(s/2048*100).toFixed(1)}%)`);
}
