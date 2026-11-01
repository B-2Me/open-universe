// cycle census: which of the 9 edges carry loops in the medium?
// and the loop quantum distribution — 128 (one quantum) or higher?
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
const N = 32;
q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
let rng = 555;
const rnd = () => (rng = (rng*1103515245+12345)&0x7fffffff);
for (let i=0;i<30000;i++){
  const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
  q._qi3_photon_set(x,y,z,c,20+rnd()%40); q._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);
}
for (let t=0;t<200;t++) q._qi3_tick();
// census: per-edge loop counts + matched-winding histogram
const edgeLoops = new Array(9).fill(0), mHist = {};
let totalLoops = 0;
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  if(!q._qi3_mass_get(x,y,z))continue;
  for(let e=0;e<9;e++){
    const a=q._qi3_winding_get(x,y,z,2*e), b=q._qi3_winding_get(x,y,z,2*e+1);
    const m=a<b?a:b;
    if(m>=128){edgeLoops[e]++;totalLoops++;}
    if(m>0)mHist[m>256?'>256':String(m)]=(mHist[m>256?'>256':String(m)]||0)+1;
  }
}
console.log('loops per edge (e0..e8):');
for(let e=0;e<9;e++)console.log(`  e${e}: ${edgeLoops[e]}`);
console.log(`total loops: ${totalLoops}`);
console.log('matched-winding histogram (top):', JSON.stringify(Object.fromEntries(Object.entries(mHist).sort((a,b)=>b[1]-a[1]).slice(0,8))));
