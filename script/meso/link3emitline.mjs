// link3emitline: does the lump's emission spectrum cluster at its
// own line? (the emission lines should match the absorption lines)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
w._link3_init(48,16,16,1);
const NMOV=w._link3_nch()-1,REST=NMOV;
w._link3_friction(32);w._link3_emit(8);w._link3_phot(5);w._link3_drain_edge(2);
w._link3_ieburst(160);w._link3_egate(16);
for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=20;x<28;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,160); w._link3_rset(x,y,z,12,96); }
for(let t=0;t<100;t++)w._link3_tick();
// emission spectrum — nu histogram of all photons
const hist={};
for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++)
  if(!((x+y+z)&1))for(let c=0;c<NMOV;c++){
    const v=w._link3_phget(x,y,z,c);if(v){const nu=w._link3_phnu(x,y,z,c);hist[nu]=(hist[nu]||0)+v;}
  }
console.log(`site nu=${w._link3_snu(24,8,8)}`);
console.log(`emission spectrum: ${Object.entries(hist).map(([n,c])=>`nu${n}:${c}`).join(' ')}`);
