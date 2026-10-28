// parity-check: meso_core vs meso3i — identical seed, compare totals.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const load = async (f) => {
  const src = readFileSync(join(here, `../../docs/public/wasm/ember/${f}`), 'utf8');
  const mod = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)
    (mod, mod.exports, require, join(here,'../../docs/public/wasm/ember'), f);
  return mod.exports();
};
const w3 = await load('meso3i.js'), wc = await load('meso_core.js');
const W=24,H=12,D=12,NMOV=w3._meso3i_nch()-1,REST=NMOV;
for (const w of [w3,wc]) {
  w._meso3i_init(W,H,D,7); w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest && w._meso3i_drest(1);
  w._meso3i_reflect(0); w._meso3i_phot(5);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=8;x<16;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_set(x,y,z,12,8); }
}
const t0=Date.now(); for(let t=0;t<100;t++) w3._meso3i_tick(); const t3=Date.now()-t0;
const t1=Date.now(); for(let t=0;t<100;t++) wc._meso3i_tick(); const tc=Date.now()-t1;
console.log(`meso3i 100t: ${t3}ms | meso_core 100t: ${tc}ms | speedup ${(t3/tc).toFixed(1)}x`);
console.log(`meso3i : rest=${w3._meso3i_rest_mass()} mov=${w3._meso3i_mov_mass()}`);
console.log(`core   : rest=${wc._meso3i_rest_mass()} mov=${wc._meso3i_mov_mass()}`);
