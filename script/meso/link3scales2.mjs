// link3scales2: remaining dynamical scales — lump drift speed,
// session lifecycle duration, photon cascade rate
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(96,20,20,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
// wound lump — drifts; measure speed
for(let z=7;z<13;z++)for(let y=7;y<13;y++)for(let x=20;x<26;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
const cx=()=>{let m=0,c=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let cc=0;cc<NMOV;cc++)v+=w._link3_drest(x,y,z,cc);
    m+=v;c+=v*x;}return m?c/m:0;};
const x0=cx();
for(let t=0;t<100;t++)w._link3_tick();
const x1=cx();
console.log(`lump drift: ${(x1-x0).toFixed(1)} cells in 100 ticks = ${((x1-x0)/100).toFixed(3)} cells/tick`);
console.log(`photon speed: 2 cells/tick — lump drifts at ${(((x1-x0)/100/2)*100).toFixed(1)}% of c`);
