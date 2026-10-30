// link3bindcurve: binding fraction vs cluster size — nature's curve
// rises then saturates (iron peak ~56 nucleons). Ours?
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
  w._link3_init(160,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  for(const[ox,wind]of lumps)
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wind,96);}
  for(let t=0;t<ticks;t++)w._link3_tick();
  let t2=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<160;x++){
    if((x+y+z)&1)continue;
    let v=w._link3_rest(x,y,z);for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    t2+=v+w._link3_eget(x,y,z);
    for(let c=0;c<NMOV;c++)t2+=w._link3_phget(x,y,z,c);}
  return t2;
};
for(const N of [2,3,4,5,6]){
  const lumps=[];
  for(let i=0;i<N;i++)lumps.push([20+i*9, i%2?13:12]);
  const t=await run(lumps,150);
  console.log(`N=${N}: per-lump=${(t/N).toFixed(0)}  defect/lump=${(1-(t/N)/19565).toFixed(3)}`);
}
