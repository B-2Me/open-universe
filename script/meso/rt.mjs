import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const w = await mod.exports();
w._meso3i_init(24,12,12,1);
// seed hot excitation on even sites, tick, then scan photon coords
const NMOV=w._meso3i_nch()-1,REST=NMOV;
// absorb smoke: photons seeded INSIDE a mass slab — does parked fire?
var NMOV2=w._meso3i_nch()-1, REST2=NMOV2;
w._meso3i_init(24,12,12,1); w._meso3i_collmode(0); w._meso3i_friction(8);
w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_phth(0);
for(let z=0;z<12;z++)for(let y=0;y<12;y++)for(let x=8;x<16;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST2,64);
for(let z=0;z<12;z++)for(let y=0;y<12;y++)for(let x=4;x<8;x++)
  if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,32);   // OUTSIDE slab, beam aimed at it
let exc=()=>{let e=0;for(let z=0;z<12;z++)for(let y=0;y<12;y++)for(let x=8;x<16;x++)
  if(!((x+y+z)&1))e+=w._meso3i_eget(x,y,z);return e;};
console.log('seeded IPHN:',w._meso3i_photons());
for(let t=0;t<6;t++){ w._meso3i_tick();
  console.log(`t${t+1}: IPHN=${w._meso3i_photons()} slabN=${exc()}`); }
