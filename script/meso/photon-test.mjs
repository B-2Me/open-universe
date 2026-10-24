// photon-test: does the new IPHOT field remove parked mass?
//   phase A — inject a circulation ring, let it thermalize into a
//             parked rest-mass fossil (the loom-meso result)
//   phase B — shine a +x photon beam through it in each IPHOT mode and
//             watch the rest-mass ledger
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
const h8 = () => new Uint8Array(wasm.wasmMemory.buffer);

const W = 72, H = 72, D = 36;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
wasm._meso3i_collmode(0);
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
const tick = n => { for (let i = 0; i < n; i++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); } };
const led = () => {
  wasm._meso3i_rg_refresh();   // rest/flux stats live in the pack pass
  return `rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()} γ=${wasm._meso3i_photons()}`;
};

// --- phase A: cast the ring fossil --------------------------------------
const tang = (dx, dy) => {
  const l = Math.hypot(dx, dy) || 1, tx = -dy / l, ty = dx / l;
  let best = -1, bd = -Infinity;
  for (let c = 0; c < NMOV; c++) {
    if (CV[c][2] !== 0) continue;
    const dot = CV[c][0] * tx + CV[c][1] * ty;
    if (dot > bd) { bd = dot; best = c; }
  }
  return best;
};
let placed = 0;
for (const r of [5, 4]) {
  const steps = Math.ceil(2 * Math.PI * r) + 1;
  for (let i = 0; i < steps; i++) {
    const a = i / steps * 2 * Math.PI;
    const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
    if (((x + y + CZ) & 1) !== 0) continue;
    const c = tang(x - CX, y - CY);
    if (c < 0) continue;
    wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
    placed++;
  }
}
console.log(`ring injected on ${placed} cells · t0 ${led()}`);
tick(50);
console.log(`t50 (thermalized): ${led()}`);

// radial profile of the fossil
const prof = () => {
  const b = new Map();
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = wasm._meso3i_get(x, y, z, REST);
    if (!r) continue;
    const d = Math.round(Math.hypot(x - CX, y - CY, z - CZ));
    b.set(d, (b.get(d) || 0) + r);
  }
  return [...b.entries()].sort((a, c) => a[0] - c[0]).map(([d, v]) => `r${d}:${v}`).join(' ');
};
console.log(`  fossil profile: ${prof()}`);
wasm._meso3i_save();          // the fossil, once — restore per mode

// --- phase B: photon beam at each mode -----------------------------------
const cBeam = CV.findIndex(v => v[0] === 2 && v[1] === 0 && v[2] === 0);
const BX = ((4 + CY + CZ) & 1) === 0 ? 4 : 5;
const shine = n => {
  for (let i = 0; i < n; i++) {
    wasm._meso3i_phset(BX, CY, CZ, cBeam, 16);
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
  }
};

for (const mode of [0, 1, 2]) {
  wasm._meso3i_restore();                 // fresh fossil every time
  wasm._meso3i_phot(mode);
  wasm._meso3i_rg_refresh();
  const before = wasm._meso3i_rest_mass();
  shine(150);
  wasm._meso3i_rg_refresh();
  const after = wasm._meso3i_rest_mass();
  const names = ['off', 'catalyst', 'stimulated'];
  console.log(`IPHOT=${mode} (${names[mode]}): 150 ticks of laser — ` +
    `rest ${before} -> ${after} (${before ? ((after / before) * 100).toFixed(1) + '% left' : 'n/a'}) · ${led()}`);
  const cmx = wasm._meso3i_cm(0) / 256;
  console.log(`  rest centroid x=${cmx.toFixed(2)} (lump center ${CX}) · profile: ${prof()}`);
  // directionality of the emitted mass: sum channel-12 (+x axial) occupancy
  let bx = 0;
  for (let x = BX + 2; x < W - 3; x += 2) bx += wasm._meso3i_get(x, CY, CZ, cBeam);
  console.log(`  mass still on beam channel +x: ${bx}`);
}
