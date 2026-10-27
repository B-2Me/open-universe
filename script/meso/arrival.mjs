// arrival (E37): the iPT transit counter — does a site count consecutive
// ticks of carrying light? A steady beam vs a dark region.
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
w._meso3i_init(W,H,D,1); w._meso3i_collmode(0); w._meso3i_friction(8);
w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(0);
w._meso3i_reflect(0); w._meso3i_phot(5);
// steady beam on +x at x=4..8, band y/z=6..18
for(let t=0;t<20;t++){
  for(let z=6;z<18;z++)for(let y=6;y<18;y++)for(let x=4;x<8;x++)
    if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,24);
  w._meso3i_tick();
}
// read iPT along the beam line (y=z=12) and off-beam (y=2,z=2)
const on=[],off=[];
for(let x=8;x<48;x++){ on.push(w._meso3i_ptget(x,12,12)); off.push(w._meso3i_ptget(x,2,2)); }
console.log('E37 — iPT arrival counter: 20-tick sustained beam');
console.log('on-beam  iPT:',on.join(','));
console.log('off-beam iPT:',off.join(','));
