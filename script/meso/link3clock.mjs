// link3clock: does a drifting lump's clock dilate on the link engine?
// Same signature as meso3i E119 — wound lump drifts, emission slows.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,wind] of [['stationary',0],['wound+x',12],['wound+y',6]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);w._link3_recoil(1);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,240);
                      if(wind)w._link3_rset(x,y,z,wind,64); }
  w._link3_ev_reset();
  for(let t=0;t<120;t++) w._link3_tick();
  const ev=w._link3_ev(4);
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<64;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  console.log(`${tag}: emissions=${ev} (rate=${(ev/120).toFixed(1)}/tick) centroid=${cent().toFixed(1)}`);
}
