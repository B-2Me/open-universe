// twist-perf (E48): chiral photon implosion on meso_perf at 96^3 —
// scaled-up version of E30: does the bigger shell store more Lz?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso_perf.js');
const w = await mod.exports();
const TWIST = Number(process.argv[2] || 6);
const RSHELL = Number(process.argv[3] || 20);
const PPH = Number(process.argv[4] || 128);
const TLAST = Number(process.argv[5] || 300);
const W=96,H=48,D=48,C=[W/2,H/2,D/2];
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
w._meso3i_phot(TWIST?9:8);
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x+y+z)&1)continue;
  const dx=x-C[0],dy=y-C[1],dz=z-C[2],r2=dx*dx+dy*dy+dz*dz;
  if(r2<(RSHELL-2)*(RSHELL-2)||r2>(RSHELL+1)*(RSHELL+1))continue;
  const r=Math.sqrt(r2),k=TWIST;
  const vx=(C[0]+k*(-dy/r))-x, vy=(C[1]+k*(dx/r))-y, vz=C[2]-z;
  const ax=Math.abs(vx),ay=Math.abs(vy),az=Math.abs(vz);
  let ch;
  if(ax>=ay&&ax>=az) ch=vx>0?12:13;
  else if(ay>=ax&&ay>=az) ch=vy>0?14:15;
  else ch=vz>0?16:17;
  w._meso3i_phset(x,y,z,ch,PPH);
}
w._meso3i_ev_reset();
const t0=Date.now(),series=[];
for(let t=0;t<TLAST;t++){
  w._meso3i_drain_edge(2); w._meso3i_tick();
  if(t%60===0) series.push(`t${t}:rest=${w._meso3i_rest_mass()} pp=${w._meso3i_ev(7)} ph=${w._meso3i_photons()}`);
}
let lz=0,dr_tot=0;
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x+y+z)&1)continue; const dx=x-C[0],dy=y-C[1];
  for(let c=12;c<18;c++){ const v=w._meso3i_rget(x,y,z,c); if(!v)continue; dr_tot+=v;
    const sgn=(c&1)?-1:1,ax=(c-12)>>1;
    if(ax===0) lz+=sgn*v*dy; else if(ax===1) lz-=sgn*v*dx; } }
console.log(`96^3 r=${RSHELL} pph=${PPH} twist=${TWIST} [${series.join(' | ')}] Lz=${lz} drest=${dr_tot} (${Date.now()-t0}ms)`);
