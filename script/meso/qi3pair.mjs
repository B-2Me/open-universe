// qi3 bound pair: two lumps transacting under the gated pass —
// does exchange bond them (gap traffic + session + correlation)?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');

const q = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
q._qi3_init(40, 40, 40, 0);
q._qi3_gap_mode(1);
// two charged lumps 8 cells apart on x — facing channel c12 (+x)/c13 (-x)
q._qi3_mass_set(16, 20, 20, 160); q._qi3_charge_set(16, 20, 20, 96);
q._qi3_mass_set(24, 20, 20, 160); q._qi3_charge_set(24, 20, 20, 96);

console.log('t    gapFlux  sessAB  sessBA  chargeA chargeB  stim');
for (let t = 0; t <= 60; t += 10) {
  let gap = 0;
  for (let x = 17; x < 24; x++)
    gap += q._qi3_photon_get(x, 20, 20, 12) + q._qi3_photon_get(x, 20, 20, 13);
  console.log(`${String(t).padStart(2)}   ${String(gap).padStart(5)}     ${q._qi3_session_strength(16,20,20,12)}      ${q._qi3_session_strength(24,20,20,13)}      ${q._qi3_charge_get(16,20,20)}      ${q._qi3_charge_get(24,20,20)}     ${Number(q._qi3_event(17))}`);
  for (let i = 0; i < 10; i++) q._qi3_tick();
}
