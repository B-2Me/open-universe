// link3hubdist: client distance sweep — do closer clients win the
// hub's attention? (orbital shells — inner ring vs outer ring)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(96,40,40,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);w._link3_phspread(96);w._link3_dwell(4);
for(let z=17;z<23;z++)for(let y=17;y<23;y++)for(let x=45;x<51;x++)
  if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,128);w._link3_eset(x,y,z,255);}
// inner ring at r=6 (2 clients) + outer ring at r=14 (2 clients)
const clients=[[6,0,0,12],[0,6,0,14],[14,0,0,13],[0,14,0,15]];
for(const[dx,dy,dz,wind]of clients)
  for(let z=18;z<22;z++)for(let y=18;y<22;y++)for(let x=46;x<50;x++)
    if(!((x+dx+y+dy+z+dz)&1)){w._link3_set(x+dx,y+dy,z+dz,REST,32);w._link3_eset(x+dx,y+dy,z+dz,160);w._link3_rset(x+dx,y+dy,z+dz,wind,96);}
for(let t=0;t<200;t++)w._link3_tick();
// sessions near each client direction
for(const[dx,dy]of clients){
  let est=0;
  for(let z=0;z<40;z++)for(let y=Math.max(0,18+dy-4);y<Math.min(40,22+dy+4);y++)
    for(let x=Math.max(0,46+dx-4);x<Math.min(96,50+dx+4);x++)
      if(!((x+y+z)&1))for(let c=0;c<NMOV;c++)if(w._link3_sst(x,y,z,c)===3)est++;
  console.log(`client at r=${dx||dy}: sessions nearby=${est}`);
}
