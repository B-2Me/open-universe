// randab (E67): legacy RNG vs deterministic substrate — same seed, flip the flag
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const rm of [0, 1]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=48,H=24,D=24;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128); w._meso3i_iecost(1);
  w._meso3i_randmode(rm);
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,0,32); w._meso3i_set(x,y,z,1,32); }
  w._meso3i_ev_reset();
  for(let t=0;t<300;t++){ w._meso3i_drain_edge(4); w._meso3i_tick(); }
  w._meso3i_rg_refresh();
  console.log(`randmode=${rm}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} phn=${w._meso3i_photons()} | park=${w._meso3i_ev(0)} emit=${w._meso3i_ev(2)} fuse=${w._meso3i_ev(7)} drain=${w._meso3i_ev(8)}`);
}
