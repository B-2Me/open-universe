// link3merge: coerce two cycles into one — sustained photon feed
// in the gap keeps the exchange alive until the lumps' cycles
// overlap and fuse. Measure the merged transaction rate vs parts.
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
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);w._link3_grav(48);
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
}
const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
  for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  m+=v;sx+=v*x;}return m?sx/m:0;};
const out=[];
for(let t=0;t<400;t++){
  // sustained feed in the gap — keep the exchange alive
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,24);w._link3_phset(x,y,z,13,24);}
  w._link3_tick();
  if(t%50===0)out.push(`t${t}:L=${cent(0,32).toFixed(1)} R=${cent(32,64).toFixed(1)}`);
}
console.log(out.join(' | '));
console.log(`rest=${w._link3_rest_mass()} fus=${w._link3_ev(9)} conv=${w._link3_ev(8)}`);
