// link3seslife: session lifecycle duration — how long does a bond
// live (LISTEN->ESTAB->CLOSED)? The bond's characteristic time.
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
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
for(let z=6;z<13;z++)for(let y=6;y<13;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
  for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
}
// track session states over time in the gap
const counts=t=>{const c=[0,0,0,0,0];
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1))for(let ch=0;ch<NMOV;ch++){const s=w._link3_sst(x,y,z,ch);if(s>=0&&s<5)c[s]++;}
  return c;};
for(let t=0;t<=200;t++){
  if(t%40===0){const c=counts();console.log(`t${t}: listen=${c[1]} syn=${c[2]} estab=${c[3]} closed=${c[4]}`);}
  w._link3_tick();
}
