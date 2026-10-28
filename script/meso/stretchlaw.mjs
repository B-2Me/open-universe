// stretchlaw (E41): is corridor duration-stretch additive or multiplicative?
// Sweep input width t_in, corridor length L, density rho;
// ratio t_out/t_in flat => true scale dilation; drops => additive queue.
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
const W=48,H=24,D=24,DETX=44;
let NMOV,REST;
const run=(tin,L,rho)=>{
  w._meso3i_init(W,H,D,1); NMOV=w._meso3i_nch()-1; REST=NMOV; w._meso3i_collmode(1); w._meso3i_friction(8);
  w._meso3i_fricmode(0); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(0);
  // congested corridor x in [18, 18+L) — E40's working geometry
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=18;x<18+L;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,rho);
  // burst: fill +x channels across depth of tin cells (E40 geometry)
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<4+tin;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,200);
  const prof=[];
  for(let t=0;t<160;t++){ w._meso3i_tick();
    let det=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((DETX+y+z)&1)continue;
      for(let c=0;c<NMOV;c++) det+=w._meso3i_get(DETX,y,z,c); }
    prof.push(det); }
  const pk=Math.max(...prof), th=pk*0.1;
  const idx=prof.map((v,i)=>v>th?i:-1).filter(i=>i>=0);
  const dur=idx.length?idx[idx.length-1]-idx[0]+1:0;
  console.log(`tin=${tin} L=${L} rho=${rho}: out_dur=${dur} ratio=${dur?((dur)/tin).toFixed(2):'—'} peak=${pk}`);
};
console.log('E41 — stretch law: t_out/t_in across width,length,density');
for(const tin of [2,4,6,8]) run(tin,16,32);
run(6,8,32); run(6,16,64); run(6,16,8);
