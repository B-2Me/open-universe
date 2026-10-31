// qi3 quadratic-well sweep: does the E_n = 256/n^2 level candidate
// produce a CONVERGING absorption series (Rydberg-family)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');

// expected ground->n gaps for E0=256: n=2..8
const expected = [192, 228, 240, 246, 249, 251, 252];
const controls = [8, 40, 100, 150, 200, 220, 250, 255];
for (const nu of [...expected, ...controls]) {
  const q = await (() => {
    const m = { exports: {} };
    new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
    return m.exports();
  })();
  q._qi3_init(32, 32, 32, 0);
  q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);
  for (let i = 2; i < 14; i++) {
    q._qi3_photon_set(i, 16, 16, 12, 20);
    q._qi3_photon_nu_set(i, 16, 16, 12, nu);
  }
  for (let t = 0; t < 18; t++) q._qi3_tick();
  const abs = Number(q._qi3_event(3));
  const hit = expected.includes(nu) ? 'LINE ' : 'ctrl  ';
  console.log(`${hit} nu=${String(nu).padStart(3)}  absorbed=${String(abs).padStart(4)}`);
}
