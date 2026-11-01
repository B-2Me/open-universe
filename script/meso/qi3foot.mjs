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
const N=20, TICKS=150, rungs=[32,64,96,128];
q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
// multi-mode beam aimed at x=0 face center, all +x-ish channels
const cY=N>>1, cZ=N>>1;
for(let i=0;i<6000;i++){
  const y=cY-2+rnd()%5, z=cZ-2+rnd()%5, c=rnd()%18;
  q._qi3_photon_set(0,y,z,c,1);q._qi3_photon_nu_set(0,y,z,c,rungs[rnd()%4]);}
for(let t=0;t<TICKS;t++)q._qi3_tick();
// where did loops form? map loops by x-slice
const xslices={};
for(let si=0;si<N*N*N;si++){const x=si%N,y=Math.floor(si/N)%N,z=Math.floor(si/(N*N));
  for(let e=0;e<9;e++){const a=q._qi3_winding_get(x,y,z,2*e),b=q._qi3_winding_get(x,y,z,2*e+1);
    if(Math.min(a,b)>=32)xslices[x]=(xslices[x]||0)+1;}}
console.log('loops by x-slice (beam enters at x=0):');
for(let x=0;x<N;x++)console.log(`  x=${String(x).padEnd(2)}: ${xslices[x]||0} ${'#'.repeat(Math.floor((xslices[x]||0)/3))}`);
console.log('absorbs:',q._qi3_event(3),' photons:',q._qi3_photon_count());
