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
for(const fm of [16,-500]){
  w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(fm); w._meso3i_fricp(128); w._meso3i_drest(0);
  w._meso3i_reflect(0); w._meso3i_phot(5);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=14;x<36;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,128);
  w._meso3i_rg_refresh();
  const t0=w._meso3i_rest_mass();
  for(let t=0;t<30;t++) w._meso3i_tick();
  w._meso3i_rg_refresh();
  console.log(`fm=${fm}: rest t0=${t0} t30=${w._meso3i_rest_mass()}`);
}
