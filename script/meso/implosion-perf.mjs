// implosion-perf (E47): photon implosion on meso_perf vs meso3i —
// does convergent fusion fire on the perf kernel? Parity check.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const load = async (f) => {
  const src = readFileSync(join(here, `../../docs/public/wasm/ember/${f}`), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', src)
    (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), f);
  return mod.exports();
};
const run = async (f, W, H, D) => {
  const w = await load(f);
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0); w._meso3i_phot(9);
  const cx=W/2,cy=H/2,cz=D/2,r=W/5;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx=x-cx,dy=y-cy,dz=z-cz,rr=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(Math.abs(rr-r)<1.5 && !((x+y+z)&1))
      for(let c=12;c<18;c++){
        const vx=(c===12||c===13)?(c===12?2:-2):0,
              vy=(c===14||c===15)?(c===14?2:-2):0,
              vz=(c===16||c===17)?(c===16?2:-2):0;
        if(dx*vx+dy*vy+dz*vz<0)
          w._meso3i_phset_nu ? w._meso3i_phset_nu(x,y,z,c,1,8) : w._meso3i_phset(x,y,z,c,8);
      }
  }
  for(let t=0;t<60;t++) w._meso3i_tick();
  w._meso3i_rg_refresh && w._meso3i_rg_refresh();
  console.log(`${f} ${W}x${H}x${D}: fused=${w._meso3i_ev(7)} rest=${w._meso3i_rest_mass()} phn=${w._meso3i_photons()}`);
};
await run('meso3i.js',48,24,24);
await run('meso_perf.js',48,24,24);
await run('meso_perf.js',96,48,48);
