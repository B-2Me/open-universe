// link3spread: beam-width vs propagation distance — does the halo
// grow sqrt(d) (diffusion) or linear d (fixed cone)?
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
// continuous +x beam from x=8 at y=z=16
for(let t=0;t<80;t++){
  for(let z=14;z<19;z++)for(let y=14;y<19;y++)for(let x=4;x<10;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,12,8);
  w._link3_tick();
}
// beam width (RMS transverse spread) in slabs at increasing x
console.log('x-slab | photons | RMS transverse width | sqrt(x) norm | linear norm');
for(let a=16;a<88;a+=12){
  let n=0,sy=0,sz=0,syy=0,szz=0;
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=a;x<a+8;x++){
    if((x+y+z)&1)continue;
    let p=0;for(let c=0;c<NMOV;c++)p+=w._link3_phget(x,y,z,c);
    n+=p;sy+=p*y;sz+=p*z;syy+=p*y*y;szz+=p*z*z;
  }
  if(!n){console.log(`x~${a+4}: (empty)`);continue;}
  const my=sy/n,mz=sz/n;
  const rms=Math.sqrt((syy+szz)/n-my*my-mz*mz);
  const d=a+4-8; // distance from source
  console.log(`x~${a+4}: n=${n} rms=${rms.toFixed(2)} sqrt=${(rms/Math.sqrt(d)).toFixed(3)} lin=${(rms/d).toFixed(3)}`);
}
