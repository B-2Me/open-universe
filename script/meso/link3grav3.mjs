// link3grav3: does mass climb the density gradient? Two seeds —
// one dense (attractor), one sparse — does mass drift toward dense?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,gr] of [['grav=0',0],['grav=16',16]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
  if(w._link3_grav)w._link3_grav(gr);
  // dense seed x=30-36, sparse mass ring x=10-20 — does it migrate?
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<36;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,128);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=10;x<20;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,32);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<36;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,64);
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<28;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++){v+=w._link3_drest(x,y,z,c);v+=w._link3_upget(x,y,z,c);}
    m+=v;sx+=v*x;}return m?sx/m:0;};
  for(let t=0;t<200;t++)w._link3_tick();
  console.log(`${tag}: sparse-zone centroid x=${cent().toFixed(1)} (started ~15 — did it drift toward x=30 lump?)`);
}
