// link3clock3: does the lump's circulation clock slow when it drifts?
// Vary winding -> vary drift speed -> measure conveyor rate (the clock).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const wind of [32, 64, 128, 200]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(0);w._link3_drain_edge(2);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=44;x<52;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_rset(x,y,z,12,wind); }
  w._link3_ev_reset();
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const x0=cent();
  let conv=0;
  for(let t=0;t<120;t++)w._link3_tick();
  conv=w._link3_ev(3);
  const v=(cent()-x0)/120;
  console.log(`wind=${wind}: v=${v.toFixed(3)} conv=${(conv/120).toFixed(0)}/tick drest_total=${(()=>{let s=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._link3_drest(x,y,z,c);}return s})()}`);
}
