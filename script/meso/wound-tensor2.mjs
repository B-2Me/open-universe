// diagnose the wound-tensor result: where does the mass park, and in
// which channels? Prints per-quadrant parked mass + Lz + the per-site
// Pi_xy map on the z=CZ slice.
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

wasm._meso3i_clear();
wasm._meso3i_collmode(0);
wasm._meso3i_friction(8);
wasm._meso3i_fricmode(-4);
wasm._meso3i_lat(1);
wasm._meso3i_drest(1);

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
for (const r of [5, 4]) {
  const steps = Math.ceil(2 * Math.PI * r) + 1;
  for (let i = 0; i < steps; i++) {
    const a = i / steps * 2 * Math.PI;
    const x = Math.round(CX + r * Math.cos(a)), y = Math.round(CY + r * Math.sin(a));
    if (((x + y + CZ) & 1) !== 0) continue;
    const c = tang(x - CX, y - CY);
    if (c < 0) continue;
    wasm._meso3i_set(x, y, CZ, c, Math.min(255, wasm._meso3i_get(x, y, CZ, c) + 48));
  }
}

for (let t = 0; t < 120; t++) { wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
wasm._meso3i_rg_refresh();
console.log(`rest=${wasm._meso3i_rest_mass()} cm=(${wasm._meso3i_cm(0) / 256},${wasm._meso3i_cm(1) / 256},${wasm._meso3i_cm(2) / 256})`);

// per-quadrant parked mass, Lz, Pi_xy (rest bins), and channel census
const Q = {};
const census = {};
for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = x - CX, dy = y - CY;
  if (!dx || !dy) continue;
  const q = `${dx > 0 ? '+' : '-'}${dy > 0 ? '+' : '-'}`;
  Q[q] = Q[q] || { mass: 0, Lz: 0, Pxy: 0 };
  let rx = 0, ry = 0, tot = 0, pxy = 0;
  for (let c = 0; c < NMOV; c++) {
    const n = wasm._meso3i_rget(x, y, z, c);
    if (!n) continue;
    rx += n * CV[c][0]; ry += n * CV[c][1]; tot += n;
    pxy += n * CV[c][0] * CV[c][1];
    census[c] = (census[c] || 0) + n;
  }
  Q[q].mass += tot; Q[q].Pxy += pxy;
  Q[q].Lz += dx * ry - dy * rx;
}
for (const q of ['++', '+-', '-+', '--'])
  console.log(`quad ${q}: parked=${String(Q[q].mass).padStart(6)}  Lz=${String(Q[q].Lz).padStart(8)}  Pxy=${String(Q[q].Pxy).padStart(6)}`);
console.log('channel census (parked): ' +
  Object.entries(census).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `(${CV[c]})x${n}`).join(' '));
