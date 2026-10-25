// morphology-drift: M50-C showed drift direction is morphology-dependent,
// not flag-determined — seeded uniform sphere marches TOWARD source under
// IREFL=32 (lit-face accretion), M49's grown remnant went AWAY (far-rim
// deposition). This probes the morphology axis between those endpoints.
//
// Fixed R5 parity-site geometry, vary interior density (same shape, only
// occupancy/site changes), plus a hollow-shell variant (dense rim, thin
// core — mass-matched to Q48) and the grown-remnant endpoint (canonical
// M36/M49 replay: 18-spoke drive 200t -> carrier-gated freeze 400t).
// Each variant under IREFL {0,32}, +x beam 800t. Drift = rest centroid.
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

const W = 44, H = 44, D = 44;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = refl => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(128);
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(refl);
};

const seedSphere = q => {
  let m = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    if (dx * dx + dy * dy + dz * dz > 25) continue;
    wasm._meso3i_set(x, y, z, REST, q); m += q;
  }
  return m;
};

const seedShell = () => {   // dense rim r 4..5 @96, thin core r<=3 @8
  let m = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > 25) continue;
    const q = r2 <= 9 ? 8 : 96;
    wasm._meso3i_set(x, y, z, REST, q); m += q;
  }
  return m;
};

// canonical spoke: sign=0 all-18 drive, sign=±1 beam (vx*sign>0 only)
const spoke = sign => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    if (sign && vx * sign <= 0) continue;
    const sx = CX - 3 * vx, sy = CY - 3 * vy, sz = CZ - 3 * vz;
    for (let u = 0; u < 4; u++)
      wasm._meso3i_set(sx, sy, sz, c, wasm._meso3i_get(sx, sy, sz, c) + 1);
  }
};

const snap = () => { wasm._meso3i_rg_refresh();
  return [wasm._meso3i_cm(0) / 256, wasm._meso3i_rest_mass()]; };

const SETTLE = 60, BEAM_T = 800;
const run = (tag, seedFn, driveT, quietT, refl) => {
  boot(refl);
  wasm._meso3i_ev_reset();
  const m0 = seedFn();
  let cS = CX, rEnd = 0;
  const beamAt = driveT + quietT;
  for (let t = 0; t <= beamAt + BEAM_T; t++) {
    if (t < driveT) spoke(0);                              // convergent drive (grown only)
    else if (t >= beamAt) spoke(1);                        // +x beam
    wasm._meso3i_drain_edge(3);
    wasm._meso3i_tick();
    if (t === beamAt || t === beamAt + BEAM_T) {
      const [cxr, rst] = snap(); cS = cxr; rEnd = rst;
    }
  }
  const d = cS - CX;
  console.log(`  ${tag.padEnd(22)} seed=${String(m0).padStart(6)} end_rest=${String(rEnd).padStart(6)}` +
    `  drift=${d >= 0 ? '+' : ''}${d.toFixed(3)}  park=${wasm._meso3i_ev(0)} refl=${wasm._meso3i_ev(6)}`);
};

console.log('morphology axis — fixed R5 geometry, +x beam 800t, drift vs IREFL');
for (const refl of [0, 32]) {
  console.log(`\n-- IREFL=${refl} --`);
  run(`uniform Q16`, () => seedSphere(16), 0, SETTLE, refl);
  run(`uniform Q32`, () => seedSphere(32), 0, SETTLE, refl);
  run(`uniform Q48`, () => seedSphere(48), 0, SETTLE, refl);
  run(`uniform Q96`, () => seedSphere(96), 0, SETTLE, refl);
  run(`shell rim96/core8`, seedShell, 0, SETTLE, refl);
  run(`grown remnant`, () => 0, 200, 400, refl);   // M36 replay: drive 200, freeze 400
}
