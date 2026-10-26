// clock-ensemble (E8): a population clock, not a single packet.
// E4 showed a lone packet decoheres at q>=2 — but an atomic clock is
// ~10^30 ensemble events. Inject a broad slab of +x flux (thousands of
// quanta) between the mirrors: does the ENSEMBLE's signed-momentum
// oscillation survive densities that kill a single particle?
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

const W = 72, H = 20, D = 20, CY = H >> 1, CZ = D >> 1;
const MX0 = 10, MX1 = 60;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = []; let XPX = -1;
for (let c = 0; c < NMOV; c++) {
  const v = [wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)];
  CV.push(v);
  if (v[0] > 0 && v[1] === 0 && v[2] === 0) XPX = c;
}
const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0); wasm._meso3i_friction(8); wasm._meso3i_fricmode(-4);
  wasm._meso3i_fricp(128); wasm._meso3i_friccurve(0);
  wasm._meso3i_drest(0); wasm._meso3i_reflect(16);
};
const momX = () => {
  let m = 0;
  for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    for (let c = 0; c < NMOV; c++) if (CV[c][0] !== 0)
      m += CV[c][0] * wasm._meso3i_get(x, y, z, c);
  }
  return m;
};
const run = q => {
  boot();
  for (const xw of [MX0, MX1]) for (let x = xw; x < xw + 3; x++)
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
      if ((x + y + z) & 1) continue;
      wasm._meso3i_set(x, y, z, REST, 64);
    }
  if (q) for (let x = MX0 + 4; x < MX1; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, q);
  }
  // population: a broad +x slab — every parity site x in [16,26] gets flux
  let m0 = 0;
  for (let x = MX0 + 6; x <= MX0 + 16; x++) for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, XPX, 32); m0 += 32;
  }
  const flips = []; let last = 0;
  for (let t = 0; t < 400; t++) {
    wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
    const m = momX();
    if (Math.abs(m) < 40) continue;        // scaled dead zone for the population
    const s = Math.sign(m);
    if (last !== 0 && s !== last) flips.push(t);
    last = s;
  }
  const d = flips.map((t, i) => i ? t - flips[i - 1] : null).filter(Boolean);
  const T = d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN;
  console.log(`q=${String(q).padStart(2)}  flips=[${flips.slice(0, 14).join(',')}${flips.length > 14 ? '...' : ''}]  T_half=${T.toFixed(1)}t  n=${flips.length}`);
};
console.log('E8 — ensemble cavity: population oscillation vs density');
for (const q of [0, 2, 4, 6]) run(q);
