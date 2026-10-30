// link3distance: bond strength vs separation — the scaling law.
// Real forces: 1/r^2 (Coulomb/gravity), exponential (strong).
// Measure session establishment + strength at increasing gaps.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
console.log('gap | estab | avg sess strength on gap links');
for (const gap of [2,4,8,12,16,20]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  const x1=32-gap/2, x2=32+gap/2;
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=x1-2;x<x1+2;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=x2-2;x<x2+2;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,13,96);}
  }
  for(let t=0;t<120;t++)w._link3_tick();
  let est=0,ssum=0,n=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=x1;x<x2;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++){
      if(w._link3_sst(x,y,z,c)===3){est++;ssum+=w._link3_sess(x,y,z,c);n++;}
    }
  console.log(`${gap} | ${est} | ${n?(ssum/n).toFixed(1):0}`);
}
