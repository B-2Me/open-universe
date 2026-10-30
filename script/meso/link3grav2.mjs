// link3grav2: clean gravity test — a mass packet just OUTSIDE a
// lump's edge. Does it get pulled in, or drift past?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,gr] of [['grav=0',0],['grav=24',24]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(48,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(0);w._link3_phot(0);w._link3_drain_edge(2);
  if(w._link3_grav)w._link3_grav(gr);
  // lump at x=20-28; mass packet on +x channel at x=14 — aimed at lump
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=20;x<28;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,REST,64);
  // grazing packet on +x aimed ABOVE the lump (y=3-4, lump is y=5-11)
  for(let z=6;z<10;z++)for(let y=3;y<5;y++)for(let x=8;x<14;x++)
    if(!((x+y+z)&1))w._link3_set(x,y,z,12,48);
  for(let t=0;t<60;t++)w._link3_tick();
  // where did the packet land — in the lump, past it, or bounced?
  // did the grazing packet deflect INTO the lump's rows (y>=5)?
  let captured=0,passed=0;
  for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<48;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++){v+=w._link3_drest(x,y,z,c);v+=w._link3_upget(x,y,z,c);}
    if(y>=5&&y<11&&x>=18&&x<30)captured+=v;
    if(x>=32)passed+=v;}
  console.log(`${tag}: captured=${captured} passed=${passed}`);
}
