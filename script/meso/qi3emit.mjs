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
const N=24, TICKS=250;
q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
const rungs=[32,64,96,128];
for(let i=0;i<12000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,1);q._qi3_photon_nu_set(x,y,z,c,rungs[rnd()%4]);}
// collect emitted photon nu over the run
const emitNu={};
for(let t=0;t<TICKS;t++){
  q._qi3_tick();
  for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
    for(let c=0;c<18;c++){const p=q._qi3_photon_get(x,y,z,c);if(p){const nu=q._qi3_photon_nu(x,y,z,c);emitNu[nu]=(emitNu[nu]||0)+1;}}}
}
const top=Object.entries(emitNu).sort((a,b)=>b[1]-a[1]).slice(0,14);
console.log('emitted nu histogram (nu:count):');
console.log(top.map(([n,c])=>`  ${n}:${c}`).join(''));
console.log('photons:',q._qi3_photon_count(),' absorbs:',q._qi3_event(3),' emits:',q._qi3_event(4));
