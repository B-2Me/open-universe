// link3dynscales: the substrate's dynamical scale hierarchy —
// characteristic times/lengths for each process, all measured
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');

// 1. iE decay lifetime — how fast does charge drain to photons?
const w1 = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w1._link3_init(48,16,16,1);
const NMOV=w1._link3_nch()-1,REST=NMOV;
w1._link3_friction(32);w1._link3_emit(4);w1._link3_phot(0);w1._link3_drain_edge(0);
w1._link3_ieburst(160);w1._link3_egate(0);w1._link3_dwell(1);
for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=21;x<27;x++)
  if(!((x+y+z)&1)){w1._link3_set(x,y,z,REST,64);w1._link3_eset(x,y,z,200);}
const e0=(()=>{let s=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)s+=w1._link3_eget(x,y,z);return s;})();
const es=[];
for(let t=0;t<100;t++){w1._link3_tick();
  if(t%20===0){let s=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)s+=w1._link3_eget(x,y,z);es.push(s);}}
let ef=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)ef+=w1._link3_eget(x,y,z);
console.log(`iE decay: ${e0} -> ${ef} in 100 ticks (series: ${es.join(',')})`);
// half-life
let half=Math.log(2)*100/Math.log(e0/Math.max(1,ef));
console.log(`iE half-life ~${half.toFixed(0)} ticks`);
