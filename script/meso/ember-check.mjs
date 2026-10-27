// ember-check: what is actually tiled in the default scene?
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
const wasm = await mod.exports();
const W=72,H=72,D=36,CX=36,CY=36,CZ=18;
wasm._meso3i_init(W,H,D,1);
const NMOV = wasm._meso3i_nch()-1, REST = NMOV;
wasm._meso3i_collmode(0); wasm._meso3i_friction(50);
wasm._meso3i_fricmode(-4); wasm._meso3i_fricp(128);
wasm._meso3i_drest(0); wasm._meso3i_reflect(0); wasm._meso3i_phot(5);
for (let z=0;z<D;z++) for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
  if ((x+y+z)&1) continue;
  const dx=x-CX,dy=y-CY,dz=z-CZ;
  if (dx*dx+dy*dy+dz*dz<=25) wasm._meso3i_set(x,y,z,REST,96);
}
for (let t=0;t<300;t++){ wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
let hist={}, occupied=0, hot=0;
for (let z=0;z<D;z++) for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
  if ((x+y+z)&1) continue;
  let mov=0;
  for (let c=0;c<NMOV;c++) mov+=wasm._meso3i_get(x,y,z,c);
  const rest=wasm._meso3i_get(x,y,z,REST);
  const exc=wasm._meso3i_eget(x,y,z);
  if (mov+rest+exc) occupied++;
  const mx=Math.max(mov,rest,exc);
  const b=mx<1?0:mx<5?1:mx<20?2:mx<60?3:4;
  hist[b]=(hist[b]||0)+1;
  if (mx>60) hot++;
}
const phn = wasm._meso3i_photons ? wasm._meso3i_photons() : -1;
let phocc = 0;
if (wasm._meso3i_phget) {
  for (let z=0;z<D;z++) for (let y=0;y<H;y++) for (let x=0;x<W;x++)
    for (let c=0;c<NMOV;c++) if (wasm._meso3i_phget(x,y,z,c)) phocc++;
}
console.log('IPHN photons:', phn, 'photon-occupied cells:', phocc);
console.log('occupied sites:', occupied, '| occupancy histogram (0=empty,1=faint,2=dim,3=mid,4=hot):', hist, '| hot(>60):', hot);
