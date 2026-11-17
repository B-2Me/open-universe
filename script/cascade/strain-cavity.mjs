/* strain-cavity — does a finite committed wire have RESONANT
 * modes? (the medium's natural frequencies)
 *
 * The wire rings and reflects (strain-wave/strain-interfere), so
 * it should behave like a cavity: drive link 0 sinusoidally and
 * sweep the drive period T. A real cavity builds standing-wave
 * amplitude when T matches the round-trip time; off-resonance the
 * reflected energy cancels against the drive.
 *
 *   fluxV[0]@link0 = AMP * sin(2πt/T)   (driven boundary)
 *   measure: steady-state |flux| amplitude envelope at link MID
 *            (and LEN-1) vs T
 *
 * Expected naive round-trip: 2*LEN links ~ 2*LEN*2.3t ~ 74t at
 * vs=3. The scan maps the actual spectrum — peaks = cavity modes.
 * Control arm --free: impulse once, no drive, watch the ringdown
 * period directly.
 *
 * Usage: node script/cascade/strain-cavity.mjs
 *        [--vs=3] [--amp=1500] [--len=16] [--periods=8..64 step4]
 *        [--ticks=160] [--free]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '1500'));
const LEN = parseInt(arg('len', '16'));
const TICKS = parseInt(arg('ticks', '160'));
const FREE = process.argv.includes('--free');
const P0 = parseInt(arg('pmin', '8')), P1 = parseInt(arg('pmax', '64')), PS = parseInt(arg('pstep', '4'));
const WEAR = 64;

const wire = [];
for (let i = 0; i < LEN; i++) wire.push([8 + i, 8 + i, 16]);
const MID = LEN >> 1;

const envAt = (i) => Math.abs(q._moore26_flux_get(...wire[i], 0));

if (FREE) {
  /* ringdown: one impulse, read the natural period at MID */
  initM26(q, W, W, W);
  q._moore26_vac_pol_set(VS);
  for (const c of wire) { q._moore26_winding_set(...c, 6, WEAR); q._moore26_winding_set(...c, 7, WEAR); }
  q._moore26_fluxv_set(...wire[0], 0, AMP);
  console.log(`=== ringdown: vs=${VS} amp=${AMP} len=${LEN} — fluxV@L${MID} ===`);
  const series = [];
  for (let t = 0; t <= TICKS; t++) {
    const v = q._moore26_fluxv_get(...wire[MID], 0);
    series.push(v);
    if (t < TICKS) q._moore26_tick();
  }
  console.log(series.map((v, i) => `${i}:${v}`).join(' '));
  /* crude peak spacing */
  const peaks = [];
  for (let i = 1; i < series.length - 1; i++)
    if (series[i] > 0 && series[i] >= series[i - 1] && series[i] > series[i + 1] && series[i] > 40) peaks.push(i);
  console.log(`peaks at t=${peaks.join(',')} spacings=${peaks.slice(1).map((p, i) => p - peaks[i]).join(',')}`);
  process.exit(0);
}

console.log(`=== cavity scan: vs=${VS} amp=${AMP} len=${LEN} drive-period sweep ===`);
console.log(`  T |   amp@L${MID} (envelope, last 2/3 of run)   amp@L${LEN - 1}`);

const results = [];
for (let T = P0; T <= P1; T += PS) {
  initM26(q, W, W, W);
  q._moore26_vac_pol_set(VS);
  for (const c of wire) { q._moore26_winding_set(...c, 6, WEAR); q._moore26_winding_set(...c, 7, WEAR); }
  let aMid = 0, aEnd = 0;
  for (let t = 0; t <= TICKS; t++) {
    /* driven boundary: overwrite link0's fluxV with the drive */
    q._moore26_fluxv_set(...wire[0], 0, Math.round(AMP * Math.sin(2 * Math.PI * t / T)));
    if (t > TICKS / 3) { aMid = Math.max(aMid, envAt(MID)); aEnd = Math.max(aEnd, envAt(LEN - 1)); }
    q._moore26_tick();
  }
  results.push([T, aMid, aEnd]);
  console.log(` ${String(T).padStart(3)} |   ${String(aMid).padStart(6)}   ${String(aEnd).padStart(6)}`);
}
const best = results.reduce((a, b) => b[1] > a[1] ? b : a);
console.log(`  -> peak response at T=${best[0]} (mid amp ${best[1]})`);
