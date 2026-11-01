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
for(let t=0;t<TICKS;t++)q._qi3_tick();

// ratios: amps, edge-classes, winding/level, species balance
let amp64=0,amp128=0,other=0,loops=0;
const ec=[1,2,2,2,3,3,2,2,4];const cls={1:0,2:0,3:0,4:0};
let sitesWith=0;let windingIn=0,levelsIn=0;
for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
  let sc=0;for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);
    const m=Math.min(a,b);if(m>=32){loops++;sc++;cls[ec[e]]++;
      if(m>=120)amp128++;else if(m>=56&&m<80)amp64++;else other++;}
    windingIn+=m;}
  if(sc){sitesWith++;levelsIn+=q._qi3_level_get(x,y,z);}}
console.log('=== DIMENSIONLESS RATIOS (new regime) ===');
console.log('amp ratio 64:128:',amp64,':',amp128,'=',(amp64/Math.max(amp128,1)).toFixed(2));
console.log('edge-class ratio (L2=2 / others):',cls[2],'/',(cls[1]+cls[3]+cls[4]),'=',(cls[2]/Math.max(cls[1]+cls[3]+cls[4],1)).toFixed(2));
console.log('edge-class total:',JSON.stringify(cls));
console.log('loops/site-with-loops:',(loops/Math.max(sitesWith,1)).toFixed(2),'(parallel edges?)');
console.log('winding/level on structured sites:',(windingIn/Math.max(levelsIn,1)).toFixed(0),'(the quantum per level)');
console.log('absorb:emit ratio:',q._qi3_event(3),':',q._qi3_event(4));
console.log('fraction edges-occupied:',(loops/(N*N*N*9)).toFixed(4));
