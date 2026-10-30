// link3iq: does the collision domain breathe? Opposing streams ->
// iQ fills -> backoff -> flush -> refill (the oscillator).
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
w._link3_friction(0);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(2);
w._link3_iqmode(1);w._link3_iqcap(48);w._link3_iqdwell(8);
// two counter-propagating mass beams crossing x=24
for(let z=4;z<12;z++)for(let y=4;y<12;y++){
  for(let x=6;x<12;x++)if(!((x+y+z)&1))w._link3_set(x,y,z,12,96);
  for(let x=36;x<42;x++)if(!((x+y+z)&1))w._link3_set(x,y,z,13,96);
}
const spark=(v,mx)=>{const h=' .:+*#';return h[Math.min(6,Math.floor(v/mx*7))]};
const iq=[],qtot=[];
for(let t=0;t<150;t++){
  w._link3_tick();
  let q=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=16;x<32;x++){
    if((x+y+z)&1)continue;q+=w._link3_qget(x,y,z);}
  iq.push(w._link3_qget(24,8,8));qtot.push(q);
}
const mx=Math.max(...qtot,1);
console.log(`iQ@24: ${iq.map(v=>spark(v,255)).join('')}`);
console.log(`iQtot:  ${qtot.map(v=>spark(v,mx)).join('')}`);
console.log(`flush ev=${w._link3_ev(10)} iqtot=${qtot[qtot.length-1]}`);
