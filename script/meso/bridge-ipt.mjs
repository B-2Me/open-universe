// bridge-ipt (E87): does the gap between two lumps show a standing
// iPT pattern — the Kastner resonance? Track sep + gap cadence per tick.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=48,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128);
const xL=15,xR=27;   // sep ~12 — the converging case
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=xL;x<xL+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  for(let x=xR;x<xR+6;x++) if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
}
const cent=(x0,x1)=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=x0;x<x1;x++){
  if((x+y+z)&1)continue;let v=w._meso3i_get(x,y,z,REST);for(let c=0;c<NMOV;c++)v+=w._meso3i_rget(x,y,z,c);
  m+=v;sx+=v*x;}return m?sx/m:0;};
// gap iPT: average iPT over the column between the lumps (x in [xL+6,xR))
const gapsite=(x)=>{let s=0,n=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  if((x+y+z)&1)continue;s+=w._meso3i_ptget(x,y,z);n++;}return n?(s/n).toFixed(0):0;};
const out=[];
for(let t=0;t<200;t++){
  w._meso3i_drain_edge(3); w._meso3i_tick();
  if(t%10===0){
    const gap=[];for(let x=xL+6;x<xR;x+=2) gap.push(gapsite(x));
    out.push(`t${t}:sep=${(cent(xR-4,W)-cent(0,xL+8)).toFixed(1)} gapIPT=[${gap.join(',')}]`);
  }
}
console.log(out.join('\n'));
