// regsweep (E113): regime-matched — each mechanic in its own regime.
// Cap mechanics under saturation; mscat under dense photon flux.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const load=async()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();};

// A) saturation regime: dense mass feed fills channels — cap mechanics fire?
for(const [tag,fl] of [['sat-base',{}],['massbnc=1',{massbnc:1}],['photbnc=1',{photbnc:1}],['both',{massbnc:1,photbnc:1}]]){
  const w=await load(); const W=24,H=12,D=12;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  for(const [f,v] of Object.entries(fl)) if(w['_meso3i_'+f])w['_meso3i_'+f](v);
  w._meso3i_ev_reset();
  for(let t=0;t<150;t++){
    // dense mass+photon rain — channels fill to cap
    for(let z=2;z<10;z++)for(let y=2;y<10;y++)for(let x=2;x<22;x++)
      if(!((x+y+z)&1)){ for(let c=0;c<NMOV;c++){w._meso3i_set(x,y,z,c,200);w._meso3i_phset(x,y,z,c,200);} }
    w._meso3i_tick();
  }
  w._meso3i_rg_refresh();
  console.log(`${tag}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} phn=${w._meso3i_photons()} bnc=${w._meso3i_ev(6)} ovf=${w._meso3i_ev(9)}`);
}
// B) mscat scaling: does the push scale with photon density?
for(const [tag,bath] of [['mscat-low',8],['mscat-high',48]]){
  const w=await load(); const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1); const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  w._meso3i_mscat(16);
  // mass beam +x at y=8, photon wall at x=20-24
  for(let z=4;z<12;z++)for(let y=6;y<10;y++)for(let x=4;x<8;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,64);
  w._meso3i_ev_reset();
  for(let t=0;t<60;t++){
    for(let z=4;z<12;z++)for(let y=2;y<14;y++)for(let x=20;x<24;x++)
      if(!((x+y+z)&1)) for(let c=0;c<NMOV;c++) w._meso3i_phset(x,y,z,c,bath);
    w._meso3i_tick();
  }
  // beam centroid y — deflected by the photon wall?
  let cy=0,n=0;for(let z=0;z<D;z++)for(let y=0;y<H;y++)for(let x=26;x<32;x++){
    if((x+y+z)&1)continue;for(let c=0;c<NMOV;c++){const v=w._meso3i_get(x,y,z,c);cy+=v*y;n+=v;}}
  console.log(`${tag}: beam past wall y-centroid=${(cy/Math.max(n,1)).toFixed(2)} (seed y=7.5) n=${n}`);
}
