// link3bond: two lumps + photon exchange — do they find equilibrium?
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
w._link3_photdecay(64);w._link3_recoil(1);
// two lumps, 12 apart + photon cavity between
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=22;x<28;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,120);}
  for(let x=36;x<42;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,120);}
}
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=28;x<36;x++)
  if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,24);w._link3_phset(x,y,z,13,24);}
// track both lump centroids over time
const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
  for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  m+=v;sx+=v*x;}return m?sx/m:0;};
const out=[];
for(let t=0;t<160;t++){
  w._link3_tick();
  if(t%20===0)out.push(`t${t}:L=${cent(0,34).toFixed(1)} R=${cent(30,64).toFixed(1)}`);
}
console.log(out.join(' | '));
console.log(`rest=${w._link3_rest_mass()} phn=${w._link3_photons()}`);
