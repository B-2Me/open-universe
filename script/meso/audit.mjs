// audit (E59): full mass ledger — seed vs rest+mov+drain+caploss.
// iEV[8]=drain count, iEV[9]=cap overflow. Residual must be ~0.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const ANNIH = Number(process.argv[2] || 64);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(8); w._meso3i_annih(ANNIH); w._meso3i_iecost(1);
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,0,32); w._meso3i_set(x,y,z,1,32); }
w._meso3i_ev_reset();
let seed=0; for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) seed+=64;
for(let t=0;t<300;t++){ w._meso3i_drain_edge(4); w._meso3i_tick(); }
w._meso3i_rg_refresh();
const rest=w._meso3i_rest_mass(),mov=w._meso3i_mov_mass(),phn=w._meso3i_photons();
const dr=w._meso3i_ev(8),cap=w._meso3i_ev(9),fu=w._meso3i_ev(7);
const inn=seed+2*fu, out=rest+mov+dr;
console.log(`annih=${ANNIH}: in=${inn} out=rest${rest}+mov${mov}+drain${dr}=${out} caploss=${cap} residual=${inn-out-cap} phn=${phn}`);
