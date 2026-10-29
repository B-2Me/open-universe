// grav-avg (E77): emergent gravity as retention asymmetry — does a lump
// keep its neighbors' flux better than empty space? (friction = the pull)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const lump of [0, 1]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  // lump or empty control at center
  if(lump)for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  // isotropic mass bath — mass rains on everything
  for(let z=2;z<14;z++)for(let y=2;y<14;y++)for(let x=2;x<30;x++){
    if((x+y+z)&1)continue;
    for(const c of [12,13,14,15,16,17]) w._meso3i_set(x,y,z,c,4);
  }
  for(let t=0;t<80;t++){ w._meso3i_drain_edge(2); w._meso3i_tick(); }
  // measure mass in the lump bbox vs same-size ring around it
  let inL=0,inR=0;
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++){
    if((x+y+z)&1)continue; inL+=w._meso3i_get(x,y,z,REST); }
  for(let z=2;z<14;z++)for(let y=2;y<14;y++)for(let x=6;x<12;x++){
    if((x+y+z)&1)continue; inR+=w._meso3i_get(x,y,z,REST); }
  console.log(`lump=${lump}: lump-region rest=${inL} control-region rest=${inR} ratio=${(inL/Math.max(inR,1)).toFixed(2)}`);
}
