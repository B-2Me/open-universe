// attenuation (E43): flux vs path depth — Beer-Lambert (exp) or geometric?
// Beam of ν=1 photons through parked-mass slabs of varying depth L;
// measure transmitted photon count at detector.
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
const W=48,H=24,D=24,DETX=44,PHN_IN=2048;
const run=(L,rho)=>{
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0); w._meso3i_friction(8); w._meso3i_fricmode(16);
  w._meso3i_fricp(128); w._meso3i_drest(1); w._meso3i_reflect(0);
  w._meso3i_phot(3); w._meso3i_phth(0);   /* ablation: photon dies on contact, no re-emission */
  if (w._meso3i_scatter) w._meso3i_scatter(Number(process.env.SCATTER || 0));
  // slab x in [16,16+L)
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<16+L;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,rho);
  // seed photons uniformly on +x at x=4..6 (count ~PHN_IN)
  let seeded=0;
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<6;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset_nu(x,y,z,12,1,16); seeded+=16; }
  let det=0;
  for(let t=0;t<60;t++){
    w._meso3i_tick();
    for(let z=0;z<D;z++)for(let y=0;y<H;y++){
      if((DETX+y+z)&1)continue;
      for(let nu=1;nu<=4;nu++) det+=w._meso3i_phget_nu(DETX,y,z,12,nu); }
  }
  const T=det/seeded;
  console.log(`L=${L} rho=${rho}: in=${seeded} out=${det} T=${T.toFixed(4)} lnT=${(Math.log(T)||0).toFixed(3)}`);
};
console.log('E43 — attenuation law: transmitted flux vs slab depth');
for(const L of [0,4,8,16,24]) run(L,32);
for(const rho of [8,16,64,128]) run(16,rho);
