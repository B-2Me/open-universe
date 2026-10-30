// link3loops: does the emission respond to charge now (iE-boost)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,e0,ph] of [['dark',0,0],['charged',200,0],['charged+feed',200,1]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,e0); }
  w._link3_ev_reset();
  for(let t=0;t<100;t++){
    if(ph)for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=28;x<34;x++)
      if(!((x+y+z)&1))w._link3_phset(x,y,z,13,16);
    w._link3_tick();
  }
  console.log(`${tag}: emissions=${w._link3_ev(2)}+${w._link3_ev(4)} absorbed=${w._link3_ev(7)} conv=${w._link3_ev(8)}`);
}
