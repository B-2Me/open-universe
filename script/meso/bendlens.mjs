// bendlens (E106): asymmetric-conversion lensing — pulsed beam grazes
// a lump edge; the mass-facing side should deplete more (catalyst
// gated decay eats near-side photons).
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
  w._meso3i_phot(0); w._meso3i_scatter(0);
  if(w._meso3i_photdecay) w._meso3i_photdecay(pd);
  // lump at y=18-24, x=28-36 — beam grazes its top edge (y=15-17)
  for(let z=4;z<12;z++)for(let y=18;y<24;y++)for(let x=28;x<36;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
  // ONE PULSE: +x photons at x=6-10, y=13-17 (5 rows — bottom row touches lump edge)
  for(let z=4;z<12;z++)for(let y=13;y<18;y++)for(let x=6;x<10;x++)
    if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,32);
  for(let t=0;t<32;t++) w._meso3i_tick();
  // surviving profile at x=52 — rows 15/16 (near edge) vs rows 13/14 (far)
  // map where the photons actually are: centroid of the beam
  let cx=0,cy=0,n=0; const rows={};
  for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if((x+y+z)&1)continue;
    let v=0;for(let c=0;c<NMOV;c++)v+=w._meso3i_phget(x,y,z,c);
    if(v){cx+=v*x;cy+=v*y;n+=v;rows[y]=(rows[y]||0)+v;}
  }
  console.log(`pd=${pd}: centroid=(${(cx/Math.max(n,1)).toFixed(1)},${(cy/Math.max(n,1)).toFixed(1)}) n=${n} rows=${JSON.stringify(rows)}`);
}
