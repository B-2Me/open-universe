// link3session: the bound state as a link-level session — does the
// wire between two lumps show sustained up/dn exchange (established
// connection) while a lone lump's wire shows up-only (tx into void)?
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
// bound pair at x=26-30 and 34-38 + photon exchange in gap
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
}
// measure up/dn traffic on the wire through the gap
const prof={up:[],dn:[]};
for(let t=0;t<150;t++){
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,24);w._link3_phset(x,y,z,13,24);}
  w._link3_tick();
  if(t>120){
    let u=0,d=0;
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++){
      if((x+y+z)&1)continue;
      u+=w._link3_load(x,y,z,12);d+=w._link3_load(x,y,z,13);}
    prof.up.push(u);prof.dn.push(d);
  }
}
console.log(`session up(A->B): ${prof.up.join(',')}`);
console.log(`session dn(B->A): ${prof.dn.join(',')}`);
