// link3annih: composite vs its MIRROR — does an antipodal-bound pair
// annihilate when it meets its opposite-wound counterpart?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,wb] of [['same (+x)',12],['mirror (-x)',13]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);w._link3_annih(64);
  // lump A +x wound approaching lump B (wound wb) — collision course
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=30;x<36;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,128);}
    for(let x=50;x<56;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wb,128);}
  }
  const tot=()=>w._link3_rest_mass();
  const out=[];
  for(let t=0;t<250;t++){
    w._link3_tick();
    if(t%50===0)out.push(`t${t}:${tot()}`);
  }
  console.log(`${tag}: ${out.join(' | ')} annih=${w._link3_ev(12)} phn=${w._link3_photons()}`);
}
