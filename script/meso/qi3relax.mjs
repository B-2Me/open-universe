// relaxation spectrum: perturb the equilibrium — zero a slab's
// winding — does the medium re-find the SAME attractor (med~1028,
// ~29% voids) or a different one?
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N = 32;
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5);
let rng = 555;
const rnd = () => (rng = (rng*1103515245+12345)&0x7fffffff);
for (let i=0;i<30000;i++){
  const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,20+rnd()%40); q._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);
}
for (let t=0;t<200;t++) q._qi3_tick();
const med = () => {
  const ws=[];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)){let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);ws.push(w);}
  ws.sort((a,b)=>a-b);return ws[ws.length>>1];
};
const voids = (m) => {
  let v=0;
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)){let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);if(w<m*0.5)v++;}
  return v;
};
console.log(`equil: med=${med()} voids=${voids(1028)}`);
// PERTURB: zero the winding in the z<16 half of the lattice
for(let z=0;z<16;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
  if(q._qi3_mass_get(x,y,z))for(let c=0;c<18;c++)q._qi3_winding_set(x,y,z,c,0);
console.log(`after slab-zero: med=${med()} voids=${voids(1028)}`);
for (let T=0;T<=400;T+=50){
  console.log(`t=${T}: med=${med()} voids=${voids(1028)}`);
  for(let i=0;i<50;i++)q._qi3_tick();
}
