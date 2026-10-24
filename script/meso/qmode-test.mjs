// qmode-test: Track B Milestone 1 — can the Q-register preserve a
// wound state? Inject the standard circulation ring, enable IQMODE
// condensation, and track Lz(t) + Q totals over 200 ticks.
//
//   Lz = Σ_sites (r × p)·ẑ   where p = Σ_c n_c·CV[c]
//
// Q is a scalar register — it can hold mass but (in principle) no
// direction. The measured question is whether the momentum-selective
// capture (antipodal pairs only) filters thermal noise in a way that
// changes the circulation decay curve.
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

const W = 72, H = 72, D = 36;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
};
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

// canonical vortex seed — same as ⌖ tool / photon-test
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
const ring = () => {
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
  return placed;
};

// Lz about the lattice center: Σ (dx*p_y − dy*p_x) over moving channels
const lz = () => {
  let L = 0, flux = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let px = 0, py = 0, f = 0;
    for (let c = 0; c < NMOV; c++) {
      const n = wasm._meso3i_get(x, y, z, c);
      if (!n) continue;
      px += n * CV[c][0]; py += n * CV[c][1]; f += n;
    }
    if (!f) continue;
    L += (x - CX) * py - (y - CY) * px;
    flux += f;
  }
  return [L, flux];
};
const qtot = () => {
  let q = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    q += wasm._meso3i_qget(x, y, z);
  return q;
};
const tick = () => { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); };

console.log('mode |   t |      Lz |  flux | Lz/flux |     Q |  rest');
for (const [mode, cap] of [[0, 0], [1, 0], [2, 0], [2, 8], [5, 8]]) {
  boot();
  wasm._meso3i_qmode(mode);
  wasm._meso3i_qcap(cap);
  ring();
  let L0 = 0;
  for (let t = 0; t <= 200; t++) {
    if (t % 20 === 0) {
      const [L, F] = lz();
      if (t === 0) L0 = L;
      wasm._meso3i_rg_refresh();
      const ratio = F ? (L / F).toFixed(2) : '—';
      console.log(`q${mode}${cap ? '+c' + cap : ''}  | ${String(t).padStart(3)} | ${String(L).padStart(7)} | ${String(F).padStart(5)} | ${String(ratio).padStart(7)} | ${String(qtot()).padStart(5)} | ${wasm._meso3i_rest_mass()}`);
    }
    tick();
  }
}
