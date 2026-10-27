import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const w = await mod.exports();
w._meso3i_init(24,12,12,1);
// seed hot excitation on even sites, tick, then scan photon coords
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0); w._meso3i_friction(0); w._meso3i_drest(0); w._meso3i_reflect(0); w._meso3i_phot(7); w._meso3i_fricmode(-500);
for(let z=0;z<12;z++)for(let y=0;y<12;y++)for(let x=0;x<24;x++)
  if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,4); w._meso3i_eset(x,y,z,20); }
for(let t=0;t<5;t++) w._meso3i_tick();
let hits=0,odd=0; const seen=[];
for(let z=0;z<12;z++)for(let y=0;y<12;y++)for(let x=0;x<24;x++){
  let p=0; for(let c=0;c<NMOV;c++) p+=w._meso3i_phget(x,y,z,c);
  if(p){ hits++; if((x+y+z)&1)odd++; if(seen.length<5)seen.push(`(${x},${y},${z}):${p}`); } }
console.log('sites-with-photons:',hits,'odd-parity:',odd,'IPHN:',w._meso3i_photons(),'first:',seen.join(' '));
