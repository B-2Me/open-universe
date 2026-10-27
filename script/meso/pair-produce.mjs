// pair-produce (E27): gamma+gamma -> matter. Two counter-propagating
// photon beams on antipodal channels collide in a vacuum box — does
// rest mass appear where they meet? IPHOT>=8 gates it.
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
const W=48,H=48,D=48,NMOV=w._meso3i_nch()-1,REST=NMOV;
const run=(phot)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(0); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(phot);
  // +x beam on ch0 at x<12, -x beam on ch1 at x>36 (antipodal pair)
  for(let z=8;z<40;z++)for(let y=8;y<40;y++)for(let x=4;x<12;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,0,64);
  for(let z=8;z<40;z++)for(let y=8;y<40;y++)for(let x=36;x<44;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,1,64);
  w._meso3i_ev_reset();
  const series=[];
  for(let t=0;t<80;t++){
    w._meso3i_tick();
    if(t%20===0){ w._meso3i_rg_refresh(); series.push(`t${t}:rest=${w._meso3i_rest_mass()} pp=${w._meso3i_ev(7)} ph=${w._meso3i_photons()}`); }
  }
  console.log(`phot=${phot}  [${series.join(' | ')}]`);
};
console.log('E27 — photon pair production: does colliding light make matter?');
run(5); run(8);
