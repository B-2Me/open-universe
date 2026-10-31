// link3range: where does the bond DIE? The reach is the force's
// characteristic length — photon lifetime x c. Inside-range flat
// is what a short-range force looks like; find the edge.
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
  w._link3_init(220,24,24,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);w._link3_photdecay(96);
  for(let z=9;z<15;z++)for(let y=9;y<15;y++)for(let x=150;x<156;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,255);}
  for(let z=10;z<14;z++)for(let y=10;y<14;y++)for(let x=153-R-2;x<153-R+2;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,32);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
  for(let t=0;t<200;t++)w._link3_tick();
  let est=0;
  for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=40;x<160;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)est++;
  return est;
};
for(const R of [8,16,24,32,40,48]){
  console.log(`gap=${R}: sessions=${await run(R)}`);
}
