// link3chain: the "triplet" as a session CHAIN — A(+x) B(balanced)
// C(-x). Does a shared middle lump hold sessions on both links?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const[tag,wb]of[['B balanced (12+13)',[12,13]],['B open -x',[13]]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  const lumps=[[38,[12]],[48,wb],[58,[13]]];
  for(const[ox,winds]of lumps)
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);for(const c of winds)w._link3_rset(x,y,z,c,96);}
  for(let t=0;t<200;t++)w._link3_tick();
  // sessions on the two gaps: A-B (x~36-44) and B-C (x~52-60)
  const gap=(a,b)=>{let n=0;for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=a;x<b;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;return n;};
  console.log(`${tag}: A-B sessions=${gap(36,44)} B-C sessions=${gap(52,60)}`);
}
