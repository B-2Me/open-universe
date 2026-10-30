// link3chainlen: how far does peer-to-peer chaining go? A chain of
// N lumps, alternating windings — do all gaps hold sessions?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const N of [3,5,7]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(128,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
  // chain of N lumps, alternating +x/-x winding
  for(let i=0;i<N;i++){
    const ox=20+i*10;
    const ends=(i===0||i===N-1);
    const wind=i%2?13:12;   // endpoints wound inward, middles balanced
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);
        if(ends){w._link3_rset(x,y,z,wind,96);}
        else{w._link3_rset(x,y,z,12,80);w._link3_rset(x,y,z,13,80);}}
  }
  for(let t=0;t<200;t++)w._link3_tick();
  // sessions per gap
  const gaps=[];
  for(let g=0;g<N-1;g++){
    const a=20+g*10+4,b=20+g*10+8;
    let n=0;
    for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=a;x<b;x++)
      if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;
    gaps.push(n);
  }
  console.log(`N=${N}: gaps=[${gaps.join(',')}]`);
}
