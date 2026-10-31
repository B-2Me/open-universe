// link3pe: momentum/energy ratio on absorption — p/E = 1 in c=1
// units. Does the kick scale with the photon's nu?
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
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);w._link3_recoil(1);
  // dense absorber at x=40-46
  for(let z=7;z<13;z++)for(let y=7;y<13;y++)for(let x=40;x<46;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_snu_set(x,y,z,nu);w._link3_eset(x,y,z,0);}
  // beam: photons on +x with fixed nu, same count for all runs
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=10;x<16;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);w._link3_phnu_set(x,y,z,12,nu);}
  for(let t=0;t<80;t++)w._link3_tick();
  // momentum in the absorber's +x drest
  let dr=0,abs=w._link3_ev(7);
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=38;x<50;x++)
    if(!((x+y+z)&1))dr+=w._link3_drest(x,y,z,12);
  return {dr,abs:w._link3_ev(7),kick:w._link3_ev(16),tr:w._link3_ev(17)};
};
console.log('nu | +x momentum deposited | photons absorbed | p/E (dr/nu)');
for(const nu of [8,16,32,64]){
  const r=await run(nu);
  console.log(`nu=${nu}: transit_loss=${r.tr} real_abs=${r.abs} recoil=${r.kick} p/E=${(r.kick/Math.max(1,r.abs)).toFixed(2)}`);
}
