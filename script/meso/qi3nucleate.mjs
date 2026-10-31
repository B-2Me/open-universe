// qi3 controlled-bath nucleation ensemble: set the initial state
// (uniform photon density rho, fixed nu), run restarts, measure
// ignition fraction — a nucleation-probability curve.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const mk = () => (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();

const N = 32, RESTARTS = 6, TICKS = 120;
// controlled initial state: exactly rho photons per JUNCTION cell
// (even-parity sites — where they can land), fixed count + nu.
console.log('rho/site  nu   ignited  frac');
for (const [rho, nu] of [[0.01,200],[0.03,200],[0.05,200],[0.08,200],[0.05,150],[0.05,240]]) {
  let ign = 0;
  for (let r = 0; r < RESTARTS; r++) {
    const q = await mk();
    q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1);
    let rng = 1000 + r * 7919;
    const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff);
    const nj = Math.round(rho * N * N * N / 2);
    for (let i = 0; i < nj; i++) {
      // even-parity site (junction): pick x+y+z even
      let x, y, z;
      do { x=rnd()%N; y=rnd()%N; z=rnd()%N; } while ((x+y+z)&1);
      const c = rnd()%18;
      q._qi3_photon_set(x,y,z,c, 20); q._qi3_photon_nu_set(x,y,z,c, nu);
    }
    for (let t = 0; t < TICKS; t++) q._qi3_tick();
    // ignited if mass persists (lumps nucleated & self-sustained)
    let lumps = 0;
    for (let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)
      if (q._qi3_mass_get(x,y,z)) lumps++;
    if (lumps > N*N) ign++;   // ignition = widespread persistence
  }
  console.log(`${rho}      ${nu}   ${ign}/${RESTARTS}    ${(ign/RESTARTS).toFixed(2)}`);
}
