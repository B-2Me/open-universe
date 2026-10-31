// link3ppthresh: pair-production threshold — photon density vs
// drest pair produced. Nature: needs >= 2mc^2 (gamma -> ee only
// above threshold). Ours: LFUS density gate — but does the YIELD
// track energy (nu) or just count?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (dens, nu) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(0);
  w._link3_fusion(96);w._link3_egate(0);w._link3_dwell(1);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=20;x<24;x++)if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,dens);w._link3_phnu_set(x,y,z,12,nu);}
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_phset(x,y,z,13,dens);w._link3_phnu_set(x,y,z,13,nu);}
  }
  for(let t=0;t<60;t++)w._link3_tick();
  let dr=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++){
    if((x+y+z)&1)continue;
    dr+=w._link3_drest(x,y,z,12)+w._link3_drest(x,y,z,13);}
  return dr;
};
console.log('nu sweep at fixed dens=120 — does yield track ENERGY or COUNT?');
for(const nu of [4,16,32,64]){
  console.log(`nu=${nu}: drest=${await run(120,nu)}`);
}
console.log('density sweep (nu=32):');
for(const d of [40,80,120,160,200]){
  console.log(`dens=${d}: drest=${await run(d,32)}`);
}
