// link3potential: the pair's effective V(r) — inventory defect +
// exchange intensity vs separation. Well (strong short-range) +
// tail (weak broadcast)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (gap) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(160,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  // pair at gap, antipodal windings (12^13 facing)
  for(let z=6;z<13;z++)for(let y=6;y<13;y++){
    for(let x=40;x<44;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=44+gap;x<48+gap;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
  }
  for(let t=0;t<150;t++)w._link3_tick();
  let mass=0,ph=0,ie=0,est=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<160;x++){
    if((x+y+z)&1)continue;
    let v=w._link3_rest(x,y,z);for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    mass+=v;ie+=w._link3_eget(x,y,z);
    for(let c=0;c<NMOV;c++){ph+=w._link3_phget(x,y,z,c);
      if(x>40&&x<48+gap&&w._link3_sst(x,y,z,c)===3)est++;}
  }
  return {total:mass+ph+ie,est};
};
console.log('gap | pair total | sessions | (isolated=28,580)');
for(const g of [4,8,12,16,20,28]){
  const r = await run(g);
  console.log(`${g} | ${r.total} | ${r.est}`);
}
