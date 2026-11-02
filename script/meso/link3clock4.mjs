// link3clock4: honest clock test — VACUUM, no feed. The lump's own
// internal cycle (iE beat from seeded charge), still vs drifting.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
for (const [tag,wind] of [['still',0],['wound+x',12]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(96,16,16,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(2);
  w._link3_ieburst(200);w._link3_recoil(1);
  // charged lump — seed iE once, NO sustained feed (the lump's own clock)
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=44;x<52;x++)
    if(!((x+y+z)&1)){ w._link3_set(x,y,z,REST,64); w._link3_eset(x,y,z,200);
                      if(wind)w._link3_rset(x,y,z,wind,128); }
  w._link3_ev_reset();
  const cent=()=>{let m=0,sx=0;for(let z=0;z<16;z++)for(let y=0;y<16;y++)for(let x=0;x<96;x++){
    if((x+y+z)&1)continue;let v=w._link3_rest(x,y,z);
    for(let c=0;c<NMOV;c++)v+=w._link3_drest(x,y,z,c);
    m+=v;sx+=v*x;}return m?sx/m:0;};
  const x0=cent();
  for(let t=0;t<120;t++) w._link3_tick();
  const drift=cent()-x0;
  console.log(`${tag}: bursts=${w._link3_ev(11)} emissions=${w._link3_ev(4)} drift=${drift.toFixed(1)} rest=${w._link3_rest_mass()}`);
}
