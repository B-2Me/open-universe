// link3recoil: does absorption push the absorber? Radiation
// pressure — photon beam vs a wound lump's momentum (up on +x).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_photdecay(96);w._link3_egate(16);w._link3_recoil(1);
// absorber lump wound -x (accepts the +x beam's offer)
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=34;x<40;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_rset(x,y,z,13,96); }
// +x photon beam on the lump
for(let t=0;t<150;t++){
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=8;x<14;x++)
    if(!((x+y+z)&1))w._link3_phset(x,y,z,12,16);
  w._link3_tick();
}
// lump's forward momentum — mass in flight on +x channel at lump sites
let up=0,dn=0;
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=32;x<42;x++){
  if((x+y+z)&1)continue;
  up+=w._link3_upget(x,y,z,12);dn+=w._link3_upget(x,y,z,13);
}
console.log(`lump momentum: +x up=${up} -x dn=${dn}`);
// and center-of-mass drift
let cx=0,m=0;
for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
  if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
  for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  m+=v;cx+=v*x;}
console.log(`mass=${m} cx=${(cx/Math.max(1,m)).toFixed(1)} (started ~37)`);
