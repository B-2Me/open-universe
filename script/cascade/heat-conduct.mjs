/* heat-conduct — substrate thermodynamics: conduction calibration.
 *
 * A hot block in cold vacuum under qHeatFlow (the conduction shift:
 * every unordered Moore pair swaps (ha-hb)>>shift per tick — an
 * antisymmetric discrete Laplacian, exactly conserved).
 *
 * Measures:
 *   CONSERVATION: Sigma_heat deficit must equal ev44 (the sub-grid
 *     drain — conduction itself must move heat, never mint/lose it).
 *   DIFFUSIVITY: the heat profile's second moment sigma^2(t) grows
 *     linearly — slope = 2*D_eff per dimension (discrete heat eq).
 *   FOURIER SHAPE: the profile should look diffusive (Gaussian-ish),
 *     not ballistic — peak decays as t^-3/2 in 3-D.
 *
 * Controls: vac_rate=0 (no re-emission), no mass/fields — pure heat.
 * The h>>7 local drain (ev44) stays on: it IS the substrate's
 * entropy export, so we subtract it rather than fight it.
 *
 * Usage: node script/cascade/heat-conduct.mjs [--flow=6] [--ticks=40]
 *        [--sweep]  (runs flow=4,5,6,7 + flow=0 control)
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64, TICKS = parseInt(arg('ticks', '40'));
const C = 32;  /* hot block center */

const run = (flow, quiet) => {
  initM26(q, W, W, W);
  q._moore26_vac_rate_set(0);
  q._moore26_heat_flow_set(flow);
  for (let x = C - 2; x < C + 2; x++) for (let y = C - 2; y < C + 2; y++) for (let z = C - 2; z < C + 2; z++)
    q._moore26_heat_set(x, y, z, 60000);
  const hsum = () => { let s = 0; for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) for (let z = 0; z < W; z++) s += q._moore26_heat_get(x, y, z); return s; };
  const h0 = hsum();
  /* 1-D marginal profile along x through the center — the second
   * moment of this is the diffusivity estimator */
  const sigma2 = () => {
    let s = 0, m = 0, m2 = 0;
    for (let x = 0; x < W; x++) {
      let col = 0;
      for (let y = C - 1; y <= C + 1; y++) for (let z = C - 1; z <= C + 1; z++) col += q._moore26_heat_get(x, y, z);
      s += col; m += col * x; m2 += col * x * x;
    }
    const mean = m / s; return m2 / s - mean * mean;
  };
  const s2 = [];
  for (let t = 0; t <= TICKS; t++) {
    s2.push(sigma2());
    if (t < TICKS) q._moore26_tick();
  }
  /* diffusivity: least-squares slope of sigma^2 over the linear
   * regime (skip the first transient ticks) */
  const a = 4, b = s2.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let t = a; t < b; t++) { sx += t; sy += s2[t]; sxx += t * t; sxy += t * s2[t]; }
  const n = b - a, slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const D = slope / 2;
  const deficit = h0 - hsum(), drain = q._moore26_events(44);
  if (!quiet) {
    console.log(`flow=${flow}: h0=${h0} final=${hsum()} deficit=${deficit} drain(ev44)=${drain} ` +
      `conserved=${Math.abs(deficit - drain) <= 40} D=${D.toFixed(2)} cells^2/t s2(t)=` +
      s2.filter((_, i) => i % 10 === 0).map(v => v.toFixed(1)).join(','));
  }
  return { flow, deficit, drain, D, s2, conserved: Math.abs(deficit - drain) <= 40 };
};

if (process.argv.includes('--sweep')) {
  console.log(`=== heat-conduct sweep: hot block 4^3@60000, ${TICKS}t — diffusivity + conservation ===`);
  for (const f of [4, 5, 6, 7, 0]) run(f, false);
} else {
  run(parseInt(arg('flow', '6')), false);
}
