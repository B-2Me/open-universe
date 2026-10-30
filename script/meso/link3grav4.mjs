// link3grav4: capture asymmetry — does sparse mass DEPLETE toward
// the lump? jitter + differential capture, measure zone totals.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,gr] of [['grav=0',0],['grav=64',64]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(2);
  if(w._link3_grav)w._link3_grav(gr);
  // sparse mass LEFT, lump RIGHT
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=10;x<20;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,32);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<36;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,64);
  const sparse=()=>{let m=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<26;x++){
    if((x+y+z)&1)continue;m+=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++){m+=w._link3_drest(x,y,z,c);m+=w._link3_upget(x,y,z,c);}}return m;};
  const lump=()=>{let m=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=26;x<48;x++){
    if((x+y+z)&1)continue;m+=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++){m+=w._link3_drest(x,y,z,c);m+=w._link3_upget(x,y,z,c);}}return m;};
  const s0=sparse(),l0=lump();
  for(let t=0;t<200;t++)w._link3_tick();
  console.log(`${tag}: sparse ${s0}->${sparse()} lump ${l0}->${lump()}`);
}
