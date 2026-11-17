/* strain-stub — side-cavity filter: does a dead-end branch off a
 * thru wire notch the transmission?
 *
 * strain-split showed a deg=3 junction splits evenly between two
 * long arms. Replace arm B with a SHORT dead-end stub: energy
 * still enters it (deg=3 at the junction), rings inside, and
 * leaks back out — the stub is a resonant side-cavity. If it
 * stores strain, the thru arm should carry LESS than the deg=2
 * baseline while the stub rings, then recover as it empties.
 *
 * Geometry: incident (8+i,8+i,16) i=0..7 -> J(16,16,16)
 *           thru arm  (17+i,17+i,16) i=0..7   (deg=2 interior)
 *           stub      (17+i,15-i,16) i=0..SLEN-1 (dead end)
 *
 * Metrics: thru-arm peak |flux| (vs the arms=1 baseline ~5242),
 *          stub peak, stub energy persistence (Sigma f^2 over the
 *          stub vs tick — cavity storage), thru-arm late
 *          recovery.
 *
 * Usage: node script/cascade/strain-stub.mjs
 *        [--vs=3] [--amp=2000] [--slen=4] [--ticks=60]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '2000'));
const SLEN = parseInt(arg('slen', '4'));
const TICKS = parseInt(arg('ticks', '60'));
const WEAR = 64;

const inc = [], armA = [], stub = [];
for (let i = 0; i < 8; i++) inc.push([8 + i, 8 + i, 16]);
const J = [16, 16, 16];
for (let i = 0; i < 8; i++) armA.push([17 + i, 17 + i, 16]);
for (let i = 0; i < SLEN; i++) stub.push([17 + i, 15 - i, 16]);
const commit = (c) => { q._moore26_winding_set(...c, 6, WEAR); q._moore26_winding_set(...c, 7, WEAR); };

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
for (const c of inc) commit(c);
commit(J);
for (const c of armA) commit(c);
if (SLEN > 0) for (const c of stub) commit(c);

q._moore26_fluxv_set(...inc[0], 0, AMP);
const flux = (c) => q._moore26_flux_get(...c, 0);
const E = (cells) => cells.reduce((s, c) => { const f = flux(c); return s + f * f; }, 0);

console.log(`=== strain-stub: vs=${VS} amp=${AMP} slen=${SLEN} ===`);
console.log(`   t | thru armA(0..3)      | stub(0..${SLEN - 1})`.padEnd(40) +
  `| E_A        E_stub`);
let peakA = 0, peakS = 0;
for (let t = 0; t <= TICKS; t++) {
  const ra = armA.slice(0, 4).map(c => flux(c));
  const rs = stub.map(c => flux(c));
  const ea = E(armA), es = E(stub);
  if (t % 4 === 0 || (t >= 16 && t <= 30))
    console.log(`  ${String(t).padStart(3)} |` +
      ra.map(v => String(v).padStart(6)).join('') + ` |` +
      rs.map(v => String(v).padStart(6)).join('') +
      ` |` + [ea, es].map(v => String(v).padStart(9)).join(''));
  const pa = Math.max(...armA.map(c => Math.abs(flux(c))));
  const ps = stub.length ? Math.max(...stub.map(c => Math.abs(flux(c)))) : 0;
  if (pa > peakA) peakA = pa;
  if (ps > peakS) peakS = ps;
  if (t < TICKS) q._moore26_tick();
}
console.log(`\npeak |flux|: armA=${peakA} (no-stub baseline ~5242)  stub=${peakS}`);
