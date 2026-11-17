/* strain-membrane — 2-D propagation: is the medium's wavefront
 * isotropic, or does it betray the lattice grain?
 *
 * All prior phonon measurements ran on 1-D {1,1,0} wires where
 * each interior link has deg=2. A committed 2-D sheet connects
 * through the in-plane edge channels {±1,±1,0} — a rotated
 * square lattice where every interior cell has deg=4.
 * Inject a point impulse at the center: the wave spreads in 2-D.
 *
 * Sheet lattice: basis a=(1,1,0), b=(1,-1,0). Cell (m,n) sits at
 *   (CX+m+n, CY+m-n, CZ)  — all even parity when CX+CY+CZ even.
 * Interior cells have 4 committed in-plane neighbors (±a, ±b).
 *
 * The question: does the ARRIVAL FRONT form a circle (isotropic
 * wave speed) or a diamond (lattice anisotropy — the FCC grain
 * leaking into the field)? We compare arrival ticks along three
 * directions: the a axis, the b axis, and the (1,0,0)-world
 * direction (a+b zigzag — the diagonal of the sheet lattice).
 *
 * Metrics: first-nonzero-flux tick vs real-space distance.
 * If the medium is isotropic, arrival vs distance matches
 * across directions after accounting for path length.
 *
 * Usage: node script/cascade/strain-membrane.mjs
 *        [--vs=3] [--amp=2000] [--half=8] [--ticks=36]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '2000'));
const HALF = parseInt(arg('half', '8'));      /* sheet half-extent in lattice steps */
const TICKS = parseInt(arg('ticks', '36'));
const CX = 32, CY = 32, CZ = 16;              /* 80 even parity */

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
/* diamond-shaped committed sheet in (m,n) coords */
const pos = (m, n) => [CX + m + n, CY + m - n, CZ];
for (let m = -HALF; m <= HALF; m++)
  for (let n = -HALF; n <= HALF; n++) {
    const c = pos(m, n);
    q._moore26_winding_set(...c, 6, 64);
    q._moore26_winding_set(...c, 7, 64);
  }
q._moore26_fluxv_set(CX, CY, CZ, 0, AMP);

/* rays in sheet coords:
 *   a-axis:  (k,0)    — real dir (1,1,0),  k steps of a
 *   b-axis:  (0,k)    — real dir (1,-1,0), k steps of b
 *   diag:    (k,k)    — real dir (2,0,0),  k a-steps + k b-steps
 * ray distance in real cells: a/b rays travel k*sqrt(2), diag 2k */
const rays = { a: [], b: [], d: [] };
const MAXK = HALF;
for (let k = 0; k <= MAXK; k++) {
  rays.a.push({ mn: [k, 0], c: pos(k, 0), dist: k * Math.SQRT2 });
  rays.b.push({ mn: [0, k], c: pos(0, k), dist: k * Math.SQRT2 });
  rays.d.push({ mn: [k, k], c: pos(k, k), dist: 2 * k });
}
const first = { a: new Array(MAXK + 1).fill(-1), b: new Array(MAXK + 1).fill(-1), d: new Array(MAXK + 1).fill(-1) };

console.log(`=== strain-membrane: vs=${VS} amp=${AMP} half=${HALF} ===`);
for (let t = 0; t <= TICKS; t++) {
  for (const r of ['a', 'b', 'd'])
    rays[r].forEach((p, k) => {
      if (first[r][k] < 0 && q._moore26_flux_get(...p.c, 0) !== 0) first[r][k] = t;
    });
  if (t < TICKS) q._moore26_tick();
}
for (const r of ['a', 'b', 'd'])
  console.log(`ray ${r}: ` + first[r].map((h, k) => `k${k}=${h}`).join(' '));

console.log(`\nisotropy — arrival vs real-space distance:`);
for (let k = 2; k <= MAXK; k += 2)
  console.log(`  dist=${rays.a[k].dist.toFixed(1).padStart(5)}: a=${String(first.a[k]).padStart(3)} b=${String(first.b[k]).padStart(3)} ` +
    `| dist=${rays.d[k].dist.toFixed(1).padStart(5)}: d=${String(first.d[k]).padStart(3)}` +
    (first.a[k] > 0 && first.d[k] > 0 ? `  ratio a/d=${(first.a[k] / first.d[k]).toFixed(2)}` : ''));
