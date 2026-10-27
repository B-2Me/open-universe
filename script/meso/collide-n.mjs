// collide-n (E21): collision->n thermalization under friction
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
const W=48,H=48,D=48,C=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
const run=(phot)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(2);
  w._meso3i_fricmode(-4); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(phot);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const dx=x-C,dy=y-C,dz=z-C,r2=dx*dx+dy*dy+dz*dz;
    if(r2<=16) w._meso3i_set(x,y,z,REST,64);
    else if(x<20 && r2<=196) for(let c=0;c<NMOV;c++) w._meso3i_set(x,y,z,c,8);
  }
  const series=[];
  w._meso3i_ev_reset();
  const reseed=()=>{ for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const dx=x-C,dy=y-C,dz=z-C,r2=dx*dx+dy*dy+dz*dz;
    if(r2>16 && r2<=100 && x<20) for(let c=0;c<4;c++) w._meso3i_set(x,y,z,c,8); } };
  for(let t=0;t<200;t++){ reseed(); w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%40===0){ let ex=0; for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++)
      if(((x+y+z)&1)===0) ex+=w._meso3i_eget(x,y,z); series.push(`t${t}:n${ex}p${w._meso3i_ev(0)}`); } }
  console.log(`phot=${phot}  [${series.join(' ')}]`);
};
console.log('E21 — collision->n: does carrier flux thermalize into excitation?');
run(0); run(6);
