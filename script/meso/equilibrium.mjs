// equilibrium (E22): Zeroth Law test — do two lumps share n?
// Hot lump (n preloaded) + cold lump (n=0), same rest mass, closed box.
// IPHOT=5: n decays to photons, photons absorb into n elsewhere.
// Equilibrium = n/m per lump converges to a shared value.
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
const W=48,H=48,D=48,CX=14,KX=34,CY=24,CZ=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1, REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(0);
w._meso3i_fricmode(16); w._meso3i_drest(0); w._meso3i_reflect(0);
w._meso3i_phot(5);
const lump=(cx,exc)=>{
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const dx=x-cx,dy=y-CY,dz=z-CZ;
    if(dx*dx+dy*dy+dz*dz<=16){ w._meso3i_set(x,y,z,REST,64); if(exc) w._meso3i_eset(x,y,z,exc); } }
};
lump(CX,200); lump(KX,0);   // hot + cold, same mass
const zone=(cx)=>{ let m=0,e=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue; const dx=x-cx,dy=y-CY,dz=z-CZ;
    if(dx*dx+dy*dy+dz*dz<=36){ m+=w._meso3i_get(x,y,z,REST); e+=w._meso3i_eget(x,y,z); } }
  return [m,e]; };
const series=[];
for(let t=0;t<600;t++){
  w._meso3i_tick();
  if(t%100===0){ const [am,ae]=zone(CX),[bm,be]=zone(KX);
    series.push(`t${t}:A${ae}/m${am} B${be}/m${bm}`); }
}
console.log('E22 — radiative equilibrium: n/m convergence');
console.log(series.join('\n'));
