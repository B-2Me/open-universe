// fusecad validation (E45): energy-as-cadence. Same total photons,
// dense (every-tick) vs sparse (every-4-tick) trains at fusecad(4).
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
const W=48,H=24,D=24;
for(const cad of [0,2,4,8]){
for(const gap of [1,4]){
  const w = await mod.exports();   /* fresh instance: iPT residue
    from prior runs would contaminate the cadence gate */
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_fusecad(cad);
  for(let t=0;t<40;t++){
    if(t<16 && t%gap===0)
      for(let z=6;z<18;z++)for(let y=6;y<18;y++){
        if(!((4+y+z)&1))  w._meso3i_phset_nu(4,y,z,12,1,4);
        if(!((44+y+z)&1)) w._meso3i_phset_nu(44,y,z,13,1,4);
      }
    w._meso3i_tick();
  }
  console.log(`fusecad=${cad} gap=${gap}: fused=${w._meso3i_ev(7)} phn=${w._meso3i_photons()}`);
}}
