// inverses (E74): iepush-in (energy captures mass) + linkcap-force (saturation delivers)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const load=async()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();};

// A. iepush-in: charged lump + mass beam — does it capture?
for (const ep of [0, -8]) {
  const w = await load();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(0);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  if(w._meso3i_iepush) w._meso3i_iepush(ep);
  // charged lump center
  for(let z=5;z<11;z++)for(let y=5;y<11;y++)for(let x=14;x<20;x++)
    if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,REST,32); w._meso3i_eset(x,y,z,200); }
  // mass beam past it
  for(let z=4;z<8;z++)for(let y=3;y<6;y++)for(let x=3;x<6;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,16);
  for(let t=0;t<40;t++){ w._meso3i_drain_edge(3); w._meso3i_tick(); }
  w._meso3i_rg_refresh();
  console.log(`iepush=${ep}: rest=${w._meso3i_rest_mass()} mov=${w._meso3i_mov_mass()} park=${w._meso3i_ev(0)}`);
}

// B. linkcap-force: mass beam hits a photon-saturated corridor —
// lc>0: bounce (refuse); lc<0: deliver anyway (force through)
for (const lc of [4, -4]) {
  const w = await load();
  const W=32,H=16,D=16;
  w._meso3i_init(W,H,D,1);
  const NMOV=w._meso3i_nch()-1,REST=NMOV;
  w._meso3i_collmode(0);w._meso3i_friction(0);w._meso3i_fricmode(4);
  w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);w._meso3i_phot(0);
  w._meso3i_linkcap(lc);
  // mass beam on +x at x=3, aimed at the photon corridor
  for(let z=6;z<10;z++)for(let y=6;y<10;y++)for(let x=3;x<5;x++)
    if(!((x+y+z)&1)) w._meso3i_set(x,y,z,12,64);
  let thru=0;
  for(let t=0;t<40;t++){
    for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=14;x<22;x++)
      if(!((x+y+z)&1)) w._meso3i_phset(x,y,z,12,32);
    w._meso3i_drain_edge(3); w._meso3i_tick();
    // count mass past the corridor this tick
    for(let z=4;z<12;z++)for(let y=4;y<12;y++)for(let x=23;x<27;x++){
      if((x+y+z)&1)continue;
      for(let c=0;c<NMOV;c++) thru+=w._meso3i_get(x,y,z,c); }
  }
  console.log(`linkcap=${lc}: thru-ticks=${thru} mov=${w._meso3i_mov_mass()} phn=${w._meso3i_photons()}`);
}
