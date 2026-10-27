// photon-condense (E28): does pair-produced mass self-organize?
// Counter-beams collide (phot=8), storm passes + drains, then check:
// does a coherent rest lump survive where light met light?
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
  w._meso3i_fricmode(-4); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(phot);
  for(let z=8;z<40;z++)for(let y=8;y<40;y++)for(let x=4;x<12;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,0,64);
  for(let z=8;z<40;z++)for(let y=8;y<40;y++)for(let x=36;x<44;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,1,64);
  // collide for 60t, then freeze photon interaction (phot=0) and
  // let the field settle — can created mass outlive its own bath?
  for(let t=0;t<60;t++){ w._meso3i_drain_edge(3); w._meso3i_tick(); }
  w._meso3i_phot(0);
  for(let t=0;t<240;t++){ w._meso3i_drain_edge(3); w._meso3i_tick(); }
  w._meso3i_rg_refresh();
  // rest census + spatial coherence (does rest cluster or scatter?)
  let rest=0, sites=0, cx=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const v=w._meso3i_get(x,y,z,REST);
    if(v>0){ rest+=v; sites++; cx+=x*v; }
  }
  console.log(`phot=${phot}: rest=${rest} sites=${sites} ${sites?`centroid-x=${(cx/rest).toFixed(1)}`:''} ph=${w._meso3i_photons()}`);
};
console.log('E28 — does pair-produced mass condense into structure?');
run(5); run(8);
