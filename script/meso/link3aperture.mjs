// link3aperture: emission-spread beam — a wound lump emits with
// aperture slop, photons born on neighbor channels fly straight.
// Channel mix should be identical near and far (cone set at birth).
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
w._link3_friction(0);w._link3_phot(1);w._link3_drain_edge(0);w._link3_phspread(96);
w._link3_emit(8);w._link3_egate(16);
// emitter lump wound +x, charged — emits +x with aperture spread
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=8;x<14;x++)
  if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,200); w._link3_rset(x,y,z,12,128); }
for(let t=0;t<120;t++)w._link3_tick();
// channel mix in a near slab (x=20-28) vs far slab (x=60-70)
for(const[a,b,tag]of[[20,28,'near x~24'],[60,70,'far x~65']]){
  let px=0,pd=0,pm=0;
  for(let z=0;z<24;z++)for(let y=0;y<24;y++)for(let x=a;x<b;x++){
    if((x+y+z)&1)continue;
    px+=w._link3_phget(x,y,z,12);
    pm+=w._link3_phget(x,y,z,13);
    for(let c=0;c<12;c++)pd+=w._link3_phget(x,y,z,c);
  }
  const t=px+pd+pm;
  console.log(`${tag}: +x=${(100*px/Math.max(1,t)).toFixed(1)}% diag=${(100*pd/Math.max(1,t)).toFixed(1)}% -x=${(100*pm/Math.max(1,t)).toFixed(2)}% n=${t}`);
}
