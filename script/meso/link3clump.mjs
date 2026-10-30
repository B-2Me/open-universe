// link3clump: does lgrav pull scattered mass into structure?
// Sprinkle diffuse mass, watch it clump (Jeans analog).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,gr] of [['grav=0',0],['grav=32',32]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(0);w._link3_drain_edge(2);
  if(w._link3_grav)w._link3_grav(gr);
  // diffuse mass sprinkle + a seed lump
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=4;x<44;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,(x*7+y*3+z*5)%NMOV,4);
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=22;x<26;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,64);
  for(let t=0;t<100;t++)w._link3_tick();
  // mass profile — did diffuse mass migrate toward the seed?
  const prof=[];
  for(let x=8;x<48;x+=4){
    let s=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x2=x;x2<x+4;x2++){
      if((x2+y+z)&1)continue;s+=w._link3_rest(x2,y,z);for(let c=0;c<NMOV;c++)s+=w._link3_drest(x2,y,z,c);}
    prof.push(s);}
  console.log(`${tag}: ${prof.join(',')}`);
}
