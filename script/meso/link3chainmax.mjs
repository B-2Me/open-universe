// link3chainmax: where does the chain stop binding? Push N until
// gaps start failing — the substrate's saturation point.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const N of [9,12,16,20]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(256,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  for(let i=0;i<N;i++){
    const ox=10+i*12, ends=(i===0||i===N-1), wind=i%2?13:12;
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);
        if(ends)w._link3_rset(x,y,z,wind,96);else{w._link3_rset(x,y,z,12,80);w._link3_rset(x,y,z,13,80);}}
  }
  for(let t=0;t<200;t++)w._link3_tick();
  const gaps=[];let dead=0;
  for(let g=0;g<N-1;g++){
    let n=0;
    for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=10+g*12+2;x<10+g*12+10;x++)
      if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;
    gaps.push(n);if(!n)dead++;
  }
  let allsst=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<256;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)allsst++;
  console.log(`N=${N}: dead_gaps=${dead}/${N-1} total_estab=${allsst} gaps=[${gaps.join(',')}]`);
}
