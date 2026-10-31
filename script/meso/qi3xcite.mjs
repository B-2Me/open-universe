// qi3 excitation census — the 't Hooft observable: the saturated
// equilibrium IS the vacuum; structure = persistent deviations
// above it. Measures hotspots/voids vs local median, spatial
// clustering of excitations, and whether they persist.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
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
for (let t=0;t<200;t++) q._qi3_tick();   // saturate to equilibrium

const map = (f) => {
  const a=[];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const m=q._qi3_mass_get(x,y,z); if(!m)continue;
    let w=0; for(let c=0;c<18;c++)w+=q._qi3_winding_get(x,y,z,c);
    a.push({x,y,z,m,c:q._qi3_charge_get(x,y,z),w});
  }
  return a;
};
const pct = (a,k,p)=>{const s=[...a].sort((x,y)=>x[k]-y[k]);return s[Math.floor(s.length*p)][k];};

for (const T of [0, 100, 200]) {
  for(let i=0;i<T-(T===0?0:T===100?0:0);i++){} // no-op
  const L = map();
  const medM=pct(L,'m',0.5), medW=pct(L,'w',0.5), medC=pct(L,'c',0.5);
  const hot = L.filter(s=>s.w>medW*1.5), cold = L.filter(s=>s.w<medW*0.5);
  // spatial clustering: mean distance between random hotspot pairs
  let d2=0,pairs=0;
  for(let i=0;i<hot.length&&pairs<400;i+=2)for(let j=i+1;j<hot.length&&pairs<400;j+=2){
    const dx=hot[i].x-hot[j].x,dy=hot[i].y-hot[j].y,dz=hot[i].z-hot[j].z;
    d2+=dx*dx+dy*dy+dz*dz;pairs++;
  }
  const meanD2=pairs?d2/pairs:0, randD2=N*N/6;  // torus random ~N²/6
  console.log(`t=${200+T}: med(m,w,chg)=${medM},${medW},${medC}`);
  console.log(`  hotspots(w>1.5x): ${hot.length}   voids(w<0.5x): ${cold.length}`);
  console.log(`  hotspot mean-d2: ${meanD2.toFixed(1)} vs random ${randD2.toFixed(1)} ${meanD2<randD2*0.8?'-> CLUSTERED':'-> scattered'}`);
  if(hot.length)console.log(`  sample hotspot: w=${hot[0].w} m=${hot[0].m} chg=${hot[0].c} @(${hot[0].x},${hot[0].y},${hot[0].z})`);
  for(let i=0;i<100;i++)q._qi3_tick();
}
