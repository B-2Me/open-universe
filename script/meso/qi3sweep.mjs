// qi3 nu-sweep: absorption response vs offer energy — is the edge
// gate sharp (matching nu absorbs, others pass) or graded?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');

for (const nu of [4, 8, 10, 20, 40, 60, 80, 120]) {
  const q = await (() => {
    const m = { exports: {} };
    new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
    return m.exports();
  })();
  q._qi3_init(32, 32, 32, 0);
  q._qi3_mass_set(16, 16, 16, 160);   // line ~ (160+w/4)/4 ≈ 40+
  // beam of 20 photons on +x at the requested nu
  for (let i = 2; i < 14; i++) {
    q._qi3_photon_set(i, 16, 16, 12, 20);
    q._qi3_photon_nu_set(i, 16, 16, 12, nu);
  }
  for (let t = 0; t < 18; t++) q._qi3_tick();
  const absorbed = Number(q._qi3_event(3));
  const charge = q._qi3_charge_get(16, 16, 16);
  const confirm12 = q._qi3_confirm_get(16, 16, 16, 13); // reverse link c13
  console.log(`nu=${String(nu).padStart(3)}  absorbed=${String(absorbed).padStart(4)}  charge=${String(charge).padStart(3)}  confirmRev=${confirm12}`);
}
