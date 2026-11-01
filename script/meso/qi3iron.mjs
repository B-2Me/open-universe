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
const N=24;
q._qi3_init(N,N,N,0); q._qi3_gap_mode(1); q._qi3_cycle_shift(4);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
for(let i=0;i<15000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,10+rnd()%30);q._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);}
for(let t=0;t<150;t++)q._qi3_tick();
// census: loop amplitude histogram + occupancy by edge-class
const edgeClass=[1,2,2,2,3,3,2,2,4];  // 9 edges, L2 classes
const byClass={1:[0,0],2:[0,0],3:[0,0],4:[0,0]}; // [count, totWinding]
const amplitudes={};
let loops=0;
for(let si=0;si<N*N*N;si++){
  for(let e=0;e<9;e++){
    const a=q._qi3_winding_get(Math.floor(si%N),Math.floor(si/N)%N,Math.floor(si/(N*N)),2*e);
    const b=q._qi3_winding_get(Math.floor(si%N),Math.floor(si/N)%N,Math.floor(si/(N*N)),2*e+1);
    const m=Math.min(a,b);
    if(m>=32){loops++;const cls=edgeClass[e];byClass[cls][0]++;byClass[cls][1]+=m;
      amplitudes[m]=(amplitudes[m]||0)+1;}
  }
}
console.log('total loops:',loops);
for(const cls of [1,2,3,4])
  console.log(` edge L2=${cls}: ${byClass[cls][0]} loops, mean amp ${byClass[cls][0]?(byClass[cls][1]/byClass[cls][0]).toFixed(0):0}`);
const sorted=Object.entries(amplitudes).sort((a,b)=>b[1]-a[1]).slice(0,12);
console.log('top amplitudes (amp:count):',sorted.map(([a,c])=>`${a}:${c}`).join('  '));
