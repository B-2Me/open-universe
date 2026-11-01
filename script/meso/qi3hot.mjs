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
const N=24, TICKS=200;
q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
// resonant bath
const rungs=[32,64,96,128];
for(let i=0;i<8000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,1);q._qi3_photon_nu_set(x,y,z,c,rungs[rnd()%4]);}
// HOT POCKET: high-nu photons in a 6x6x6 region at center
const c0=N>>1;
for(let i=0;i<3000;i++){
  const x=c0-3+rnd()%6,y=c0-3+rnd()%6,z=c0-3+rnd()%6,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,1);q._qi3_photon_nu_set(x,y,z,c,140+rnd()%110);}
console.log('t    | fusion  massive  massflight?  loops  absorbs emits');
for(let t=0;t<TICKS;t++){
  q._qi3_tick();
  if(t%25===0||t===TICKS-1){
    let massive=0,loops=0;
    for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
      if(q._qi3_mass_get(x,y,z))massive++;
      for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);if(Math.min(a,b)>=32)loops++;}}
    console.log(`${String(t).padEnd(4)} | ${String(q._qi3_event(23)).padEnd(7)} ${String(massive).padEnd(8)} -            ${String(loops).padEnd(6)} ${String(q._qi3_event(3)).padEnd(7)} ${q._qi3_event(4)}`);
  }
}
