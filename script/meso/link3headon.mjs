// link3headon: opposing beams on the same wire — does the duplex
// load go bidirectional, and does iQ catch the head-on collision?
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
w._link3_friction(0);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(2);
w._link3_iqmode(1);w._link3_iqcap(48);w._link3_iqdwell(8);
// beams meeting head-on: +x from left, -x from right
for(let z=4;z<12;z++)for(let y=4;y<12;y++){
  for(let x=4;x<12;x++)if(!((x+y+z)&1))w._link3_set(x,y,z,12,96);
  for(let x=52;x<60;x++)if(!((x+y+z)&1))w._link3_set(x,y,z,13,96);
}
let upT=0,dnT=0,iqT=0;
for(let t=0;t<60;t++){
  w._link3_tick();
  if(t>40){
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=28;x<36;x++){
      if((x+y+z)&1)continue;
      upT+=w._link3_load(x,y,z,12);dnT+=w._link3_load(x,y,z,13);
      iqT+=w._link3_qget(x,y,z);}
  }
}
console.log(`crossing zone: up(+x)=${upT} dn(-x)=${dnT} iQ=${iqT} iq-ev=${w._link3_ev(5)} flush=${w._link3_ev(10)}`);
