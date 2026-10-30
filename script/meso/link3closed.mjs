// link3closed: closed-loop winding — mass balanced on c AND c^1
// (oscillation, not translation) vs open single-channel winding.
// meso3i's lesson: stable bound structures circulate.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const[tag,w1,w2]of[['open 12^13 (dir)',[[12]],[[13]]],['closed 12+13 both',[[12,13]],[[12,13]]],['closed 12^13 pair',[[12]],[[12,13]]]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  const lumps=[[40,w1],[50,w2]];
  for(const[ox,winds]of lumps)
    for(let z=6;z<13;z++)for(let y=6;y<13;y++)for(let x=ox-2;x<ox+2;x++)
      if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);for(const c of winds)w._link3_rset(x,y,z,c,96);}
  for(let t=0;t<200;t++)w._link3_tick();
  let a1=0,b1=0,m1=0,m2=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(x<48){a1+=v*x;m1+=v;}else{b1+=v*x;m2+=v;}}
  console.log(`${tag}: sep=${m1&&m2?(b1/m2-a1/m1).toFixed(1):0} (started ~10)`);
}
