// selfloop (E54): does annihilation's photon exhaust ESCAPE or RECYCLE?
// Seed antipodal drest fuel; annih on; compare drain vs no-drain.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso_perf.js'), 'utf8');
const mod = { exports: {} };
const DRAIN = Number(process.argv[2] || 0);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(16);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(8);w._meso3i_annih(255);
// fuel: opposing moving-mass channels -> friction parks them as drest pairs
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)){ w._meso3i_set(x,y,z,0,32); w._meso3i_set(x,y,z,1,32); }
for(let t=0;t<120;t++){ if(DRAIN) w._meso3i_drain_edge(DRAIN); w._meso3i_tick(); }
console.log(`drain=${DRAIN}: ev4=${w._meso3i_ev(4)} fused=${w._meso3i_ev(7)} phn=${w._meso3i_photons()} rest=${w._meso3i_rest_mass()}`);
// E54b: lump + drain + NO feed — true radiative death or frozen remnant?
for(const anh of [0,64,255]){
  const w2 = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso_perf.js');return m.exports();})();
  w2._meso3i_init(W,H,D,1);
  w2._meso3i_collmode(0);w2._meso3i_friction(8);w2._meso3i_fricmode(16);
  w2._meso3i_fricp(128);w2._meso3i_drest(1);w2._meso3i_reflect(0);
  w2._meso3i_phot(8);w2._meso3i_annih(anh);
  for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
    if(!((x+y+z)&1)){ w2._meso3i_set(x,y,z,0,32); w2._meso3i_set(x,y,z,1,32); }
  const s=[];
  for(let t=0;t<300;t++){ w2._meso3i_drain_edge(4); w2._meso3i_tick();
    if(t%75===0) s.push(w2._meso3i_rest_mass()); }
  console.log(`annih=${anh} + drain, no feed: rest series ${s.join(' -> ')}`);
}
