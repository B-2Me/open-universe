// bw-threshold (E44): does pair production have an energy threshold?
// Same-parity counter-beams of same-ν photons; count fusions per ν.
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
const W=48,H=24,D=24;
for(const nu of [1,2,3,4]){
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_fusemin(2);
  for(let z=6;z<18;z++)for(let y=6;y<18;y++){
    if(!((4+y+z)&1))  w._meso3i_phset_nu(4,y,z,12,nu,16);
    if(!((44+y+z)&1)) w._meso3i_phset_nu(44,y,z,13,nu,16);   // even-x: same lane
  }
  const ph0=w._meso3i_photons();
  for(let t=0;t<40;t++) w._meso3i_tick();
  w._meso3i_rg_refresh();
  console.log(`nu=${nu}: phn=${ph0}->${w._meso3i_photons()} fused=${w._meso3i_ev(7)} rest=${w._meso3i_rest_mass()}`);
}
