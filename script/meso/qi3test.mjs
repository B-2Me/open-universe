// qi3 first-mechanics test: offers hit a lump, verify selective
// absorption at the edge's line + confirmations arm.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIR = join(here, '../../docs/public/wasm/ember');
const src = readFileSync(join(DIR, 'qi3.js'), 'utf8');
const qi3 = await (() => {
  const m = { exports: {} };
  new Function('module','exports','require','__dirname','__filename',src)(m, m.exports, require, DIR, 'qi3.js');
  return m.exports();
})();
qi3._qi3_init(32, 32, 32, 0);

// lump: massive site at center (mass 160 → line = (160+w/4)/4 ≈ 40)
qi3._qi3_mass_set(16, 16, 16, 160);
qi3._qi3_charge_set(16, 16, 16, 0);

// fire a photon beam on +x channel (12) toward the lump, nu=40 (matches line)
for (let i = 2; i < 14; i++) {
  qi3._qi3_photon_set(i, 16, 16, 12, 40);
  qi3._qi3_photon_nu_set(i, 16, 16, 12, 40);
}
// second beam: nu=8 (does NOT divide by line 40 — should pass through)
for (let i = 2; i < 14; i++) {
  qi3._qi3_photon_set(i, 20, 16, 12, 40);
  qi3._qi3_photon_nu_set(i, 20, 16, 12, 8);
}

for (let t = 0; t < 20; t++) qi3._qi3_tick();

console.log('--- qi3 first mechanics ---');
console.log('absorbed (ev3):', Number(qi3._qi3_event(3)));
console.log('recoil   (ev16):', Number(qi3._qi3_event(16)));
console.log('emitted  (ev4):', Number(qi3._qi3_event(4)));
console.log('transit  (ev7):', Number(qi3._qi3_event(7)));
console.log('lump charge:', qi3._qi3_charge_get(16, 16, 16));
console.log('lump winding c12:', qi3._qi3_winding_get(16, 16, 16, 12));
// where did the nu=8 beam go? check downstream of lump path (row 20 passes beside it)
let past = 0;
for (let i = 18; i < 28; i++) past += qi3._qi3_photon_get(i, 20, 16, 12);
console.log('nu=8 photons still streaming past lump (row 20):', past);
console.log('total photons:', Number(qi3._qi3_photon_count()));
