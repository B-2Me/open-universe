// redshift (E33): does photon transit through matter down-shift nu?
// A nu=4 beam crosses a dilute medium; INSH gives 1/k down-shift per hop.
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
const run=(k)=>{
  const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0);
  if (w._meso3i_scatter) w._meso3i_scatter(Number(process.env.SCATTER || 0)); w._meso3i_phot(5); w._meso3i_phth(0); w._meso3i_nushift(k);
  // dilute medium x in [16,36]: sparse rest (25% sites, thin fill)
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<36;x++)
    if(!((x+y+z)&1)&&((x*7+y*11+z*13)%4===0)) w._meso3i_set(x,y,z,REST,8);
  // nu=4 beam on +x at x in [6,14]
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=6;x<14;x++)
    if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,4,24);
  for(let t=0;t<40;t++) w._meso3i_tick();
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=38;x<W;x++){
    if((x+y+z)&1)continue;
    for(let nu=1;nu<=4;nu++) spec[nu-1]+=w._meso3i_phget_nu(x,y,z,12,nu); }
  let exc=0; for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=16;x<36;x++)
    if(!((x+y+z)&1)) exc+=w._meso3i_eget(x,y,z);
  console.log(`k=${k}: transmitted=[${spec.join(',')}] medium n=${exc}`);
};
console.log('E33 — transit spectral shift: nu=4 beam through dilute medium');
run(0); run(8); run(3);
