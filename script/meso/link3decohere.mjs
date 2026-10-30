// link3decohere: session lifetime — does an established bond survive
// interference? Build the session, inject a disruption, watch CLOSED.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,disrupt] of [['quiet',0],['disrupted',1]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);}
  }
  // build the session — sustained gap exchange
  for(let t=0;t<100;t++){
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,20);w._link3_phset(x,y,z,13,20);}
    w._link3_tick();
  }
  const est=()=>{let n=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)n++;return n;};
  const e0=est();
  // disrupt: blast the gap with mass — does the session die?
  if(disrupt)for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<34;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,200);
  let closed=0;
  for(let t=0;t<60;t++){w._link3_tick();}
  console.log(`${tag}: estab ${e0}->${est()} closes=${w._link3_ev(15)}`);
}
