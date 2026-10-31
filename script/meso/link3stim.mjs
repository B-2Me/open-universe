// link3stim: stimulated emission — does a nu-matched photon stream
// trigger MORE emission at that nu? (laser condition: photon of
// matching frequency stimulates the excited lump to emit in phase)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here,'../../docs/public/wasm/ember');
const src = readFileSync(join(DIR,'link3.js'), 'utf8');
const run = async (stimNu) => {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,DIR,'link3.js');return m.exports();})();
  w._link3_init(64,20,20,1);
  const NMOV=w._link3_nch()-1,REST=NMOV;
  w._link3_friction(32);w._link3_emit(4);w._link3_phot(5);w._link3_drain_edge(0);
  w._link3_egate(0);w._link3_phspread(0);w._link3_dwell(1);w._link3_ieburst(160);
  // charged lump at center, emitting at its site line
  for(let z=7;z<13;z++)for(let y=7;y<13;y++)for(let x=29;x<35;x++)
    if(!((x+y+z)&1)){w._link3_set(x,y,z,REST,64);w._link3_eset(x,y,z,200);w._link3_snu_set(x,y,z,32);}
  // drive beam: photons matching the lump's line (nu=32) or off-line (nu=8)
  for(let z=8;z<12;z++)for(let y=8;y<12;y++)for(let x=6;x<12;x++)
    if(!((x+y+z)&1)){w._link3_phset(x,y,z,12,64);w._link3_phnu_set(x,y,z,12,stimNu);}
  const e0=w._link3_photons();
  for(let t=0;t<80;t++)w._link3_tick();
  // emitted photons at nu=32 (the lump's line) vs total
  let match=0,all=0;
  for(let z=0;z<20;z++)for(let y=0;y<20;y++)for(let x=0;x<64;x++)
    for(let c=0;c<NMOV;c++){const p=w._link3_phget(x,y,z,c);all+=p;
      if(w._link3_phnu(x,y,z,c)===32)match+=p;}
  return {match,all,emitted:w._link3_ev(11)};
};
for(const nu of [8,32]){
  const r=await run(nu);
  console.log(`drive nu=${nu}: emitted=${r.emitted} ph@${r.match} (nu=32) total=${r.all}`);
}
