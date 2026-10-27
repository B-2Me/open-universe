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
// channel vectors (D3Q19): 12 face-diagonals + 6 axial — used for aim
const CHV = [[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],
             [1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1],
             [2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
const W=48,H=48,D=48,C=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
const TWIST = Number(process.argv[2] || 0);
const run=(phot)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(-4); w._meso3i_drest(Number(process.argv[3] || 1)); w._meso3i_reflect(0);
  w._meso3i_phot(TWIST ? 9 : phot);
  // spherical shell r in [18,20]: each photon on the axial channel
  // pointing most toward center (6-fold implosion)
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    const dx=x-C,dy=y-C,dz=z-C,r2=dx*dx+dy*dy+dz*dz;
    if(r2<324||r2>441)continue;
    // chiral twist: aim at center + tangential offset (orbital Lz about z)
    // aim at center + tangential offset (orbital Lz about z) —
    // keep the original axial-axis pick; only the aim direction twists
    const r=Math.sqrt(r2), k=TWIST ? 6 : 0;
    const vx=(C + k*(-dy/r)) - x, vy=(C + k*(dx/r)) - y, vz=C - z;
    const ax=Math.abs(vx),ay=Math.abs(vy),az=Math.abs(vz);
    let ch;
    if(ax>=ay&&ax>=az) ch = vx>0?12:13;
    else if(ay>=ax&&ay>=az) ch = vy>0?14:15;
    else ch = vz>0?16:17;
    w._meso3i_phset(x,y,z,ch,128);
  }
  w._meso3i_ev_reset();
  const series=[];
  for(let t=0;t<300;t++){
    w._meso3i_drain_edge(2); w._meso3i_tick();
    if(t%30===0){ w._meso3i_rg_refresh();
      series.push(`t${t}:rest=${w._meso3i_rest_mass()} pp=${w._meso3i_ev(7)} ph=${w._meso3i_photons()}`); }
  }
  // Lz of the lump: directional-rest winding about z through its volume
  let lz=0, dr_tot=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const dx=x-C,dy=y-C;
    for(let c=12;c<18;c++){ const v=w._meso3i_rget(x,y,z,c); if(!v)continue; dr_tot+=v;
      const sgn=(c&1)?-1:1, ax=(c-12)>>1;
      if(ax===0) lz+=sgn*v*dy; else if(ax===1) lz-=sgn*v*dx; } }
  console.log(`phot=${phot} twist=${TWIST} [${series.join(' | ')}] Lz=${lz} drest=${dr_tot}`);
};
console.log(`E30 — chiral implosion (twist=${TWIST}): spinning matter from light?`);
run(8);
