// accrete (E102): a seed lump + photon bath + grounded decay —
// does it grow into a full lump, and does it bound?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const pd of [0, 1]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(9); w._meso3i_scatter(128);
  if(w._meso3i_egate) w._meso3i_egate(8);
  if(w._meso3i_photdecay) w._meso3i_photdecay(pd ? 8 : 0);
  // small seed lump only — no mass drizzle
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=14;x<18;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,32);
  const out=[];
  for(let t=0;t<300;t++){
    // sustained photon bath around the lump
    if(t%4===0)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=8;x<26;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,8);
    w._meso3i_drain_edge(3); w._meso3i_tick();
    if(t%50===0){w._meso3i_rg_refresh();out.push(`t${t}:rest=${w._meso3i_rest_mass()}`);}
  }
  w._meso3i_rg_refresh();
  console.log(`pd=${pd*8}: ${out.join(' | ')}`);
}
