// implosion (E29): convergent photon implosion — photons on a shell
// all aimed inward, collide at focus, then stream away radially.
// Does the created mass survive in the photon-free pocket?
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
const W=48,H=48,D=48,C=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
const run=(phot)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(-4); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(phot);
  // spherical shell r in [18,20]: each photon on the axial channel
  // pointing most toward center (6-fold implosion)
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    const dx=x-C,dy=y-C,dz=z-C,r2=dx*dx+dy*dy+dz*dz;
    if(r2<324||r2>441)continue;
    const ax=Math.abs(dx),ay=Math.abs(dy),az=Math.abs(dz);
    let ch;
    if(ax>=ay&&ax>=az) ch = dx>0?13:12;      // ±x
    else if(ay>=ax&&ay>=az) ch = dy>0?15:14; // ±y
    else ch = dz>0?17:16;                    // ±z
    w._meso3i_phset(x,y,z,ch,128);
  }
  w._meso3i_ev_reset();
  const series=[];
  for(let t=0;t<300;t++){
    w._meso3i_drain_edge(2); w._meso3i_tick();
    if(t%30===0){ w._meso3i_rg_refresh();
      series.push(`t${t}:rest=${w._meso3i_rest_mass()} pp=${w._meso3i_ev(7)} ph=${w._meso3i_photons()}`); }
  }
  console.log(`phot=${phot} [${series.join(' | ')}]`);
};
console.log('E29 — convergent photon implosion: does the focus keep its mass?');
run(8);
