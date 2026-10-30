// stim (E108): stimulated emission — does a photon-bathed lump
// out-emit a dark lump? (iPT-gated mass->photon fork)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,bath] of [['dark',0],['bathed',16]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_fricmode(64);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(5); w._meso3i_drain_edge(3);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_eset(x,y,z,200); }
  w._meso3i_ev_reset();
  for(let t=0;t<100;t++){
    if(bath&&t%2===0)for(let z=2;z<14;z++)for(let y=2;y<14;y++)for(let x=6;x<26;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,bath);
    w._meso3i_drain_edge(3); w._meso3i_tick();
  }
  console.log(`${tag}: emitted(phn=${w._meso3i_photons()}) ev2=${w._meso3i_ev(2)}`);
}
