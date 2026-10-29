// crystallize (E94): random mass + photon bath — does a lattice SELF-ORGANIZE?
// Count rest "peaks" (sites with rest>thresh) over time — lumps forming.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=64,H=48,D=16;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_scatter(128); w._meso3i_seed(7);
// uniform mass drizzle + photon bath — no structure seeded
for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++)
  if(!((x+y+z)&1)){ const r=((x*7+y*11+z*13)%9); w._meso3i_set(x,y,z,REST,r*8); w._meso3i_phset(x,y,z,12,8); w._meso3i_phset(x,y,z,13,8); }
// count peaks: sites with rest>64 (lump cores) + max site value
const peaks=()=>{let n=0,mx=0;for(let z=4;z<D-4;z++)for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
  if((x+y+z)&1)continue;const v=w._meso3i_get(x,y,z,REST);if(v>64)n++;if(v>mx)mx=v;}return[n,mx];};
const out=[];
for(let t=0;t<300;t++){
  if(t%4===0)for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=6;x<58;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,4);
  w._meso3i_tick();
  if(t%30===0){const[n,mx]=peaks();out.push(`t${t}:peaks=${n} maxRest=${mx}`);}
}
console.log(`crystallize: ${out.join(' | ')}`);
