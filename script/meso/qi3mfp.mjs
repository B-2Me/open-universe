import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIR = join(process.cwd(), 'docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
const N=24, rungs=[32,64,96,128];
// build a medium with a DENSE core and sparse periphery, then
// measure photon survival: inject resonant photons at edge, count
// how many survive N hops through dense vs sparse regions.
// Proxy for MFP: how far photons travel before transacting.
for (const region of ['sparse','dense']) {
  const q = await mk();
  q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
  let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
  if(region==='dense'){
    // pre-wind a core: heavy winding on all edges of center sites
    for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)for(let dz=-3;dz<=3;dz++){
      const x=N/2+dx,y=N/2+dy,z=N/2+dz;
      for(let e=0;e<9;e++){q._qi3_winding_set(x,y,z,2*e,120);q._qi3_winding_set(x,y,z,2*e+1,120);
        q._qi3_mass_set(x,y,z,200);}
    }
  }
  // inject resonant photons at x=0, measure how far they get
  for(let i=0;i<4000;i++){const y=rnd()%N,z=rnd()%N,c=rnd()%18;
    q._qi3_photon_set(0,y,z,c,1);q._qi3_photon_nu_set(0,y,z,c,rungs[rnd()%4]);}
  const penetration={};
  for(let t=0;t<80;t++){
    q._qi3_tick();
    // count photons by x-slice
    for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
      for(let c=0;c<18;c++){if(q._qi3_photon_get(x,y,z,c))penetration[x]=(penetration[x]||0)+1;}}
  }
  const dists=Object.entries(penetration).map(([x,n])=>`${x}:${n}`).join(' ');
  console.log(`${region.padEnd(6)} | absorbs=${q._qi3_event(3)} photons left=${q._qi3_photon_count()}`);
  console.log(`  photon distribution by x: ${dists.slice(0,200)}`);
}
