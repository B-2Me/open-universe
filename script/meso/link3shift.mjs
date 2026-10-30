// link3shift: does the lump's spectral line SHIFT as it charges?
// Track the site's nu as iE builds — the absorption line moving.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_photdecay(96);w._link3_egate(16);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_rset(x,y,z,12,96); w._link3_eset(x,y,z,40); }
// feed photons — the lump charges, its line should shift
const out=[];
for(let t=0;t<200;t++){
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=28;x<32;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,13,12);
  w._link3_tick();
  if(t%40===0)out.push(`t${t}:nu=${w._link3_snu(24,8,8)} iE=${w._link3_eget(24,8,8)}`);
}
console.log(out.join(' | '));
