// link3bindfrac: binding fraction vs cluster size — defect per lump
// for pair vs chain vs isolated. Nature: binding/nucleon GROWS
// with cluster (deuterium 1.1 -> helium 7 MeV/nucleon).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (lumps, ticks) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  for(const[ox,wind]of lumps)
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wind,96);}
  for(let t=0;t<ticks;t++)w._link3_tick();
  let mass=0,ph=0,ie=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;
    let v=w._link3_rest(x,y,z);for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    mass+=v;ie+=w._link3_eget(x,y,z);
    for(let c=0;c<NMOV;c++)ph+=w._link3_phget(x,y,z,c);}
  return {mass,ph,ie,total:mass+ph+ie};
};
const pair   = await run([[40,12],[50,13]], 150);
const trio   = await run([[30,12],[45,13],[60,12]], 150);   // chain A+B+C
const lone   = await run([[40,12],[70,12]], 150);           // isolated x2 for baseline
console.log(`pair:   total=${pair.total}  per-lump=${(pair.total/2).toFixed(0)}`);
console.log(`chain3: total=${trio.total}  per-lump=${(trio.total/3).toFixed(0)}`);
console.log(`isolated: total=${lone.total}  per-lump=${(lone.total/2).toFixed(0)}`);
// binding fraction: defect per lump vs isolated
const base = lone.total/2;
console.log(`pair defect/lump: ${(1-(pair.total/2)/base).toFixed(3)}`);
console.log(`chain defect/lump: ${(1-(trio.total/3)/base).toFixed(3)}`);
