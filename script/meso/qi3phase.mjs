// isolated interferometer: vacuum lattice, ONE absorber, two offer
// routes — which edge wins the lottery as the path diff sweeps?
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
for (const pm of [0, 1]) {
  const q = await mk();
  q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1); q._qi3_phase_mode(pm);
  q._qi3_mass_set(24, 20, 20, 160);
  for (let c = 0; c < 18; c++) q._qi3_winding_set(24, 20, 20, c, 60);  // level-1
  console.log(`phase_mode=${pm}:  diag-hops  wins(axis:c12/c13-edge)  wins(diag:c0/c1-edge)`);
  for (const hops of [2, 4, 6, 8]) {
    const x2 = 24 - 2*hops, y2 = 20 - 2*hops;
    // count per-edge wins: watch qConfirm on A's edges 6(c12/13) and 0(c0/1)
    let aWins=0,dWins=0;
    for (let t = 0; t < 40; t++) {
      q._qi3_photon_set(16, 20, 20, 12, 1); q._qi3_photon_nu_set(16, 20, 20, 12, 192);
      q._qi3_photon_set(x2, y2, 20, 0, 1);  q._qi3_photon_nu_set(x2, y2, 20, 0, 192);
      q._qi3_tick();
      if (q._qi3_confirm_get(24,20,20,12)) aWins++;
      if (q._qi3_confirm_get(24,20,20,0))  dWins++;
    }
    console.log(`   ${hops} hops:   axis=${aWins}   diag=${dWins}`);
  }
}
