// delaymap (E39): dataset — corridor mass vs per-pulse transit delay.
// Load the corridor with increasing rest mass between pulses; measure
// each pulse's centroid delay as a function of path density.
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
const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_phth(0);
const detx=42;
const rows=[];
for(let pulse=0;pulse<6;pulse++){
  // add corridor mass BEFORE this pulse: x in [14,36] full y/z
  const load=32*pulse;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=14;x<36;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,Math.min(255,load));
  // fire this pulse at x=6 on +x
  for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=6;x<8;x++)
    if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,48);
  // run until the pulse's photons clear the detector line (or 30 ticks cap)
  let peak=-1,sum=0,wsum=0;
  for(let t=0;t<30;t++){
    w._meso3i_tick();
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((detx+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(detx,y,z,12,nu); }
    if(det>peak)peak=det;
    if(det>100){ sum+=det; wsum+=det*t; }
  }
  const cent=sum?(wsum/sum).toFixed(1):'-';
  w._meso3i_rg_refresh();
  rows.push(`pulse${pulse}: load=${load} centroid_t=${cent} peak=${peak} rest=${w._meso3i_rest_mass()}`);
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_phth(0);
}
console.log('E39 — delay vs path-mass (single pulses, corridor density ramped)');
rows.forEach(r=>console.log(r));
