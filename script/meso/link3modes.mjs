// link3modes: does a bound pair have discrete stable configurations?
// Different winding assignments = different stable exchange modes?
// (the "levels" of a bound system, not recursion — same pair,
// different stable states)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
// antipodal pair on different axes — are the stable modes distinct?
for (const [tag,wa,wb] of [['12^13 axis',12,13],['8^9 diag',8,9],['14^15 y-axis',14,15],['12^13 low iE',12,13]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  const ie = tag.includes('low') ? 60 : 160;
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,ie);w._link3_rset(x,y,z,wa,96);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,ie);w._link3_rset(x,y,z,wb,96);}
  }
  for(let t=0;t<150;t++)w._link3_tick();
  let est=0,ssum=0,n=0,bnd=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1))for(let c=0;c<NMOV;c++){
      if(w._link3_sst(x,y,z,c)===3){est++;ssum+=w._link3_sess(x,y,z,c);bnd+=w._link3_bond(x,y,z,c);n++;}
    }
  console.log(`${tag}: estab=${est} avgSess=${n?(ssum/n).toFixed(1):0} bond=${bnd}`);
}
