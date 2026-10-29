// lattice (E89): does a row of bound lumps form a regular lattice?
// 3 lumps + photon bath throughout — watch equilibrium separations.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=80,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
const Xs=[16,38,60];   // 3 lumps ~22 apart
for(const xL of Xs)for(let z=5;z<11;z++)for(let y=5;y<11;y++)
  for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
// photon bath EVERYWHERE between/around them
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=8;x<72;x++)
  if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,12,8); w._meso3i_phset(x,y,z,13,8); }
const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
  m+=v;sx+=v*x;}return m?sx/m:0;};
const out=[];
for(let t=0;t<300;t++){
  w._meso3i_tick();
  if(t%50===0){
    const c=[cent(0,Xs[0]+10),cent(Xs[1]-8,Xs[1]+8),cent(Xs[2]-10,W)];
    out.push(`t${t}:[${c.map(v=>v.toFixed(1)).join(',')}]`);
  }
}
console.log(`lattice: ${out.join(' | ')}`);
