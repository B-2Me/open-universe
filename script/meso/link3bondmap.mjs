// link3bondmap: WHERE does the deep bond live — on links connecting
// the pair, or on each lump's own transverse faces?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for(const[tag,wa,wb]of[['12^13 facing',12,13],['14^15 transverse',14,15]]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wa,96);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wb,96);}
  }
  for(let t=0;t<150;t++)w._link3_tick();
  // bond depth on GAP links (between the lumps) vs lump-local links
  let gap=0,loc=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++){
      const b=w._link3_bond(x,y,z,c);
      if(x>=30&&x<34)gap+=b;              // links in the gap between lumps
      else if((x>=26&&x<30)||(x>=34&&x<38))loc+=b;  // links on the lumps themselves
    }
  }
  console.log(`${tag}: gap-links bond=${gap} lump-local bond=${loc}`);
}
