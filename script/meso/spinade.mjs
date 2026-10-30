// spinade (E107): does a wound lump eat photons asymmetrically?
// Spin drest on +x through the lump, bathe it in isotropic light —
// does the side where winding meets incoming photons deplete more?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const [tag,wind] of [['unwound',0],['wound+12',12],['wound-13',13]]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(0); w._meso3i_scatter(0);
  if(w._meso3i_photdecay) w._meso3i_photdecay(8);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); if(wind)w._meso3i_dset(x,y,z,wind,64); }
  // isotropic photon bath around the lump
  for(let t=0;t<120;t++){
    if(t%2===0)for(let z=2;z<14;z++)for(let y=2;y<14;y++)for(let x=6;x<26;x++)
      if(!((x+y+z)&1)){ for(let c=0;c<NMOV;c++)if(c!==wind)w._meso3i_phset(x,y,z,c,4); }
    w._meso3i_tick();
  }
  // light asymmetry: photon density on -x side (x<12) vs +x side (x>20)
  let lft=0,rgt=0;
  for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=8;x<12;x++)for(let c=0;c<NMOV;c++)lft+=w._meso3i_phget(x,y,z,c);
    for(let x=20;x<24;x++)for(let c=0;c<NMOV;c++)rgt+=w._meso3i_phget(x,y,z,c);
  }
  console.log(`${tag}: light(-x side)=${lft} (+x side)=${rgt} asym=${((lft-rgt)/Math.max(lft+rgt,1)).toFixed(3)}`);
}
