// link3defect: binding non-additivity — bound exchanging pair vs
// 2x an unbound lump. The mass-defect analog: defect / total.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const mk=async()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();};
const inv=(w,NMOV)=>{
  let m=w._link3_rest_mass()+w._link3_mov_mass(),ph=w._link3_photons(),ie=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++)
    if(!((x+y+z)&1))ie+=w._link3_eget(x,y,z);
  return {m,ph,ie};
};
// bound pair (antipodal, exchanging) vs two isolated lumps
for(const[tag,n,wa,wb]of[['bound pair',2,12,13],['isolated x2',2,12,12]]){
  const w=await mk();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(1);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  const offs=tag==='bound pair'?[[28,12],[34,13]]:[[16,12],[46,12]];  // bound: close antipodal; isolated: far apart same-wind
  for(const[ox,wind]of offs)
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wind,96);}
  for(let t=0;t<150;t++)w._link3_tick();
  const v=inv(w,NMOV);
  console.log(`${tag}: mass=${v.m} photons=${v.ph} iE=${v.ie} total=${v.m+v.ie}`);
}
