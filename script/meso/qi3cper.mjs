// cycle period: emit from a site with a loop on ONE specific edge —
// the emitted nu should scale with the edge's reach (m*2/L^2).
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
// edges: e0=diag(1,1,0) L2=2, e4=body(1,1,1) L2=3, e6=axis(2,0,0) L2=4
for (const [tag, e] of [['diag e0 (L2=2)',0],['body e4 (L2=3)',4],['axis e6 (L2=4)',6]]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(5);
  q._qi3_mass_set(16,16,16,160);
  // two loops on this edge only (level 3) — weakest loop emits
  q._qi3_winding_set(16,16,16,2*e,256); q._qi3_winding_set(16,16,16,2*e+1,256);
  // force emission via the level-3 cascade — watch emitted photon nu
  const hist={};
  for(let t=0;t<10;t++){
    q._qi3_tick();
    for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
      for(let c=0;c<18;c++){
        const ph=q._qi3_photon_get(x,y,z,c);
        if(ph&&q._qi3_mass_get(x,y,z)===0){const nu=q._qi3_photon_nu(x,y,z,c);hist[nu]=(hist[nu]||0)+ph;}
      }
  }
  console.log(`${tag}: emitted lines ${JSON.stringify(Object.fromEntries(Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,5)))}`);
}
