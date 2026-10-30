// link3purity: fraction of beam still on the +x channel vs distance —
// the diffusion rate measured without spatial-wrap confounds.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(96,32,32,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(0);w._link3_phot(0);w._link3_drain_edge(0);w._link3_phspread(64);
for(let t=0;t<80;t++){
  for(let z=14;z<19;z++)for(let y=14;y<19;y++)for(let x=4;x<10;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,12,8);
  w._link3_tick();
}
console.log('x-slab | % on +x | % on diagonals | % on -x');
for(let a=12;a<88;a+=12){
  let px=0,pd=0,pm=0;
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=a;x<a+8;x++){
    if((x+y+z)&1)continue;
    px+=w._link3_phget(x,y,z,12);
    pm+=w._link3_phget(x,y,z,13);
    for(let c=0;c<12;c++)pd+=w._link3_phget(x,y,z,c);
  }
  const t=px+pd+pm;
  console.log(`x~${a+4}: ${(100*px/Math.max(1,t)).toFixed(1)}% | ${(100*pd/Math.max(1,t)).toFixed(1)}% | ${(100*pm/Math.max(1,t)).toFixed(2)}%`);
}
