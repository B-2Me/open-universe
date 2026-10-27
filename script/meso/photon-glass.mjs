// photon-glass (E26): is light blind to light? probe photon packet
// crosses a live photon bath (same iPA plane) vs empty vacuum.
// Identical arrival profile = emergent transparency, not structural.
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
const W=48,H=48,D=48,NMOV=w._meso3i_nch()-1;
const run=(bath)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(0); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(0);   // no mass coupling anywhere
  if (bath) for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++) w._meso3i_phset(x,y,z,c,4);   // bath on ALL channels
  }
  // probe pulse: dense photons on +x channel (c=0) at x=4..8 plane
  for(let z=12;z<36;z++)for(let y=12;y<36;y++)for(let x=4;x<8;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,0,128);
  // detector: photons on ch0 at x=44..46 plane, tallied per tick
  const det=()=>{ let n=0;
    for(let z=12;z<36;z++)for(let y=12;y<36;y++)for(let x=44;x<46;x++)
      if(!((x+y+z)&1)) n+=w._meso3i_phget(x,y,z,0);
    return n; };
  const prof=[];
  for(let t=0;t<60;t++){ w._meso3i_tick(); if(t%4===0) prof.push(det()); }
  const first=prof.findIndex(v=>v>0), peak=Math.max(...prof);
  console.log(`bath=${bath}: first-arr t=${first*4}  peak=${peak}  profile=[${prof.join(',')}]`);
};
console.log('E26 — photon packet through photon bath (same plane):');
run(0); run(1);
