// link3star: server+client topology — dense hub + light clients
// wound toward it. Does the star hold better than peer pairs?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(96,24,24,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);
// dense hub at center
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=44;x<52;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,200);}
// two clients: left wound +x (toward hub), right wound -x (toward hub)
for(let z=10;z<14;z++)for(let y=10;y<14;y++){
  for(let x=30;x<34;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,32);w._link3_eset(x,y,z,120);w._link3_rset(x,y,z,13,96);}
  for(let x=62;x<66;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,32);w._link3_eset(x,y,z,120);w._link3_rset(x,y,z,12,96);}
}
for(let t=0;t<200;t++)w._link3_tick();
// client positions — did they stay near the hub or drift off?
let cl=0,cr=0,ml=0,mr=0;
for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=0;x<96;x++){
  if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
  for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
  if(x<40){cl+=v*x;ml+=v;}else if(x>56){cr+=v*x;mr+=v;}}
console.log(`left client cx=${ml?(cl/ml).toFixed(1):'gone'} (started ~32)`);
console.log(`right client cx=${mr?(cr/mr).toFixed(1):'gone'} (started ~64)`);
// sessions into the hub region
let est=0;
for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=38;x<58;x++)
  if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)
    if(w._link3_sst(x,y,z,c)===3)est++;
console.log(`hub-region sessions=${est}`);
