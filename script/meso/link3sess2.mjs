// link3sess2: does lSESS read the bound pair's session?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
}
for(let t=0;t<150;t++){
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,24);w._link3_phset(x,y,z,13,24);}
  w._link3_tick();
}
// session strength on the wire through the gap vs elsewhere
let gap=0,far=0;
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=30;x<34;x++)if(!((x+y+z)&1))gap+=w._link3_sess(x,y,z,12);
  for(let x=44;x<50;x++)if(!((x+y+z)&1))far+=w._link3_sess(x,y,z,12);
}
console.log(`session: gap wire=${gap}  far wire=${far}`);
