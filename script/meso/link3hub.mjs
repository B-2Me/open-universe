// link3hub: the server+clients topology — a DENSE hub holds sessions
// to multiple light clients. Does the star form better than the
// pairwise triangle?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,20,20,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
// dense hub at center + 2 light clients left/right (the star)
for(let z=6;z<14;z++)for(let y=5;y<16;y++)for(let x=28;x<36;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,96);w._link3_eset(x,y,z,200);}  // heavy hub
for(let z=8;z<13;z++)for(let y=8;y<13;y++){
  for(let x=20;x<24;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,48);w._link3_eset(x,y,z,120);}
  for(let x=40;x<44;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,48);w._link3_eset(x,y,z,120);}
}
// photon bath everywhere — let sessions form
for(let t=0;t<150;t++){
  for(let z=5;z<16;z++)for(let y=5;y<16;y++)for(let x=18;x<48;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,12);w._link3_phset(x,y,z,13,12);}
  w._link3_tick();
}
// count sessions per region: hub-clients links vs elsewhere
let hubEst=0,farEst=0;
for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=20;x<44;x++){
  if((x+y+z)&1)continue;
  for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3){
    if((x>=24&&x<28)||(x>=36&&x<40))hubEst++;else farEst++;}
}
console.log(`hub-region ESTAB=${hubEst} far=${farEst}`);
