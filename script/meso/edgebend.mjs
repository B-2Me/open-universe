// edgebend (E100): asymmetric conversion lensing — does a beam grazing
// a lump's edge lose quanta on the mass-facing side?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
for (const pd of [0, 8]) {
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=64,H=32,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
  w._meso3i_phot(0); w._meso3i_scatter(0);   // NO absorb/scatter — isolate decay
  if(w._meso3i_photdecay) w._meso3i_photdecay(pd);
  // lump at y=20, beam on +x at y=16 (grazes the edge — 4 above it)
  for(let z=4;z<12;z++)for(let y=18;y<24;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  // beam on +x at y=16, x in [4,6], sustained
  const rowPhn=(x,dy)=>{let s=0;for(let z=4;z<12;z++)for(let y=12;y<20;y+=2){
    if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++)s+=w._meso3i_phget(x,y+dy,z,c);}return s;};
  for(let t=0;t<80;t++){
    for(let z=4;z<12;z++)for(let y=14;y<18;y++)for(let x=4;x<6;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    w._meso3i_tick();
  }
  // beam profile past the lump (x=50): near side (y=17-19, facing lump) vs far side (y=13-15)
  let near=0,far=0;
  for(let z=4;z<12;z++){
    for(let y=17;y<20;y++)for(let c=0;c<NMOV;c++)near+=w._meso3i_phget(50,y,z,c);
    for(let y=13;y<16;y++)for(let c=0;c<NMOV;c++)far+=w._meso3i_phget(50,y,z,c);
  }
  console.log(`pd=${pd}: beam past lump — near-side=${near} far-side=${far} ratio=${(near/Math.max(far,1)).toFixed(2)}`);
}
