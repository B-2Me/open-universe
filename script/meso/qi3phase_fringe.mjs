// interferometer v6 — REAL phase sweep: axis fixed 4 hops (phase 0),
// diag transit swept 4..8 hops (phase 0,192,128,64,0 for nu=192).
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
const N = 32, T = 300;
console.log('transit | pm0 a d | pm1 a d | diag-phase | pm1 d-share');
for (let dh = 4; dh <= 8; dh++) {
  const row = [];
  for (const pm of [0, 1]) {
    const q = await mk();
    q._qi3_init(N, N, N, 0); q._qi3_gap_mode(1); q._qi3_phase_mode(pm);
    q._qi3_mass_set(24, 20, 20, 160);
    const x2 = 24 - dh, y2 = 20 - dh;   // diag: dh hops on c0
    for (let t = 0; t < T; t++) {
      q._qi3_photon_set(16, 20, 20, 12, 1); q._qi3_photon_nu_set(16, 20, 20, 12, 192);
      q._qi3_photon_set(x2, y2, 20, 0, 1);  q._qi3_photon_nu_set(x2, y2, 20, 0, 192);
      q._qi3_tick();
    }
    row.push(q._qi3_win_edge(24,20,20,12), q._qi3_win_edge(24,20,20,0));
  }
  const ph = (192 * dh) % 256;
  const share = row[3]/(row[2]+row[3]+1e-9);
  console.log(`${dh}       | ${row[0]} ${row[1]}   | ${row[2]} ${row[3]}   | ${String(ph).padStart(3)}        | ${share.toFixed(2)}`);
}
