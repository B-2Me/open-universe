// qi3 stimulated emission: drive offers at the site's emission line
// through an excited site — does it clone them? (link3 failed this)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');

// charge=48 -> n=1+(48>>5)=2 -> downward gap 2->1 = 256-64 = 192.
// Drive at 192 (should STIMULATE a clone) vs 200 (no transition).
for (const nu of [192, 200]) {
  const q = await (() => {
    const m = { exports: {} };
    new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
    return m.exports();
  })();
  q._qi3_init(32, 32, 32, 0);
  q._qi3_gap_mode(1);
  q._qi3_mass_set(16, 16, 16, 160);
  q._qi3_charge_set(16, 16, 16, 48);    // excited, n=3, line 228
  for (let i = 2; i < 15; i++) {        // beam of offers at nu
    q._qi3_photon_set(i, 16, 16, 12, 30);
    q._qi3_photon_nu_set(i, 16, 16, 12, nu);
  }
  for (let t = 0; t < 18; t++) q._qi3_tick();
  console.log(`drive nu=${nu}: absorbed=${Number(q._qi3_event(3))}  ` +
    `stimulated=${Number(q._qi3_event(17))}  emitted=${Number(q._qi3_event(4))}`);
}
