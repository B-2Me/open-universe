// magpair (E115): does mass pairing care about stream direction?
// Parallel beams vs antiparallel beams meeting — the magnetism analog:
// parallel currents should attract/pair; antiparallel shouldn't.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,setup] of [
    ['parallel',   (w)=>{for(let z=4;z<12;z++)for(let y=6;y<10;y++){for(let x=6;x<12;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,12,96);
                          for(let x=18;x<24;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,12,96);}}],
    ['antiparallel',(w)=>{for(let z=4;z<12;z++)for(let y=6;y<10;y++){for(let x=6;x<12;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,12,96);
                          for(let x=18;x<24;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,13,96);}}],
  ]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(0);w._meso3i_fricmode(0);  // keep streams live
  w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  w._meso3i_pair(1);
  setup(w);
  w._meso3i_ev_reset();
  for(let t=0;t<80;t++) w._meso3i_tick();
  w._meso3i_rg_refresh();
  console.log(`${tag}: pairEvents=${w._meso3i_ev(2)} rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()}`);
}
