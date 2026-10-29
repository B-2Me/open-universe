// magdrift (E83): do wound lumps DRIFT together/apart by spin orientation?
// centroid x of each lump over time — attract vs repel.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const mode of ['aligned','anti']) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=48,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  const cR = mode==='anti' ? 13 : 12;
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=10;x<16;x++)
    if(!((x+y+z)&1)) { w._meso3i_set(x,y,z,REST,32); w._meso3i_dset(x,y,z,12,64); }
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=30;x<36;x++)
    if(!((x+y+z)&1)) { w._meso3i_set(x,y,z,REST,32); w._meso3i_dset(x,y,z,cR,64); }
  const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){
    if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const out=[];
  for(let t=0;t<150;t++){
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%50===0) out.push(`t${t}:L=${cent(6,22).toFixed(1)} R=${cent(26,42).toFixed(1)}`);
  }
  console.log(`${mode}: ${out.join(' | ')}`);
}
