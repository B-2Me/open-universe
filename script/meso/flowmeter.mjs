// flowmeter (E60): per-window channel rates — the feedback-loop signature.
// Samples iEV deltas each window; shows WHICH transition dominates WHEN.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const ANNIH = Number(process.argv[2] || 64);
const TMAX  = Number(process.argv[3] || 300);
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
const LAST = new Array(10).fill(0);
const names = ['park','pair','emit','qcap','annih','absb','refl','fuse','drain','cap'];
for(let t=0;t<TMAX;t++){
  w._meso3i_drain_edge(4); w._meso3i_tick();
  if((t+1)%50===0){
    const d=[]; for(let i=0;i<10;i++){ const v=Number(w._meso3i_ev(i)); d.push(`${names[i]}=${v-LAST[i]}`); LAST[i]=v; }
    w._meso3i_rg_refresh();
    console.log(`t${t}: rest=${w._meso3i_rest_mass()} | ${d.join(' ')}`);
  }
}
