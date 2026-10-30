// link3spectra: the element's spectral signature — do lumps of
// different charge states have measurably different absorption
// lines? (the substrate's "periodic table" as spectra)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,ie,wind] of [['hot +x',200,12],['cool +x',40,12],['hot -x',200,13]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_photdecay(96);w._link3_egate(16);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,ie); w._link3_rset(x,y,z,wind,96); }
  for(let t=0;t<10;t++)w._link3_tick();
  // read the lump's spectral line (its nu signature)
  let nu=0,n=0;
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=22;x<26;x++)
    if(!((x+y+z)&1)){nu+=w._link3_snu(x,y,z);n++;}
  console.log(`${tag}: site nu=${(nu/Math.max(1,n)).toFixed(1)} iE=${w._link3_eget(24,8,8)}`);
}
