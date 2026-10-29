// sustained-implosion (E49): does a continuous flux bath let the lump
// persist at 96^3? One-shot shell evaporated (E48b) — now re-fire a
// weaker convergent feed every REFIRE ticks.
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
const REFIRE = Number(process.argv[2] || 4);   /* ticks between feeds; 0 = one-shot */
const FEED   = Number(process.argv[3] || 32);  /* photons per channel per feed */
const FEEDT  = Number(process.argv[4] || 200); /* cut the bath at this tick */
const W=96,H=48,D=48,C=[W/2,H/2,D/2];
const w = await mod.exports();
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0); const PMODE = Number(process.env.PHOT || 9);
w._meso3i_phot(PMODE);
const RCB = Number(process.env.RECOMB || 0);
if (w._meso3i_recomb) w._meso3i_recomb(RCB);
const ANH = Number(process.env.ANNIH || 0);
if (w._meso3i_annih) w._meso3i_annih(ANH);
const fire=(n)=>{
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    const dx=x-C[0],dy=y-C[1],dz=z-C[2],r2=dx*dx+dy*dy+dz*dz;
    if(r2<324||r2>441)continue;
    const r=Math.sqrt(r2),k=6;
    const vx=(C[0]+k*(-dy/r))-x, vy=(C[1]+k*(dx/r))-y, vz=C[2]-z;
    const ax=Math.abs(vx),ay=Math.abs(vy),az=Math.abs(vz);
    let ch;
    if(ax>=ay&&ax>=az) ch=vx>0?12:13;
    else if(ay>=ax&&ay>=az) ch=vy>0?14:15;
    else ch=vz>0?16:17;
    w._meso3i_phset(x,y,z,ch,n);
  }
};
fire(128);          /* the implosion */
w._meso3i_ev_reset();
const series=[];
for(let t=0;t<300;t++){
  if(REFIRE && t%REFIRE===0 && t>0 && t<FEEDT) fire(FEED);
  w._meso3i_drain_edge(2); w._meso3i_tick();
  if(t%30===0) series.push(`t${t}:rest=${w._meso3i_rest_mass()} pp=${w._meso3i_ev(7)} ph=${w._meso3i_photons()}`);
}
console.log(`sustained refire=${REFIRE} feed=${FEED} [${series.join(' | ')}]`);
