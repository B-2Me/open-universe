// saturate (E114): friction OFF — does mass finally saturate channels
// and fire massbnc? The saturation regime the cap mechanics need.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for(const [tag,fr,mb] of [['fric-on',8,0],['fric-off',0,0],['fric-off+bnc',0,1]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=24,H=12,D=12;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(fr);w._meso3i_fricmode(fr?4:0);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_massbnc)w._meso3i_massbnc(mb);
  w._meso3i_ev_reset();
  for(let t=0;t<120;t++){
    // dense mass feed — all channels seeded into a small region each tick
    for(let z=4;z<8;z++)for(let y=4;y<8;y++)for(let x=10;x<14;x++)
      if(!((x+y+z)&1)) for(let c=0;c<NMOV;c++) w._meso3i_set(x,y,z,c,100);
    w._meso3i_tick();
  }
  w._meso3i_rg_refresh();
  // max channel occupancy anywhere — did any hit 255?
  let mx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++){const v=w._meso3i_get(x,y,z,c);if(v>mx)mx=v;}}
  console.log(`${tag}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} bnc=${w._meso3i_ev(6)} maxCh=${mx}`);
}
