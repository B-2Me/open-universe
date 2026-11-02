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
const N=20;
console.log('nu   | massive-frac  loops   (transition shape)');
for (const nu of [112,120,124,128,132,136,144,160]) {
  const q = await mk();
  q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
  let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
  for(let i=0;i<5000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
    q._qi3_photon_set(x,y,z,c,10);q._qi3_photon_nu_set(x,y,z,c,nu);}
  for(let t=0;t<250;t++)q._qi3_tick();
  let massive=0,loops=0;
  for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
    if(q._qi3_mass_get(x,y,z))massive++;
    for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);if(Math.min(a,b)>=32)loops++;}}
  console.log(`${String(nu).padEnd(4)} | ${(massive/(N*N*N)).toFixed(2)}          ${loops}`);
}
