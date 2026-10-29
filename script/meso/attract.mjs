// attract (E73): does mass seek density? perf, tiny beam, per-tick progress.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const L = Number(process.argv[2] || 0);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=32,H=16,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
if(w._meso3i_lens) w._meso3i_lens(L);
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
for(let z=4;z<8;z++)for(let y=3;y<6;y++)for(let x=3;x<6;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,16);
const t0=Date.now();
for(let t=0;t<40;t++){
  w._meso3i_drain_edge(3); w._meso3i_tick();
  if(t%10===0){w._meso3i_rg_refresh();console.log(`t${t}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} (${Date.now()-t0}ms)`);}
}
