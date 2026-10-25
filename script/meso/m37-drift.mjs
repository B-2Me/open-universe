// m37-drift: the radiation-shadow force curve. Two R3 cold lumps at
// +-sep/2 on the equator under the 18-spoke drive; each lump shadows
// the other's inner flank from carrier flux, so mutual ablation is
// asymmetric -> drift. Track each lump's rest-mass centroid and extract
// the closing velocity vs separation.
//
// Controls: each position measured solo — the centered drive is
// asymmetric off-axis, so a lone lump already drifts. Mutual
// attraction = pair closing rate - baseline closing rate.
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
  wasm._meso3i_fricmode(-4);
  wasm._meso3i_lat(1);
  wasm._meso3i_drest(0);          // canonical scalar rest — the M37 config
};
const lump = lx => {
  let n = 0;
  for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dy * dy + dz * dz > 9) continue;
    const x = lx + dx, y = CY + dy, z = CZ + dz;
    if ((x + y + z) & 1 || x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) continue;
    wasm._meso3i_set(x, y, z, REST, 64);
    n++;
  }
  return n;
};
const drive = () => {
  for (let c = 0; c < NMOV; c++) {
    const [vx, vy, vz] = CV[c];
    wasm._meso3i_set(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c,
      wasm._meso3i_get(CX - 3 * vx, CY - 3 * vy, CZ - 3 * vz, c) + 4);
  }
};
// rest-mass centroid x within x in [x0,x1)
const cmx = (x0, x1) => {
  let m = 0, sx = 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
    const r = wasm._meso3i_get(x, y, z, REST);
    if (!r) continue;
    m += r; sx += r * x;
  }
  return m > 50 ? sx / m : NaN;   // lump gone -> NaN
};

const T = 800, STEP = 50, WARM = 150;   // fit slope over t>WARM
const run = (seedL, seedR) => {
  boot();
  if (seedL != null) lump(seedL);
  if (seedR != null) lump(seedR);
  const ts = [], ls = [], rs = [];
  for (let t = 0; t <= T; t++) {
    if (t % STEP === 0) { ts.push(t); ls.push(cmx(0, CX)); rs.push(cmx(CX, W)); }
    drive(); wasm._meso3i_drain_edge(3); wasm._meso3i_tick();
  }
  const slope = ys => {
    const pts = ts.map((t, i) => [t, ys[i]]).filter(([t, y]) => t > WARM && !isNaN(y));
    const n = pts.length; if (n < 3) return NaN;
    const mt = pts.reduce((a, p) => a + p[0], 0) / n;
    const my = pts.reduce((a, p) => a + p[1], 0) / n;
    let num = 0, den = 0;
    for (const [t, y] of pts) { num += (t - mt) * (y - my); den += (t - mt) ** 2; }
    return num / den;
  };
  return { vl: slope(ls), vr: slope(rs), lEnd: ls[ls.length - 1], rEnd: rs[rs.length - 1] };
};

console.log(' sep  gap |   v_L(pair)  v_R(pair) | close_pair |   v_L0     v_R0  | close_base |  v_mutual');
const rows = [];
for (const sep of [8, 10, 12, 16, 20]) {
  const h = sep >> 1;
  const p = run(CX - h, CX + h);
  const l = run(CX - h, null);
  const r = run(null, CX + h);
  const cp = p.vl - p.vr, cb = l.vl - r.vr;
  rows.push({ sep, gap: sep - 6, cp, cb, vm: cp - cb });
  console.log(` ${String(sep).padStart(3)} ${String(sep - 6).padStart(4)} | ` +
    `${p.vl.toFixed(5).padStart(10)} ${p.vr.toFixed(5).padStart(10)} | ${cp.toFixed(5).padStart(10)} | ` +
    `${l.vl.toFixed(5).padStart(10)} ${r.vr.toFixed(5).padStart(10)} | ${cb.toFixed(5).padStart(10)} | ` +
    `${(cp - cb).toFixed(5).padStart(9)}`);
}
console.log('\nfit attempts on v_mutual(gap):');
const g = rows.map(r => r.gap), v = rows.map(r => r.vm);
// 1/r: v = a/g ; exp: v = a*exp(-g/lam)
const fit1 = g.reduce((a, gi, i) => a + v[i] / gi, 0) / g.reduce((a, gi) => a + 1 / gi ** 2, 0);
console.log('  v = a/gap: a=' + fit1.toFixed(6) + '  pred ' + g.map(gi => (fit1 / gi).toFixed(5)).join(' '));
const lsum = g.map((gi, i) => [gi, Math.log(Math.max(v[i], 1e-9))]);
const m_ = lsum.reduce((a, p) => a + p[0], 0) / lsum.length;
const ly = lsum.reduce((a, p) => a + p[1], 0) / lsum.length;
const b_ = lsum.reduce((a, p) => a + (p[0] - m_) * (p[1] - ly), 0) / lsum.reduce((a, p) => a + (p[0] - m_) ** 2, 0);
console.log(`  v = a*exp(-gap/lam): lam=${(-1 / b_).toFixed(2)} a=${Math.exp(ly - b_ * m_).toFixed(6)}  pred ` +
  g.map(gi => (Math.exp(ly - b_ * m_) * Math.exp(b_ * gi)).toFixed(5)).join(' '));
