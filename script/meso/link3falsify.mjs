// link3falsify: does binding strength ∝ session traffic? Vary the
// exchange feed, measure pair cohesion (drift-resistance) vs session
// flow — if they don't correlate, session != bond.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const feed of [0,8,24,48]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_photdecay(96);w._link3_egate(16);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=36;x<40;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=44;x<48;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
  }
  // build the session at this feed level
  for(let t=0;t<80;t++){
    for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=40;x<44;x++)
      if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,feed);w._link3_phset(x,y,z,13,feed);}
    w._link3_tick();
  }
  const sess=()=>{let s=0;for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=40;x<44;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)s+=w._link3_bond(x,y,z,c);return s;};
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const x0=cent(),sess0=sess();
  for(let t=0;t<120;t++)w._link3_tick();
  console.log(`feed=${String(feed).padStart(2)}: bond=${sess0} drift=${(cent()-x0).toFixed(1)}`);
}
