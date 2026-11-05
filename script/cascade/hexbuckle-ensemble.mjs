/* hexbuckle-ensemble — the flexoelectric response curve.
 *
 * The engine is deterministic given identical initial state, so the
 * ensemble jitters the probe microstate per run (source column offset
 * + count) — the experimental-noise analog, not a fake RNG reseed.
 *
 * Scenarios: flat control (sub-threshold 11-node tube) + dip sweep.
 * Telemetry: chpol (charge dipole, Σ(x-c0)·charge) at t=TICKS.
 *
 * Usage: node script/cascade/hexbuckle-ensemble.mjs [--n=20]
 *        [--ticks=100] [--w=128] [--dips=8,16,24,32,40,48] [--out=path]
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const ROOT = resolve(HERE, '../..');
const arg = (k, d) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};

const gluePath = resolve(ROOT, 'docs/public/wasm/cascade/moore26.js');
if (!existsSync(gluePath)) { console.error(`wasm glue not found — run src/build.sh`); process.exit(1); }
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname', '__filename',
  readFileSync(gluePath, 'utf8'))(mod, mod.exports, createRequire(gluePath), dirname(gluePath), gluePath);
const M = await mod.exports();

const W = parseInt(arg('w', '128')), TICKS = parseInt(arg('ticks', '100'));
const N = parseInt(arg('n', '20')), PROBE = 80;
const DIPS = arg('dips', '8,16,24,32,40,48').split(',').map(Number);
const c0 = W >> 1;

const pickChan = (dx, dy) => {
  /* edges only — faces/corners are dead registers under FCC */
  let best = 6, bs = -1;
  for (let c = 6; c < 18; c++) {
    const vx = M._moore26_cvc(c, 0), vy = M._moore26_cvc(c, 1);
    const s = vx * dx + vy * dy;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
};

const seedFlat = () => {
  /* FCC fix: channels 0/1 are the ±x FACE pair — a dead register
   * skeleton under the transport gate. The flat string runs the
   * {1,1,0} diagonal on edge pair 6/7 instead. */
  for (let i = -5; i <= 5; i++) {             // 11 nodes < 12 threshold
    M._moore26_winding_set(c0 + i, c0 + 16 + i, c0, 6, 128);
    M._moore26_winding_set(c0 + i, c0 + 16 + i, c0, 7, 128);
  }
  M._moore26_mass_set(c0 - 5, c0 + 11, c0, 512);
  M._moore26_mass_set(c0 + 5, c0 + 21, c0, 512);
};

const seedU = (D) => {
  const A = W / 8;
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.02)
    pts.push([Math.round(c0 + A * (2 * t - 1)),
              Math.round(c0 - D / 2 + D * (4 * t * (1 - t))), c0]);
  M._moore26_mass_set(pts[0][0], pts[0][1], c0, 512);
  M._moore26_mass_set(pts[pts.length - 1][0], pts[pts.length - 1][1], c0, 512);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y, z] = pts[i], [nx, ny] = pts[i + 1];
    const c = pickChan(nx - x, ny - y);
    M._moore26_winding_set(x, y, z, c, 128);
    M._moore26_winding_set(x, y, z, c ^ 1, 128);
  }
};

const chpol = () => {
  let p = 0;
  for (let z = 0; z < W; z++) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++)
    p += (x - c0) * M._moore26_charge_get(x, y, z);
  return p;
};

/* per-run jittered probe — source column shifted +-2, count 6..10.
 * Returns {chpol, brk} — brk counts string-breaks so the analysis can
 * split induced-polarization runs (brk==0) from fragment transport. */
/* axes=all: convergent 26-spoke bombardment — each channel sources at
 * radius R back along its own vector, so all 26 Moore axes stream at
 * the target isotropically. axes=1: the legacy single-channel (−y)
 * beam — keeps continuity with the flat/dip8/dip16 rows. */
const AXES = arg('axes', 'all');
const run = (seedFn) => {
  M._moore26_init(W, W, W);
  seedFn();
  const jit = (Math.random() * 4 | 0) - 2;
  for (let t = 1; t <= TICKS; t++) {
    if (t <= PROBE) {
      const cnt = 6 + (Math.random() * 4 | 0);
      if (AXES === '1') {
        /* single-direction probe under the FCC gate: −y is a face
         * channel (dead register) — ride the four edge diagonals
         * carrying −y instead ({±1,−1,0},{0,−1,±1}). */
        for (let c = 6; c < 18; c++) {
          if (M._moore26_cvc(c, 1) >= 0) continue;
          for (let x = c0 - 3 + jit; x <= c0 + 3 + jit; x++) {
            M._moore26_photon_set(x, c0 + 36, c0, c, cnt);
            M._moore26_photon_nu_set(x, c0 + 36, c0, c, 128);
          }
        }
      } else {
        for (let c = 6; c < 18; c++) {        /* edge channels only */
          if (c >= 18) break;
          const vx = M._moore26_cvc(c, 0), vy = M._moore26_cvc(c, 1), vz = M._moore26_cvc(c, 2);
          const sx = c0 - 36 * vx + jit, sy = c0 - 36 * vy + jit, sz = c0 - 36 * vz;
          M._moore26_photon_set(sx, sy, sz, c, cnt);
          M._moore26_photon_nu_set(sx, sy, sz, c, 128);
        }
      }
    }
    M._moore26_tick();
  }
  return { chpol: chpol(), brk: M._moore26_events(6) };
};

const stats = (a) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  return { mean: +m.toFixed(1), sd: +sd.toFixed(1), n: a.length };
};

const results = [];
const sweep = [
  { label: 'flat', fn: seedFlat },
  ...DIPS.map(d => ({ label: `dip${d}`, d, fn: () => seedU(d) })),
];
console.log(`hexbuckle ensemble: ${W}^3, t=${TICKS}, N=${N}/scen, probe=80 jit, axes=${AXES}`);
for (const sc of sweep) {
  const runs = [];
  const t0 = Date.now();
  for (let r = 0; r < N; r++) {
    runs.push(run(sc.fn));
    if (r % 10 === 9) process.stdout.write(`  ${sc.label} ${r + 1}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  const vals = runs.map(r => r.chpol);
  const clean = runs.filter(r => r.brk === 0).map(r => r.chpol);
  const broke = runs.filter(r => r.brk > 0).map(r => r.chpol);
  const all = stats(vals);
  const c = clean.length ? stats(clean) : { mean: 0, sd: 0, n: 0 };
  results.push({ scen: sc.label, dip: sc.d ?? 0, ...all, cleanN: clean.length,
                 cleanMean: c.mean, cleanSd: c.sd, vals, brks: runs.map(r => r.brk) });
  console.log(`${sc.label.padEnd(6)} all=${all.mean}±${all.sd}  ` +
              `brk==0(n=${clean.length}): ${c.mean}±${c.sd}` +
              (broke.length ? `  brk(n=${broke.length})` : ''));
}
const out = arg('out', resolve(ROOT, `results/cascade/hexbuckle-ensemble.json`));
try { writeFileSync(out, JSON.stringify({ W, TICKS, N, axes: AXES, results }, null, 2)); console.log(`wrote ${out}`); }
catch (e) { console.log(`(no results dir — stats above)`) }
