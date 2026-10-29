// ring (E92): 6 lumps in a hexagonal ring enclosing a photon cavity —
// does the closed shape self-sustain?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=64,H=64,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
// 6 lumps on a ring radius 20 centered (32,32)
const cx=32,cy=32,R=20;
for(let i=0;i<6;i++){
  const a=i*Math.PI/3, px=Math.round(cx+R*Math.cos(a)), py=Math.round(cy+R*Math.sin(a));
  for(let z=5;z<11;z++)for(let y=py-2;y<py+3;y++)for(let x=px-2;x<px+3;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
}
// photon bath INSIDE the ring (the cavity) + outside
for(let z=5;z<11;z++)for(let y=8;y<H-8;y++)for(let x=8;x<W-8;x++)
  if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,6); w._meso3i_phset(x,y,z,13,6); }
const gphn=(x0,x1,y0,y1)=>{let s=0;for(let z=5;z<11;z++)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._meso3i_phget(x,y,z,c);}return s;};
const inCav=(x,y)=>Math.hypot(x-cx,y-cy)<R-6;
const out=[];
for(let t=0;t<300;t++){
  w._meso3i_tick();
  if(t%50===0){
    let ic=0,oc=0;
    for(let z=5;z<11;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if((x+y+z)&1)continue;const v=w._meso3i_phons?0:0;
    }
    // count photons inside cavity vs outside
    let inP=0;for(let z=5;z<11;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if((x+y+z)&1)continue;if(!inCav(x,y))continue;for(let c=0;c<NMOV;c++)inP+=w._meso3i_phget(x,y,z,c);}
    let outP=0;for(let z=5;z<11;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if((x+y+z)&1)continue;if(inCav(x,y))continue;for(let c=0;c<NMOV;c++)outP+=w._meso3i_phget(x,y,z,c);}
    out.push(`t${t}:cavityPhn=${inP} outside=${outP}`);
  }
}
console.log(out.join('\n'));
