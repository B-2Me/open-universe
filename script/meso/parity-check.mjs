// parity-check: meso_core vs meso3i — identical seed + canonical config,
// bitwise trajectory comparison (totals must match EXACTLY each tick).
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
const W=24,H=12,D=12;let NMOV,REST;
for (const w of [w3,wc]) {
  w._meso3i_init(W,H,D,7); NMOV=w._meso3i_nch()-1; REST=NMOV; w._meso3i_collmode(0); w._meso3i_friction(8);
  w._meso3i_fricmode(16); w._meso3i_fricp(128); w._meso3i_drest(1);
  w._meso3i_reflect(0); w._meso3i_phot(5); w._meso3i_pair(0);
  w._meso3i_erate(7);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=8;x<16;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_set(x,y,z,12,8); }
}
let div = -1;
for(let t=0;t<40;t++){
  w3._meso3i_tick(); wc._meso3i_tick();
  w3._meso3i_rg_refresh();
  const r3=w3._meso3i_rest_mass(), m3=w3._meso3i_mov_mass(), p3=w3._meso3i_photons();
  const rc=wc._meso3i_rest_mass(), mc=wc._meso3i_mov_mass(), pc=wc._meso3i_photons();
  if(r3!==rc||m3!==mc||p3!==pc){ div=t;
    console.log(`t${t}: meso3i rest=${r3} mov=${m3} phn=${p3} | core rest=${rc} mov=${mc} phn=${pc}`); break; }
}
console.log(div<0 ? 'PARITY: bitwise-identical for 40 ticks' : `diverged at tick ${div}`);
const t0=Date.now(); for(let t=0;t<100;t++) w3._meso3i_tick(); const t3=Date.now()-t0;
const t1=Date.now(); for(let t=0;t<100;t++) wc._meso3i_tick(); const tc=Date.now()-t1;
console.log(`meso3i ${t3}ms | core ${tc}ms | speedup ${(t3/tc).toFixed(1)}x`);
