// blackbody (E18): radiative cooling of a hot lump — the substrate's
// declared analog. Honest label: free-space emission into an open
// drained box, not cavity equilibrium. A hot lump's photon output vs
// its remaining excitation. IFRICM>0 = unconditional
// emit ~1/(4k) per quantum; IPHOT=4 makes the emit gate output photons.
// Measure photon-production rate vs parked mass as the lump cools —
// linear-in-mass (exponential) or a different law?
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = readFileSync(join(here, '../../docs/public/wasm/ember/meso3i.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename', src)
  (mod, mod.exports, require, join(here, '../../docs/public/wasm/ember'), 'meso3i.js');
const wasm = await mod.exports();
const W = 48, H = 48, D = 48, CX = 24, CY = 24, CZ = 24;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NMOV = wasm._meso3i_nch() - 1, REST = NMOV;
const run = (k, bath) => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(0);
  wasm._meso3i_fricmode(k);          // k>0 = unconditional blackbody emit
  wasm._meso3i_drest(0); wasm._meso3i_reflect(0); wasm._meso3i_phot(4);
  // hot lump: rest=128 in r<=4
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz <= 16) wasm._meso3i_set(x, y, z, REST, 128);
  }
  wasm._meso3i_rg_refresh();
  const r0 = wasm._meso3i_rest_mass();
  const series = [];
  const reseed = () => {              // ambient bath: sparse sustained flux
    if (!bath) return;
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((x + y + z) & 1) continue;
      const dx = x - CX, dy = y - CY, dz = z - CZ;
      if (dx * dx + dy * dy + dz * dz <= 16) continue;
      if ((x * 3 + y * 5 + z * 7) % 11 === 0) {
        const ch = (x + 2 * y + 3 * z) % NMOV;
        const v = wasm._meso3i_get(x, y, z, ch);
        if (v < 4) wasm._meso3i_set(x, y, z, ch, 4);
      }
    }
  };
  for (let t = 0; t < 400; t++) {
    reseed();
    wasm._meso3i_ev_reset();           // per-tick emit count = photon rate
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    if (t % 20 === 0) {
      wasm._meso3i_rg_refresh();
      series.push(`t${t}:r${wasm._meso3i_rest_mass()}`);
    }
  }
  wasm._meso3i_ev_reset();
  for (let t = 0; t < 40; t++) { reseed(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
  const rate = wasm._meso3i_ev(2) / 40;
  wasm._meso3i_rg_refresh();
  console.log(`k=${k} bath=${bath}  rest ${r0} -> ${wasm._meso3i_rest_mass()}  emit_rate=${rate.toFixed(1)}/t  [${series.join(' ')}]`);
};
console.log('E18b — cooling at earth surface: hot lump + ambient bath');
for (const k of [4, 16]) { run(k, false); run(k, true); }
