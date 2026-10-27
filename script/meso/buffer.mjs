// buffer (E40): does a massive flux burst queue at node capacity —
// the "video buffer" prediction? Dense carrier pulse through a
// congested corridor; measure output duration vs input duration.
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
const run=(cong)=>{
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(1); w._meso3i_friction(8);
  w._meso3i_fricmode(0); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(0);
  if(cong)  // congested corridor: rest mass x in [18,34]
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=18;x<34;x++)
      if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,32);
  // MASSIVE carrier burst on +x at x=6: fill to capacity
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<10;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,200);
  // measure moving-mass arrival profile at detector x=44
  const prof=[];
  for(let t=0;t<70;t++){ w._meso3i_tick();
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((44+y+z)&1)continue;
      for(let c=0;c<NMOV;c++) det+=w._meso3i_get(44,y,z,c); }
    prof.push(det); }
  // output duration: ticks where det > 10% of peak
  const pk=Math.max(...prof), th=pk*0.1;
  const first=prof.findIndex(v=>v>th), last=prof.length-1-prof.reverse().findIndex(v=>v>th);
  console.log(`cong=${cong}: peak=${pk} firstArr=${first} lastArr=${last} duration=${last-first}`);
};
console.log('E40 — video buffer: does a dense burst stretch crossing a congested corridor?');
run(false); run(true);
