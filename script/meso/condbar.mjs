// condbar (E24): Solid Conduction Bar — matter-dense closed box.
// Every site parked mass; left half n=50, right n=0. No drain, no void:
// excitation can only hop as n->photon->n. First Law + Fourier + Zeroth.
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
const N0 = Number(process.argv[2] || 50);
const w = await mod.exports();
const W=24,H=12,D=12;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1, REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(0);
w._meso3i_fricmode(-500); w._meso3i_drest(0); w._meso3i_reflect(0);
w._meso3i_phot(Number(process.argv[3] || 5));
for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x+y+z)&1)continue;
  w._meso3i_set(x,y,z,REST,64);
  if(x<W/2) w._meso3i_eset(x,y,z,N0);
}
const sum=(a,b)=>{ let n=0,m=0;
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=a;x<b;x++){
    if((x+y+z)&1)continue; n+=w._meso3i_eget(x,y,z); m+=w._meso3i_get(x,y,z,REST); }
  return [n,m]; };
const prof=()=>{ const g=[];
  for(let x=0;x<W;x+=4){ let n=0,c=0;
    for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let xx=x;xx<x+4&&xx<W;xx++)
      if((xx+y+z)&1){ n+=w._meso3i_eget(xx,y,z); c++; }
    g.push(Math.round(n/c)); }
  return g.join(','); };
console.log(`E24 — Solid Bar scaling probe: hot half n=${N0}`);
for(let t=0;t<=2000;t+=500){
  const [ln]=sum(0,W/2),[rn]=sum(W/2,W);
  console.log(`t${t}: L${ln} R${rn} T${ln+rn} photons=${w._meso3i_photons()}`);
  for(let i=0;i<500;i++) w._meso3i_tick();
}
