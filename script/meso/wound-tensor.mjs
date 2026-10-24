// wound-tensor: does stored angular momentum show up as shear in the
// momentum-flux tensor Pi_xy = sum_c c_x c_y n_c?
//
// For a CCW-wound lump (Lz>0) the stored channel at a site is
// tangential, so Pi_xy ~ t_x t_y = -sin(2*theta)/2: alternating sign
// by quadrant (NE-, SE+, NW+, SW-). The moving-gas tensor of a frozen
// lump should be ~0 — the signal lives in the rest bins.
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
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');

const NCH = wasm._meso3i_nch(), NMOV = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = drest => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(drest);
};

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
const ring = sgn => {
  for (const r of [5, 4]) {
    const steps = Math.ceil(2 * Math.PI * r) + 1;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * 2 * Math.PI;
      const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
      if (((x + y + CZ) & 1) !== 0) continue;
      const c = tang(sgn * (x - CX), sgn * (y - CY));
      if (c < 0) continue;
      wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
    }
  }
};

// per-quadrant Pi_xy over moving channels and over rest bins
const tensor = () => {
  const Q = { '++': [0, 0], '+-': [0, 0], '-+': [0, 0], '--': [0, 0] };
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - CX, dy = y - CY;
    if (!dx || !dy) continue;
    const q = `${dx > 0 ? '+' : '-'}${dy > 0 ? '+' : '-'}`;
    for (let c = 0; c < NMOV; c++) {
      const p = CV[c][0] * CV[c][1];
      if (!p) continue;
      Q[q][0] += p * wasm._meso3i_get(x, y, z, c);
      Q[q][1] += p * wasm._meso3i_rget(x, y, z, c);
    }
  }
  return Q;
};

for (const sgn of [+1, -1]) {
  for (const drest of [0, 1]) {
    boot(drest); ring(sgn);
    for (let t = 0; t < 120; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
    wasm._meso3i_rg_refresh();
    const Q = tensor();
    console.log(`sgn=${sgn > 0 ? 'CCW' : 'CW'} drest=${drest}  ` +
      `rest=${wasm._meso3i_rest_mass()} flux=${wasm._meso3i_mov_mass()}`);
    for (const q of ['++', '+-', '-+', '--'])
      console.log(`   quad ${q}:  Pi_xy_mov=${String(Q[q][0]).padStart(8)}  Pi_xy_rest=${String(Q[q][1]).padStart(8)}`);
  }
}
