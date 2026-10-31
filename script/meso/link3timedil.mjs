// link3timedil: time dilation — does a MOVING lump's charge rate
// slow? (the still factor: lFLUX dilutes absorption — measure
// iE gain vs lump's motion)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (wind) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(80,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);
  // lump wound (moving) or not — fed photons to absorb
  for(let z=7;z<13;z++)for(let y=7;y<13;y++)for(let x=38;x<44;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,140);
      if(wind)w._link3_rset(x,y,z,wind,96);
      w._link3_snu_set(x,y,z,32);w._link3_eset(x,y,z,0);}
  // steady feed of matching-nu photons
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=8;x<14;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);w._link3_phnu_set(x,y,z,12,32);}
  for(let t=0;t<80;t++)w._link3_tick();
  let ie=0,flx=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=34;x<50;x++){
    if((x+y+z)&1)continue;
    ie+=w._link3_eget(x,y,z);flx+=w._link3_load(x,y,z);}
  return {ie,flx,abs:w._link3_ev(7)};
};
const still=await run(0), moving=await run(12);
console.log(`static lump: absorbed=${still.abs} iE gained=${still.ie}`);
console.log(`moving lump (wind=12): absorbed=${moving.abs} iE gained=${moving.ie}`);
console.log(`dilation: absorbed ratio=${(moving.abs/Math.max(1,still.abs)).toFixed(3)}`);
