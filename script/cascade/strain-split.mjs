/* strain-split — Y-junction: does the polarization wave SPLIT at
 * a committed-wire branch?
 *
 * strain-wave showed a 1-D committed wire carries a discrete wave:
 *   fluxV += (Σ_committed_nbrs flux - deg*flux) >> vs
 * A straight wire interior has deg=2. Put a THIRD committed
 * neighbor on the junction link (deg=3): the Laplacian changes,
 * the wave should partially reflect and split its transmission
 * between the two outgoing arms — an impedance-mismatched
 * beam splitter.
 *
 * Geometry (all even-parity conduit cells, edge-adjacent):
 *   incident arm:  (8+i,8+i,16)   i=0..7   {1,1,0} direction
 *   junction:      (16,16,16)               deg=3
 *   arm A (thru):  (17+i,17+i,16) i=0..7   continues {1,1,0}
 *   arm B (branch):(17+i,15-i,16) i=0..7   turns onto {1,-1,0}
 *
 * Metrics: peak |flux| on each arm (split ratio), reflected pulse
 * on the incident arm (flux swings sign opposite the incident
 * packet), Σflux^2 energy audit.
 * Arms: --arms=2 (Y), --arms=1 (stub-less straight thru, deg=2
 * control — junction has only arm A), --arms=0 (bare wire).
 *
 * Usage: node script/cascade/strain-split.mjs
 *        [--vs=3] [--amp=2000] [--ticks=48] [--wear=64]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '2000'));
const TICKS = parseInt(arg('ticks', '48'));
const WEAR = parseInt(arg('wear', '64'));
const ARMS = parseInt(arg('arms', '2'));

const inc = [], armA = [], armB = [];
for (let i = 0; i < 8; i++) inc.push([8 + i, 8 + i, 16]);
const J = [16, 16, 16];
for (let i = 0; i < 8; i++) {
  armA.push([17 + i, 17 + i, 16]);
  armB.push([17 + i, 15 - i, 16]);
}
const commit = (c) => {
  q._moore26_winding_set(...c, 6, WEAR);
  q._moore26_winding_set(...c, 7, WEAR);
};

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
for (const c of inc) commit(c);
commit(J);
if (ARMS >= 1) for (const c of armA) commit(c);
if (ARMS >= 2) for (const c of armB) commit(c);

/* impulse on incident link 0 */
q._moore26_fluxv_set(...inc[0], 0, AMP);

const flux = (c) => q._moore26_flux_get(...c, 0);
const peak = (cells) => {
  let p = 0;
  for (const c of cells) { const f = Math.abs(flux(c)); if (f > p) p = f; }
  return p;
};
const E = (cells) => cells.reduce((s, c) => { const f = flux(c); return s + f * f; }, 0);

console.log(`=== strain-split: vs=${VS} amp=${AMP} arms=${ARMS} ===`);
console.log(`   t |  inc(3..7)        J |  armA(0..3)      |  armB(0..3)      |  E_inc      E_J      E_A      E_B`);
let peakA = 0, peakB = 0, minInc = 0;
for (let t = 0; t <= TICKS; t++) {
  const ri = inc.slice(3).map(c => flux(c)), fj = flux(J);
  const ra = armA.slice(0, 4).map(c => flux(c));
  const rb = ARMS >= 2 ? armB.slice(0, 4).map(c => flux(c)) : [0, 0, 0, 0];
  const ei = E(inc), ej = flux(J) * flux(J), ea = ARMS >= 1 ? E(armA) : 0, eb = ARMS >= 2 ? E(armB) : 0;
  if (t % 4 === 0 || t <= 20)
    console.log(`  ${String(t).padStart(3)} |` +
      ri.map(v => String(v).padStart(6)).join('') + ` |` + String(fj).padStart(7) +
      ` |` + ra.map(v => String(v).padStart(6)).join('') +
      ` |` + rb.map(v => String(v).padStart(6)).join('') +
      ` |` + [ei, ej, ea, eb].map(v => String(v).padStart(8)).join(''));
  const pa = peak(armA), pb = ARMS >= 2 ? peak(armB) : 0;
  if (pa > peakA) peakA = pa;
  if (pb > peakB) peakB = pb;
  const mi = Math.min(...inc.slice(3).map(c => flux(c)));
  if (t > 10 && mi < minInc) minInc = mi;   /* reflected sign-flip */
  if (t < TICKS) q._moore26_tick();
}
console.log(`\npeak |flux|: armA=${peakA}  armB=${peakB}  ` +
  (ARMS >= 2 ? `split A/(A+B)=${(peakA / (peakA + peakB) || 0).toFixed(3)}` : ''));
console.log(`most-negative incident-arm flux after t>10: ${minInc}  ` +
  `(reflected sign-flip; 0 = no visible reflection)`);
