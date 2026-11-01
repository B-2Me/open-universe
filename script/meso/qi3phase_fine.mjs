// fine interferometer sweep: diag hops 2..10, pm 0 vs 1 — map the
// actual fringe shape instead of assuming it.
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
const N = 32, T = 200;
console.log('hops | pm0 axis diag | pm1 axis diag | pm1 diag-share');
for (const hops of [2,3,4,5,6,7,8,9,10]) {
  const row = [];
  for (const pm of [0, 1]) {
    const q = await mk();
    q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1); q._qi3_phase_mode(pm);
    q._qi3_mass_set(24, 20, 20, 160);
    for (let c = 0; c < 18; c++) q._qi3_winding_set(24, 20, 20, c, 60);
    const x2 = 24 - 2*hops, y2 = 20 - 2*hops;
    const s0a = q._qi3_session_strength(24,20,20,12);
    const s0d = q._qi3_session_strength(24,20,20,0);
    for (let t = 0; t < T; t++) {
      q._qi3_photon_set(16, 20, 20, 12, 1); q._qi3_photon_nu_set(16, 20, 20, 12, 192);
      q._qi3_photon_set(x2, y2, 20, 0, 1);  q._qi3_photon_nu_set(x2, y2, 20, 0, 192);
      q._qi3_tick();
    }
    row.push(q._qi3_session_strength(24,20,20,12)-s0a,
             q._qi3_session_strength(24,20,20,0)-s0d);
  }
  const share = row[3]/(row[2]+row[3]+1e-9);
  console.log(`${hops}   | ${row[0]}    ${row[1]}   | ${row[2]}    ${row[3]}   | ${share.toFixed(2)}`);
}
