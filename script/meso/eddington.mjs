// eddington (E51): MASS-fed accretion + annihilation — does the lump's
// outgoing photon luminosity push back the infalling mass feed?
// Photon feed can't show it (photons don't push photons); mass feed can.
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
const ANNIH = Number(process.env.ANNIH || 0);
const FEED  = Number(process.argv[2] || 8);   /* moving mass per feed */
const W=96,H=48,D=48,C=[W/2,H/2,D/2];
const w = await mod.exports();
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
w._meso3i_phot(8); w._meso3i_annih(ANNIH);
const FL = Number(process.env.FRICLUM || 0);
if (w._meso3i_friclum) w._meso3i_friclum(FL);
// primordial lump to shine: dense rest seed at center
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-C[0],dy=y-C[1],dz=z-C[2],r2=dx*dx+dy*dy+dz*dz;
  if(r2<25 && !((x+y+z)&1)){
    for(let c=0;c<9;c++) w._meso3i_set(x,y,z,(c%2?c+1:c)===0?0:c,16),w._meso3i_set(x,y,z,0,0);
    w._meso3i_set(x,y,z,0,32); w._meso3i_set(x,y,z,1,32); /* antipodal drest for annih fuel */
  }
}
// mass feed: convergent moving quanta on inward channels every 4 ticks
const feed=(n)=>{
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    const dx=x-C[0],dy=y-C[1],dz=z-C[2],r2=dx*dx+dy*dy+dz*dz;
    if(r2<324||r2>441)continue;
    const r=Math.sqrt(r2);
    const vx=C[0]-x, vy=C[1]-y, vz=C[2]-z;
    const ax=Math.abs(vx),ay=Math.abs(vy),az=Math.abs(vz);
    let ch;
    if(ax>=ay&&ax>=az) ch=vx>0?12:13;
    else if(ay>=ax&&ay>=az) ch=vy>0?14:15;
    else ch=vz>0?16:17;
    w._meso3i_set(x,y,z,ch,n);
  }
};
const series=[];
for(let t=0;t<300;t++){
  if(t>0 && t%4===0) feed(FEED);
  w._meso3i_tick();
  if(t%30===0) series.push(`t${t}:rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} ph=${w._meso3i_photons()}`);
}
console.log(`eddington annih=${ANNIH} feed=${FEED} [${series.join(' | ')}]`);
