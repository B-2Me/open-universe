// blackbody-shape (E34): does transit reddening preserve spectral shape?
// Seed a peaked (thermal-like) spectrum, send through dilute medium,
// compare flat (additive) vs nu-proportional (multiplicative) shift.
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
// thermal-shaped input spectrum (peak at nu=3, blackbody-ish)
const SEED=[8,40,64,32];
const run=(k)=>{
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_phth(0); w._meso3i_nushift(k);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<36;x++)
    if(!((x+y+z)&1)&&((x*7+y*11+z*13)%4===0)) w._meso3i_set(x,y,z,REST,8);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=6;x<14;x++)
    if(!((x+y+z)&1)) for(let nu=1;nu<=4;nu++) w._meso3i_phset_nu(x,y,z,12,nu,SEED[nu-1]);
  for(let t=0;t<40;t++) w._meso3i_tick();
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=38;x<W;x++){
    if((x+y+z)&1)continue;
    for(let nu=1;nu<=4;nu++) spec[nu-1]+=w._meso3i_phget_nu(x,y,z,12,nu); }
  const tot=spec.reduce((a,b)=>a+b,0)||1;
  console.log(`k=${k}: out=[${spec.join(',')}] norm=[${spec.map(v=>(v/tot).toFixed(2)).join(',')}]`);
};
console.log('E34 — blackbody preservation: thermal peak spectrum [8,40,64,32] through medium');
console.log('input norm=[0.06,0.28,0.44,0.22]');
run(0); run(4); run(-4);
