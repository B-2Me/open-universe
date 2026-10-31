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
const N = 32;
for (const shift of [0, 1, 2, 4]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5); q._qi3_gap_scale(shift);
  let rng = 555;
  const rnd = () => (rng = (rng*1103515245+12345)&0x7fffffff);
  for (let i=0;i<30000;i++){
    const x=rnd()%N,y=rnd()%N,z=rnd()%N,c=rnd()%N<18?rnd()%18:0;
    q._qi3_photon_set(x,y,z,c,20+rnd()%40); q._qi3_photon_nu_set(x,y,z,c,150+rnd()%100);
  }
  console.log(`shift=${shift} (nu/2^${shift}):`);
  for (let t=0;t<=400;t+=100){
    let lumps=0,mass=0,wind=0,bonds=0;
    for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const m=q._qi3_mass_get(x,y,z);if(!m)continue;
      lumps++;mass+=m;for(let c=0;c<18;c++)wind+=q._qi3_winding_get(x,y,z,c);
      for(let e=0;e<9;e++)if(q._qi3_session_state(x,y,z,e*2)===2)bonds++;
    }
    console.log(`  t=${String(t).padStart(3)}  lumps=${lumps}  mass=${mass}  wind=${wind}  bonds=${bonds}  photons=${Number(q._qi3_photon_count())}`);
    for(let i=0;i<100;i++)q._qi3_tick();
  }
}
