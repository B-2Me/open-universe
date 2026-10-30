// link3composite: does a hub+clients bound state act as ONE particle?
// Wind the whole cluster — does it move coherently as a composite?
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
w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
// hub + 2 clients, all wound +x — do they drift together?
for(let z=6;z<14;z++)for(let y=5;y<16;y++)for(let x=34;x<42;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,96);w._link3_eset(x,y,z,200);w._link3_rset(x,y,z,12,96);}
for(let z=8;z<13;z++)for(let y=8;y<13;y++){
  for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,48);w._link3_eset(x,y,z,120);w._link3_rset(x,y,z,12,96);}
  for(let x=46;x<50;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,48);w._link3_eset(x,y,z,120);w._link3_rset(x,y,z,12,96);}
}
// build sessions
for(let t=0;t<80;t++){
  for(let z=5;z<16;z++)for(let y=5;y<16;y++)for(let x=26;x<50;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,16);w._link3_phset(x,y,z,13,16);}
  w._link3_tick();
}
const cent=()=>{let m=0,sx=0;for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
  if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
  for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  m+=v;sx+=v*x;}return m?sx/m:0;};
const spread=()=>{let cx=cent(),s=0,n=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    if(v>0){s+=Math.abs(x-cx);n+=v;}}
  return n?s/n:0;};
const x0=cent(),s0=spread();
for(let t=0;t<150;t++)w._link3_tick();
console.log(`composite: drift=${(cent()-x0).toFixed(1)} spread=${s0.toFixed(1)}->${spread().toFixed(1)} rest=${w._link3_rest_mass()}`);
