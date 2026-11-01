// pair-product behavior: do fused pairs SEPARATE, conserve
// momentum, and RE-ANNIHILATE? Track massFlight after fusion.
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
// two opposing high-nu photons on the axis converging at (16,16,16)
q._qi3_photon_set(14, 16, 16, 12, 50); q._qi3_photon_nu_set(14, 16, 16, 12, 200);
q._qi3_photon_set(18, 16, 16, 13, 50); q._qi3_photon_nu_set(18, 16, 16, 13, 200);
console.log('t   mass@site  flightX+  flightX-  photons');
for (let t = 0; t <= 16; t += 4) {
  let m = q._qi3_mass_get(16,16,16);
  // mass flight on channels 12/13 = mass moving +x / -x
  let fp=0,fm=0;
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    // massFlight isn't exported directly — use mass on edges as proxy
    if(q._qi3_mass_get(x,y,z)>50){fp+=(x>16?1:0);fm+=(x<16?1:0);}
  }
  console.log(`${String(t).padStart(2)}   ${m}          ${fp}         ${fm}         ${Number(q._qi3_photon_count())}`);
  for(let i=0;i<4;i++)q._qi3_tick();
}
