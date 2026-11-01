// hole-flow probe: do mobile holes drift directionally?
// Set up a winding gradient — over-wound slab vs under-wound —
// and watch the void centroid move.
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
const siteW=(x,y,z)=>{let w=0;for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);return w;};
const med=1028;
// PERTURB: over-wind the x<8 region (a "charged reservoir")
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<8;x++)
  if(q._qi3_mass_get(x,y,z))
    for(let c=0;c<18;c++)q._qi3_winding_set(x,y,z,c,q._qi3_winding_get(x,y,z,c)+60);
const centroid=()=>{
  let sx=0,n=0;
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    if(q._qi3_mass_get(x,y,z)&&siteW(x,y,z)<med*0.5){sx+=x;n++;}
  return n?sx/n:0;
};
console.log('t    void-centroid-x   (reservoir at x<8)');
for(let T=0;T<=200;T+=25){
  console.log(`${String(T).padStart(3)}   ${centroid().toFixed(2)}`);
  for(let i=0;i<25;i++)q._qi3_tick();
}
