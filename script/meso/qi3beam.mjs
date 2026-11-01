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
const N=20, TICKS=150, rungs=[32,64,96,128];
console.log('mode      | loops  max-amp  deep(>=96)  levels>=2  absorbs');
for (const mode of ['isotropic','beam']) {
  const q = await mk();
  q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
  let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
  if(mode==='isotropic'){
    for(let i=0;i<6000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
      q._qi3_photon_set(x,y,z,c,1);q._qi3_photon_nu_set(x,y,z,c,rungs[rnd()%4]);}
  } else {
    // a beam: all photons on channel 0 (same direction) at one face
    for(let i=0;i<6000;i++){const y=rnd()%N,z=rnd()%N;
      q._qi3_photon_set(0,y,z,0,1);q._qi3_photon_nu_set(0,y,z,0,rungs[rnd()%4]);}
  }
  for(let t=0;t<TICKS;t++)q._qi3_tick();
  let loops=0,maxA=0,deep=0,lv2=0;
  for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
    if(q._qi3_level_get(x,y,z)>=2)lv2++;
    for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);
      const m=Math.min(a,b);if(m>=32){loops++;if(m>maxA)maxA=m;if(m>=96)deep++;}}}
  console.log(`${mode.padEnd(9)} | ${String(loops).padEnd(6)} ${String(maxA).padEnd(8)} ${String(deep).padEnd(10)} ${String(lv2).padEnd(9)} ${q._qi3_event(3)}`);
}
