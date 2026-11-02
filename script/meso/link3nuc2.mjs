// link3nuc2: does CONCENTRATED light nucleate locally? Two photon
// beams head-on into a region — density spike -> fusion fires there.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(0);w._link3_drain_edge(2);
w._link3_fusion(96);w._link3_egate(16);w._link3_photdecay(96);w._link3_phot(5);
// a seed at x=24 + opposing photon beams — does the seed eat the light?
for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=22;x<26;x++)
  if(!((x+y+z)&1))w._link3_set(x,y,z,REST,64);
for(let z=4;z<12;z++)for(let y=4;y<12;y++){
  for(let x=4;x<10;x++)if(!((x+y+z)&1))w._link3_phset(x,y,z,12,200);
  for(let x=38;x<44;x++)if(!((x+y+z)&1))w._link3_phset(x,y,z,13,200);
}
for(let t=0;t<80;t++)w._link3_tick();
// where did mass form?
let tot=0;const prof=[];
for(let x=0;x<48;x+=4){
  let s=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x2=x;x<x+4&&x2<48;x2++){
    if((x2+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._link3_drest(x2,y,z,c);}
  prof.push(s);tot+=s;}
console.log(`drest by x-block: ${prof.join(',')}`);
console.log(`total drest=${tot} fus=${w._link3_ev(9)} phn=${w._link3_photons()}`);
