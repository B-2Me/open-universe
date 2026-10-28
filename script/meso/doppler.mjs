// doppler (E42): kinematic cadence stretch — moving emitter, static grid.
// Emitter fires a pulse every T ticks, stepping -1 every k ticks (recede)
// or +1 (approach). Axial c_eff = 2 cells/tick. Expect T*(1+v/2).
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
const run=(stepEvery)=>{   // stepEvery>0 recede (-x), <0 approach (+x)
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(0);
  let ex=stepEvery>0?26:14;   // start position: receding starts near, approaching starts far
  const arrivals=[];
  for(let t=0;t<90;t++){
    // emitter step
    if(t>0 && t%Math.abs(stepEvery)===0) ex += stepEvery>0?-1:1;
    // emit pulse every T ticks on +x at emitter
    if(t%T===0 && t<50)
      for(let z=8;z<16;z++)for(let y=8;y<16;y++)
        if(!((ex+y+z)&1) && ex>0 && ex<W) w._meso3i_phset_nu(ex,y,z,12,1,32);
    w._meso3i_tick();
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((DETX+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(DETX,y,z,12,nu); }
    if(det>50) arrivals.push(t);
  }
  // group arrivals into pulse peaks (gap >3 splits)
  const peaks=[]; let last=-10;
  for(const t of arrivals){ if(t-last>3) peaks.push(t); last=t; }
  const sp=peaks.slice(1).map((p,i)=>p-peaks[i]);
  const v = stepEvery===0 ? 0 : 1/stepEvery;
  const pred = stepEvery===0 ? '1.00' : (1+v/2).toFixed(3);
  console.log(`k=${stepEvery} v=${v.toFixed(3)}: peaks=[${peaks.slice(0,5).join(',')}] spacings=[${sp.slice(0,4).join(',')}] predicted x${pred}`);
};
console.log('E42 — kinematic Doppler: receding/approaching emitter, T=10, c=2 cells/tick');
run(0); run(4); run(2); run(-4);
