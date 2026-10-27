// photoelectric (E32): frequency-dependent absorption — a mass slab
// filters a mixed beam: low-nu passes, high-nu absorbs at the surface.
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
const W=48,H=24,D=24,NMOV=w._meso3i_nch()-1,REST=NMOV;
const run=(th)=>{
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(0);
  w._meso3i_fricmode(-500); w._meso3i_drest(0); w._meso3i_reflect(0);
  w._meso3i_phot(5); w._meso3i_phth(th);
  // mass slab at x in [22,30], full y/z
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=22;x<30;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  // mixed beam: nu=1 and nu=4 photons on +x channel, x in [4,10]
  for(let z=4;z<20;z++)for(let y=4;y<20;y++)for(let x=4;x<10;x++)
    if(!((x+y+z)&1)){ w._meso3i_phset_nu(x,y,z,12,1,32); w._meso3i_phset_nu(x,y,z,12,4,32); }
  for(let t=0;t<60;t++) w._meso3i_tick();
  // transmitted spectrum: photons on +x past the slab (x>34)
  const spec=[0,0,0,0];
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=34;x<W;x++){
    if((x+y+z)&1)continue;
    for(let nu=1;nu<=4;nu++) spec[nu-1]+=w._meso3i_phget_nu(x,y,z,12,nu);
  }
  let exc=0; for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=22;x<30;x++)
    if(!((x+y+z)&1)) exc+=w._meso3i_eget(x,y,z);
  console.log(`th=${th}: transmitted spectrum=[${spec.join(',')}] slab n=${exc}`);
};
console.log('E32 — photoelectric filter: mixed nu=1+nu=4 beam through mass slab');
run(0); run(4);
