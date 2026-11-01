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
const N=16, TICKS=80;
console.log('nu   | absorbs  remaining');
for (const nu of [16,32,48,64,80,96,112,128,160,192,224,256]) {
  const q = await mk();
  q._qi3_init(N,N,N,0); q._qi3_gap_mode(6); q._qi3_cycle_shift(4);
  let rng=555;const rnd=()=>(rng=(rng*1103515245+12345)&0x7fffffff);
  for(let i=0;i<4000;i++){const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%18;
    q._qi3_photon_set(x,y,z,c,1);q._qi3_photon_nu_set(x,y,z,c,nu);}
  for(let t=0;t<TICKS;t++)q._qi3_tick();
  console.log(`${String(nu).padEnd(4)} | ${String(q._qi3_event(3)).padEnd(8)} ${q._qi3_photon_count()}`);
}
