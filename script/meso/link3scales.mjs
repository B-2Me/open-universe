// link3scales: the substrate's dynamical scales — measure the
// characteristic times and lengths the engine produces
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');

// 1. session formation time — ticks from seed to ESTAB
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,20,20,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
for(let z=6;z<13;z++)for(let y=6;y<13;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
  for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
}
let tEstab=-1;
for(let t=0;t<200;t++){
  w._link3_tick();
  if(tEstab<0){
    for(let z=0;z<20&&tEstab<0;z++)for(let y=0;y<20&&tEstab<0;y++)for(let x=28;x<36&&tEstab<0;x++)
      if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3){tEstab=t;break;}
  }
}
console.log(`session formation: ${tEstab} ticks`);
console.log(`photon speed: 2 cells/tick (axis)`);
