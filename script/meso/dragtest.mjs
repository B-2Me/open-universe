// dragtest (E123): photons inherit mass direction (massdrag) and
// mass inherits photon direction (photdrag) — the two-way drag.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
// A) massdrag: photons seeded isotropically INSIDE a wound lump —
// do they end up on the wound channel (riding the mass direction)?
for(const md of [0,16]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_mdrag)w._meso3i_mdrag(md);
  for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=12;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,64); w._meso3i_dset(x,y,z,12,64);
                      for(let c=0;c<NMOV;c++)w._meso3i_phset(x,y,z,c,4); }
  for(let t=0;t<60;t++)w._meso3i_tick();
  // photon channel histogram across grid
  const chs=new Array(NMOV).fill(0);
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    for(let c=0;c<NMOV;c++)chs[c]+=w._meso3i_phget(x,y,z,c);}
  console.log(`mdrag=${md}: ch12(+x)=${chs[12]} ch13(-x)=${chs[13]} tot=${chs.reduce((a,b)=>a+b)}`);
}
// B) photdrag: mass quantum entering a photon wind — does it ride +x?
for(const pd of [0,16]){
  const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(0);w._meso3i_fricmode(0);
  w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_pdrag)w._meso3i_pdrag(pd);
  // mass beam on +x at left; photon wind +x through the whole region
  for(let z=4;z<12;z++)for(let y=4;y<12;y++){
    for(let x=4;x<8;x++)if(!((x+y+z)&1))w._meso3i_set(x,y,z,13,64);
  }
  for(let t=0;t<30;t++){
    for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=12;x<20;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,16);
    w._meso3i_tick();
  }
  const cent=()=>{let m=0,sx=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++){const v=w._meso3i_get(x,y,z,c);m+=v;sx+=v*x;}}return m?sx/m:0;};
  console.log(`pdrag=${pd}: -x beam centroid=${cent().toFixed(1)} (started x=6 — pulled +x by photon wind?)`);
}
