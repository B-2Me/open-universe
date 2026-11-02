// link3clock2: the conveyor cycle as the lump's internal clock —
// wound mass circulates (leak->hop->park). Does the cycle slow
// when the lump drifts? The light-clock geometry on link mechanics.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,wind] of [['still',0],['wound+x',12]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(0);w._link3_drain_edge(2);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64);
                      if(wind)w._link3_rset(x,y,z,wind,96); }
  w._link3_ev_reset();
  // conveyor events (ev3) = circulation rate; mass centroid = drift
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const x0=cent();
  const rates=[];
  for(let w2=0;w2<4;w2++){
    for(let t=0;t<40;t++)w._link3_tick();
    rates.push(w._link3_ev(3));w._link3_ev_reset();
  }
  console.log(`${tag}: conv rates=${rates.join(',')} drift=${(cent()-x0).toFixed(1)}`);
}
