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
// opposing photons on axis channels 12(+x)/13(-x) converging at (16,16,16)
q._qi3_photon_set(14, 16, 16, 12, 100); q._qi3_photon_nu_set(14, 16, 16, 12, 200);
q._qi3_photon_set(18, 16, 16, 13, 100); q._qi3_photon_nu_set(18, 16, 16, 13, 200);
for (let t = 0; t < 3; t++) q._qi3_tick();
let m=0,c=0,w=0;
for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  m+=q._qi3_mass_get(x,y,z);c+=q._qi3_charge_get(x,y,z);
  for(let ch=0;ch<18;ch++)w+=q._qi3_winding_get(x,y,z,ch);
}
console.log(`fusion: mass=${m} charge=${c} winding=${w}  Ein=80000`);
console.log(`fusion events (ev23): ${Number(q._qi3_event(23))}`);
