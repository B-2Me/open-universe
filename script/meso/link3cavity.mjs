// link3cavity: the bond's duplex exchange — two lumps trade photons,
// opposing streams meet at the midpoint. Does mass nucleate IN the gap?
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
// two charged lumps — they'll emit photons toward each other
for(let z=5;z<11;z++)for(let y=5;y<11;y++){
  for(let x=24;x<30;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,200);}
  for(let x=38;x<44;x++)if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,200);}
}
// the duplex exchange: +x photons A->B and -x photons B->A in the gap
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=30;x<38;x++)
  if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,48);w._link3_phset(x,y,z,13,48);}
for(let t=0;t<150;t++)w._link3_tick();
// mass profile across the gap — did anything form BETWEEN the lumps?
const prof=[];
for(let x=16;x<52;x+=2){
  let s=0;for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x2=x;x2<x+2;x2++){
    if((x2+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._link3_drest(x2,y,z,c);s+=w._link3_rest(x2,y,z);}
  prof.push(s);}
console.log(`mass x-prof: ${prof.join(',')}`);
console.log(`fus=${w._link3_ev(9)} conv=${w._link3_ev(8)} phn=${w._link3_photons()}`);
