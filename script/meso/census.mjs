// census (E46): spontaneous structure formation — seed a dense blob,
// NO apparatus, watch what the substrate forms over a long run.
// Metrics: rest/mov totals, occupied sites, dense sites, max density.
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
const W=48,H=24,D=24,TICKS=200;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0); w._meso3i_phot(0);
// seed: dense sphere of rest + random moving quanta at center — tension analog
const cx=24,cy=12,cz=12,r=6;
let seeded=0;
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-cx,dy=y-cy,dz=z-cz;
  if(dx*dx+dy*dy+dz*dz<r*r && !((x+y+z)&1)){
    w._meso3i_set(x,y,z,REST,64);
    w._meso3i_set(x,y,z,(x*7+y*13+z*17)%NMOV,32);
    seeded++;
  }
}
console.log(`seeded ${seeded} sites; watching ${TICKS}t — no apparatus`);
const census=()=>{
  let occ=0,dense=0,maxd=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    const v=w._meso3i_rget(x,y,z);
    if(v>0){occ++;if(v>=32)dense++;if(v>maxd)maxd=v;}
  }
  return {occ,dense,maxd};
};
for(let t=0;t<=TICKS;t++){
  if(t%20===0){
    w._meso3i_rg_refresh();
    const c=census();
    console.log(`t=${t}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} occ=${c.occ} dense=${c.dense} max=${c.maxd}`);
  }
  if(t<TICKS) w._meso3i_tick();
}
