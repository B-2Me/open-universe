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
const N=24, TICKS=300, rungs=[32,64,96,128];
q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
for(let i=0;i<8000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,8);q._qi3_photon_nu_set(x,y,z,c,rungs[rnd()%4]);}
const c0=N>>1;
for(let i=0;i<3000;i++){const x=c0-3+rnd()%6,y=c0-3+rnd()%6,z=c0-3+rnd()%6,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,20);q._qi3_photon_nu_set(x,y,z,c,140+rnd()%110);}
console.log('t    | fusion  massive  loops   loops-near-mass');
for(let t=0;t<TICKS;t++){
  q._qi3_tick();
  if(t%50===0||t===TICKS-1){
    let massive=0,loops=0,near=0;const ms=[];
    for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
      if(q._qi3_mass_get(x,y,z)){massive++;ms.push({x,y,z});}
      for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);if(Math.min(a,b)>=32)loops++;}}
    for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
      let hasLoop=false;for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);if(Math.min(a,b)>=32)hasLoop=true;}
      if(hasLoop)for(const m of ms){if(Math.abs(x-m.x)+Math.abs(y-m.y)+Math.abs(z-m.z)<=4){near++;break;}}}
    console.log(`${String(t).padEnd(4)} | ${String(q._qi3_event(23)).padEnd(7)} ${String(massive).padEnd(8)} ${String(loops).padEnd(7)} ${near}`);
  }
}
