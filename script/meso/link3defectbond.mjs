// link3defectbond: defect vs winding-match — does a partial bond
// carry a partial defect? (12^13 full vs 12^4 partial vs 12^12 none)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
console.log('pair | defect ratio | estab');
for (const [tag,wb] of [['12^13 antipodal',13],['12^4 partial',4],['12^12 same',12],['12^0 diag-face',0]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(1);w._link3_drain_edge(2);
  w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
  for(let z=5;z<11;z++)for(let y=5;y<11;y++){
    for(let x=26;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,12,96);}
    for(let x=34;x<38;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,160);w._link3_rset(x,y,z,wb,96);}
  }
  for(let t=0;t<150;t++)w._link3_tick();
  let tot=w._link3_rest_mass()+w._link3_mov_mass(),est=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;
    tot+=w._link3_eget(x,y,z);
    if(x>=28&&x<36)for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)est++;
  }
  console.log(`${tag}: ${(tot/28580).toFixed(3)} | estab=${est}`);
}
