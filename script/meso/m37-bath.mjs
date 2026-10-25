// m37-bath: M37 in the ambient-bath regime. Carrier-gated lumps
// (fricm<0, inert in true vacuum) sit in an isotropic flux bath fed
// from the boundary shell — no central source. Each lump blocks the
// bath flux heading for the other: mutual shadowing, if it exists,
// shows here without any drive-centric infall.
//
// Bath: every tick, sites on the inward-facing shell (4 from each
// face) receive quanta on channels pointing into the box.
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
const NCH = wasm._meso3i_nch(), NMOV = NCH - 1, REST = NCH - 1;
const CV = [];
for (let c = 0; c < NMOV; c++)
  CV.push([wasm._meso3i_cvc(c, 0), wasm._meso3i_cvc(c, 1), wasm._meso3i_cvc(c, 2)]);

const boot = () => {
  wasm._meso3i_clear();
  wasm._meso3i_collmode(0);
  wasm._meso3i_friction(8);
  wasm._meso3i_fricmode(-4);     // carrier-gated: inert without bath
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(0);
};
const lump = (lx, R = 3, Q = 64) => {
  for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy + dz * dz > R * R) continue;
    const x = lx + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1) continue;
    wasm._meso3i_set(x, y, z, REST, Q);
  }
};
// isotropic bath: shell at depth 4 gets flux on inward channels
const SH = 4;
const bath = () => {
  for (let z = SH; z < D - SH; z++) for (let y = SH; y < H - SH; y++) {
    for (const c of range(0, NMOV)) {
      const [vx, vy, vz] = CV[c];
      if (vx > 0) wasm._meso3i_set(SH, y, z, c, wasm._meso3i_get(SH, y, z, c) + 1);
      if (vx < 0) wasm._meso3i_set(W - 1 - SH, y, z, c, wasm._meso3i_get(W - 1 - SH, y, z, c) + 1);
    }
  }
  for (let z = SH; z < D - SH; z++) for (let x = SH; x < W - SH; x++) {
    for (let c = 0; c < NMOV; c++) {
      const [vx, vy] = [CV[c][0], CV[c][1]];
      if (vy > 0) wasm._meso3i_set(x, SH, z, c, wasm._meso3i_get(x, SH, z, c) + 1);
      if (vy < 0) wasm._meso3i_set(x, H - 1 - SH, z, c, wasm._meso3i_get(x, H - 1 - SH, z, c) + 1);
    }
  }
  for (let y = SH; y < H - SH; y++) for (let x = SH; x < W - SH; x++) {
    for (let c = 0; c < NMOV; c++) {
      if (CV[c][2] > 0) wasm._meso3i_set(x, y, SH, c, wasm._meso3i_get(x, y, SH, c) + 1);
      if (CV[c][2] < 0) wasm._meso3i_set(x, y, D - 1 - SH, c, wasm._meso3i_get(x, y, D - 1 - SH, c) + 1);
    }
  }
};
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

const cmx = (x0, x1) => {
  let m = 0, sx = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
    const r = wasm._meso3i_get(x, y, z, REST);
    m += r; sx += r * x;
  }
  return m > 50 ? sx / m : NaN;
};

const T = 800, STEP = 50, WARM = 100;
const run = (seedL, seedR) => {
  boot();
  if (seedL != null) lump(seedL);
  if (seedR != null) lump(seedR);
  const ts = [], ls = [], rs = [];
  for (let t = 0; t <= T; t++) {
    if (t % STEP === 0) { ts.push(t); ls.push(cmx(0, CX)); rs.push(cmx(CX, W)); }
    bath(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  const slope = ys => {
    const pts = ts.map((t, i) => [t, ys[i]]).filter(([t, y]) => t > WARM && !isNaN(y));
    if (pts.length < 3) return NaN;
    const mt = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let num = 0, den = 0;
    for (const [t, y] of pts) { num += (t - mt) * (y - my); den += (t - mt) ** 2; }
    return num / den;
  };
  return { vl: slope(ls), vr: slope(rs) };
};

console.log(' sep  gap |  v_L(pair)  v_R(pair) |  v_L0      v_R0   | close_pair close_base  mutual');
for (const sep of [8, 10, 12, 16, 20]) {
  const h = sep >> 1;
  const p = run(CX - h, CX + h);
  const l = run(CX - h, null);
  const r = run(null, CX + h);
  const cp = p.vl - p.vr, cb = l.vl - r.vr;
  console.log(` ${String(sep).padStart(3)} ${String(sep - 6).padStart(4)} | ` +
    `${p.vl.toFixed(5).padStart(10)} ${p.vr.toFixed(5).padStart(10)} | ` +
    `${l.vl.toFixed(5).padStart(10)} ${r.vr.toFixed(5).padStart(10)} | ` +
    `${cp.toFixed(6).padStart(10)} ${cb.toFixed(6).padStart(10)} ${(cp - cb).toFixed(6).padStart(9)}`);
}
