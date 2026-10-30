// link3couple: pair exchange vs separation — how much of A's light
// reaches B as the gap grows. The interaction's coupling falloff.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
// A emits +x continuously (phset feed), B is a wound absorber.
// Measure photons crossing the plane just before B vs gap.
console.log('gap | photons arriving at B | coupling (vs gap=4 ref)');
let ref=0;
for (const gap of [4,8,12,16,20,24]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(0);w._link3_phot(0);w._link3_drain_edge(0);w._link3_phspread(64);
  const x1=32-gap/2, x2=32+gap/2;
  // A = continuous photon source (phset feeds), B = wound absorber
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)
    for(let x=x2-2;x<x2+2;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_rset(x,y,z,13,96);}
  for(let t=0;t<100;t++){
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=x1-2;x<x1+2;x++)
      if(!((x+y+z)&1))w._link3_phset(x,y,z,12,8);
    w._link3_tick();
  }
  // photons crossing the plane at x2-3 (just before B)
  let arr=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=x2-3;x<x2;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)arr+=w._link3_phget(x,y,z,c);
  }
  if(gap===4)ref=arr||1;
  console.log(`${gap} | ${arr} | ${(arr/ref).toFixed(3)}`);
}
