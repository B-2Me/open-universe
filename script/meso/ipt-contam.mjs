// ipt-contam (E62): does scatter elevate iPT near matter and keep
// fusecad firing on TRAPPED photons? One burst, no feed — fusion
// should stop if the gate reads real tempo, continue if contaminated.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
const SC = Number(process.argv[2] || 0);
const w = await (()=>{const m={exports:{}};new Function('module','exports','require','__dirname','__filename',src)(m,m.exports,require,join(here,'../../docs/public/wasm/ember'),'meso3i.js');return m.exports();})();
const W=48,H=24,D=24;
w._meso3i_init(W,H,D,1);
const NMOV=w._meso3i_nch()-1,REST=NMOV;
w._meso3i_collmode(0);w._meso3i_friction(8);w._meso3i_fricmode(4);
w._meso3i_fricp(128);w._meso3i_drest(1);w._meso3i_reflect(0);
w._meso3i_phot(9); w._meso3i_fusecad(4);
if(w._meso3i_scatter) w._meso3i_scatter(SC);
// lump
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=16;x<32;x++)
  if(!((x+y+z)&1)) w._meso3i_set(x,y,z,REST,64);
// ONE photon burst into the lump at t=0, then nothing
for(let z=8;z<16;z++)for(let y=8;y<16;y++)for(let x=10;x<14;x++)
  if(!((x+y+z)&1)) w._meso3i_phset_nu(x,y,z,12,1,16);
w._meso3i_ev_reset();
let last=0;
for(let t=0;t<200;t++){
  w._meso3i_drain_edge(4); w._meso3i_tick();
  if((t+1)%50===0){const f=Number(w._meso3i_ev(7));console.log(`t${t}: fused+${f-last} phn=${w._meso3i_photons()}`);last=f;}
}
