// doppler (E42b): kinematic cadence stretch — moving emitter, static grid.
// Clean detector: thin single-cell pulses + first-arrival clustering.
// Axial c_eff = 2 cells/tick. Expect T_arr = T_emit * (1 + v/2).
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
const T=10, DETX=44;
const run=(stepEvery)=>{   // >0 recede (-x), <0 approach (+x)
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0);
  if (w._meso3i_scatter) w._meso3i_scatter(Number(process.env.SCATTER || 0)); w._meso3i_phot(0);
  let ex=stepEvery>0?26:14;
  const counts=[];
  for(let t=0;t<110;t++){
    if(t>0 && t%Math.abs(stepEvery)===0) ex += stepEvery>0?-1:1;
    // thin pulse: ONE site, single tick injection
    if(t%T===0 && t<60 && ex>0 && ex<W)
      for(let z=8;z<16;z++)for(let y=8;y<16;y++)
        if(!((ex+y+z)&1)) w._meso3i_phset_nu(ex,y,z,12,1,4);
    w._meso3i_tick();
    let det=0;
    for(const dx of [DETX,DETX+1])   /* both parity lanes: axial photons
      stay on their x-parity forever — a single detector column is
      blind to half the pulses */
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((dx+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(dx,y,z,12,nu); }
    counts.push(det);
  }
  // cluster: first tick of each run where det>0 (leading edges)
  const firsts=[]; let quiet=true;
  for(let t=0;t<counts.length;t++){
    if(counts[t]>0 && quiet){ firsts.push(t); quiet=false; }
    if(counts[t]===0) quiet=true;
  }
  const sp=firsts.slice(1).map((p,i)=>p-firsts[i]);
  const v = stepEvery===0 ? 0 : 1/stepEvery;
  const pred = stepEvery===0 ? '1.00' : (1+v/2).toFixed(3);
  console.log(`k=${stepEvery} v=${v.toFixed(3)}: firsts=[${firsts.slice(0,6).join(',')}] spacings=[${sp.slice(0,5).join(',')}] predicted x${pred}`);
};
console.log('E42b — Doppler (thin pulses + leading edge): recede/approach, T=10, c=2');
run(0); run(4); run(2); run(-4);
