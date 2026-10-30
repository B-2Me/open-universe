// link3ledger: nu conservation check — does iE drop == emitted nu?
// Emit, measure the charge delta vs the photon's carried tag.
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
w._link3_friction(32);w._link3_emit(32);w._link3_phot(1);w._link3_drain_edge(0);
w._link3_egate(16);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,200); w._link3_rset(x,y,z,12,96); }
let ie0=0,nu0=0;
for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)
  if(!((x+y+z)&1))ie0+=w._link3_eget(x,y,z);
for(let t=0;t<80;t++)w._link3_tick();
let ie1=0,photn=0,nusum=0;
for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)
  if(!((x+y+z)&1)){ie1+=w._link3_eget(x,y,z);
    for(let c=0;c<NMOV;c++){const p=w._link3_phget(x,y,z,c);if(p){photn+=p;nusum+=w._link3_phnu(x,y,z,c)*p;}}}
console.log(`t0: iE=${ie0} | t80: iE=${ie1} photons=${photn} nu_carried=${nusum}`);
console.log(`total energy t0=${ie0} vs t80=${ie1+nusum} (${((ie1+nusum)/ie0).toFixed(3)} of initial)`);
