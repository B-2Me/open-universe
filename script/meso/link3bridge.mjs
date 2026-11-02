// link3bridge: is the gap mass a real bridge — coherent structure
// between the lumps, or scattered deposits? Spatial map + time.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(64,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_photdecay(96);w._link3_fusion(96);w._link3_egate(16);w._link3_ieburst(200);
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=24;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,200);}
  for(let x=38;x<44;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,200);}
}
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<38;x++)
  if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,48);w._link3_phset(x,y,z,13,48);}
for(let t=0;t<120;t++)w._link3_tick();
// y-z slice through the gap (x=31-36) — coherent structure?
console.log('gap mass map (y rows, z cols) at x=32-35:');
for(let y=4;y<12;y++){
  let row='';
  for(let z=4;z<12;z++){
    let s=0;for(let x=31;x<36;x++){if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._link3_drest(x,y,z,c);s+=w._link3_rest(x,y,z);}
    row+= s>100?'#':s>40?'+':s>10?'.':' ';
  }
  console.log(`  y=${y}: ${row}`);
}
// does the bridge persist — run more, watch gap mass
let gm=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=31;x<36;x++){
  if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)gm+=w._link3_drest(x,y,z,c);gm+=w._link3_rest(x,y,z);}
const g0=gm;
for(let t=0;t<80;t++)w._link3_tick();
gm=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=31;x<36;x++){
  if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)gm+=w._link3_drest(x,y,z,c);gm+=w._link3_rest(x,y,z);}
console.log(`gap mass: t120=${g0} t200=${gm}`);
