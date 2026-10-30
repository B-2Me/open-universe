// link3shared: shared-structure binding — do same-wound lumps move
// together (bound through structure, not exchange)? Compare
// same-wind vs antipodal vs transverse drift correlation.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const[tag,wa,wb]of[['12^13 facing',12,13],['14^14 same-y',14,14],['14^15 opp-y',14,15],['12^12 same-x',12,12]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  for(let z=6;z<13;z++)for(let y=6;y<13;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wa,96);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wb,96);}
  }
  for(let t=0;t<150;t++)w._link3_tick();
  // centroid of each lump's mass — do they stay together?
  let a1=0,b1=0,m1=0,m2=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(x<32){a1+=v*x;m1+=v;}else{b1+=v*x;m2+=v;}}
  const sep=m1&&m2?(b1/m2-a1/m1):0;
  let ay=0,by=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(x<32){ay+=v*y;}else{by+=v*y;}}
  const ysep=m1&&m2?Math.abs(by/m2-ay/m1):0;
  console.log(`${tag}: x-sep=${sep.toFixed(1)} y-sep=${ysep.toFixed(1)} m1=${m1} m2=${m2}`);
}
