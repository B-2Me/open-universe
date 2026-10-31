// link3backtoback: annihilation photon symmetry — does a drest
// pair annihilate into two antipodal photons? (pion/ee -> 2gamma
// back-to-back, momentum conserving)
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
const NMOV=w._link3_nch()-1;
w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);w._link3_annih(64);
// seed opposing drest on channel 12/13 at a site — should annihilate
for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=22;x<26;x++)
  if(!((x+y+z)&1)){w._link3_rset(x,y,z,12,200);w._link3_rset(x,y,z,13,200);w._link3_eset(x,y,z,160);}
for(let t=0;t<40;t++)w._link3_tick();
// photon counts per channel — are they antipodal pairs?
const counts=[];
for(let c=0;c<NMOV;c++){
  let n=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)
    if(!((x+y+z)&1))n+=w._link3_phget(x,y,z,c);
  if(n)counts.push(`c${c}:${n}`);}
console.log(`annih=${w._link3_ev(12)} photons: ${counts.join(' ')}`);
