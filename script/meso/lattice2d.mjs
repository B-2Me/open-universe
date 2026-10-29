// lattice2d (E90): do bound lumps pack into a PLANE? 2x2 square of
// lumps in a photon bath — watch 2D equilibrium spacing.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=64,H=48,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
// 2x2 square of lumps: (20,20) (44,20) (20,36) (44,36)
const P=[[20,20],[44,20],[20,36],[44,36]];
for(const [px,py] of P)for(let z=5;z<11;z++)for(let y=py-3;y<py+3;y++)
  for(let x=px-3;x<px+3;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
// photon bath everywhere
for(let z=5;z<11;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
  if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,8); w._meso3i_phset(x,y,z,13,8); }
const cent=(x0,x1,y0,y1)=>{let m=0,sx=0,sy=0;for(let z=0;z<D;z++)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
  m+=v;sx+=v*x;sy+=v*y;}return m?[sx/m,sy/m]:[0,0];};
const out=[];
for(let t=0;t<300;t++){
  w._meso3i_tick();
  if(t%50===0){
    const a=cent(0,30,0,24),b=cent(34,W,0,24),c=cent(0,30,26,H),d=cent(34,W,26,H);
    out.push(`t${t}:[${a[0].toFixed(0)},${a[1].toFixed(0)} ${b[0].toFixed(0)},${b[1].toFixed(0)} ${c[0].toFixed(0)},${c[1].toFixed(0)} ${d[0].toFixed(0)},${d[1].toFixed(0)}]`);
  }
}
console.log(out.join('\n'));
