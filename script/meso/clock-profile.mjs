// clock-profile (E3): does ambient congestion around a steady source fall
// as 1/r (diffusive, Laplace — matches GR's Phi~1/r) or 1/r^2 (ballistic)?
// A continuous central injector vs. boundary drain reaches a steady radial
// gradient; shell-averaged moving density vs r gives the exponent.
// Second probe: occupancy halo around a parked mass lump under the same
// ambient field — the profile a "clock" would actually sit inside.
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

const W = 56, H = 56, D = 56;
const CX = W >> 1, CY = H >> 1, CZ = D >> 1;
if (wasm._meso3i_init(W, H, D, 1) !== 0) throw new Error('init failed');
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = () => {
  wasm._meso3i_init(W, H, D, 1);
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_drest(0);
  wasm._meso3i_fricp(128);
  wasm._meso3i_friccurve(0);
  wasm._meso3i_reflect(0);
};

// central source: +1 quantum on every moving channel at the core each tick
const inject = () => {
  for (let c = 0; c < NMOV; c++) {
    const v = wasm._meso3i_get(CX, CY, CZ, c);
    if (v < 200) wasm._meso3i_set(CX, CY, CZ, c, v + 1);
  }
};

// shell-averaged density: mean occupancy per live site in [r, r+1)
const profile = (what) => {
  const RMAX = Math.min(CX, CY, CZ) - 4;
  const sum = new Float64Array(RMAX), cnt = new Float64Array(RMAX);
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x + y + z) & 1) continue;
    const dx = x - CX, dy = y - CY, dz = z - CZ;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const sh = Math.floor(r);
    if (sh < 1 || sh >= RMAX) continue;
    let q = 0;
    if (what === 'mov') for (let c = 0; c < NMOV; c++) q += wasm._meso3i_get(x, y, z, c);
    else q = wasm._meso3i_get(x, y, z, REST);
    sum[sh] += q; cnt[sh]++;
  }
  const rows = [];
  for (let r = 1; r < RMAX; r++)
    if (cnt[r] > 20) rows.push([r, sum[r] / cnt[r]]);
  return rows;
};

// log-log slope over r in [r0, r1] via least squares
const slope = (rows, r0, r1) => {
  const pts = rows.filter(([r, d]) => r >= r0 && r <= r1 && d > 0);
  if (pts.length < 3) return NaN;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const [r, d] of pts) {
    const lx = Math.log(r), ly = Math.log(d);
    sx += lx; sy += ly; sxy += lx * ly; sxx += lx * lx;
  }
  const n = pts.length;
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
};

const SETTLE = 600;
console.log('E3 — radial congestion profile: exponent of rho(r) ~ r^k');
console.log('    k = -2.0 ballistic rays | k = -1.0 diffusive (Laplace, GR-like)\n');

// probe A: central flux source vs boundary drain
boot();
for (let t = 0; t < SETTLE; t++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
const mov = profile('mov');
console.log('r   rho_mov/site');
for (const [r, d] of mov) console.log(`${String(r).padStart(3)} ${d.toFixed(3)}`);
for (const [r0, r1] of [[4, 12], [6, 20], [8, 24]])
  console.log(`  mov slope r[${r0}..${r1}] = ${slope(mov, r0, r1).toFixed(2)}`);

// probe B: same field but a parked mass lump instead of a bare source
boot();
for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if ((x + y + z) & 1) continue;
  const dx = x - CX, dy = y - CY, dz = z - CZ;
  if (dx * dx + dy * dy + dz * dz <= 25) wasm._meso3i_set(x, y, z, REST, 48);
}
for (let t = 0; t < SETTLE; t++) { inject(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick(); }
const movL = profile('mov');
console.log('\nlump present — mov halo outside the body (r>6):');
for (const [r0, r1] of [[7, 14], [8, 24]])
  console.log(`  mov slope r[${r0}..${r1}] = ${slope(movL, r0, r1).toFixed(2)}`);
