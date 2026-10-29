// eddington2 (E76): Eddington rematch — attraction (+loop) vs
// linkcap+drain (−loop). Does the ceiling shift with the pull?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const lens of [0, -8, -32]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_linkcap(4); w._meso3i_lens(lens);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,32);
  w._meso3i_ev_reset();
  const out=[];
  for(let t=0;t<400;t++){
    // sustained corridor bath — the feed that builds a clot (E63 geometry)
    if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=8;x<28;x++){
      if(!((x+y+z)&1)){ w._meso3i_phset(x,y,z,13,16); w._meso3i_phset(x,y,z,12,16); }
    }
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%100===0){w._meso3i_rg_refresh();out.push(`t${t}:rest=${w._meso3i_rest_mass()}`);}
  }
  w._meso3i_rg_refresh();
  console.log(`lens=${lens}: ${out.join(' | ')}`);
}
