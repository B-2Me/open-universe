/* strain-interfere — the decisive wave test: do two strain
 * pulses SUPERPOSE and pass through each other?
 *
 * One committed {1,1,0} wire, one pulse injected at each end.
 * Three arms:
 *   same  : +AMP at both ends  -> constructive crossing at center
 *   anti  : +AMP left, -AMP right -> destructive crossing at
 *          center, then the pulses should REAPPEAR past it
 *          (linear superposition, not annihilation)
 *   lone  : +AMP left only     -> the control pulse
 *
 * If the medium's wave is linear, the anti run shows the center
 * going quiet at the crossing tick then re-ringing — destructive
 * interference is transient, not absorption. Energy trace
 * (Σ|fluxV| + Σ|flux| over the wire) tells whether anything
 * actually vanished.
 *
 * Usage: node script/cascade/strain-interfere.mjs
 *        [--vs=3] [--amp=2000] [--len=16] [--ticks=60]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '2000'));
const LEN = parseInt(arg('len', '16'));
const TICKS = parseInt(arg('ticks', '60'));
const WEAR = 64;

const wire = [];
for (let i = 0; i < LEN; i++) wire.push([8 + i, 8 + i, 16]);
const MID = LEN >> 1;

const energy = () => {
  let e = 0;
  for (const c of wire) {
    for (let a = 0; a < 3; a++) {
      e += Math.abs(q._moore26_fluxv_get(...c, a)) + Math.abs(q._moore26_flux_get(...c, a));
    }
  }
  return e;
};
const midV = () => q._moore26_fluxv_get(...wire[MID], 0);
const midF = () => q._moore26_flux_get(...wire[MID], 0);

for (const MODE of ['lone', 'same', 'anti']) {
  initM26(q, W, W, W);
  q._moore26_vac_pol_set(VS);
  for (const c of wire) { q._moore26_winding_set(...c, 6, WEAR); q._moore26_winding_set(...c, 7, WEAR); }
  q._moore26_fluxv_set(...wire[0], 0, AMP);
  if (MODE !== 'lone') q._moore26_fluxv_set(...wire[LEN - 1], 0, MODE === 'anti' ? -AMP : AMP);

  console.log(`\n=== mode=${MODE} vs=${VS} amp=${AMP} ===`);
  console.log(`   t |  E_total | fluxV@L${MID}  flux@L${MID} |  fluxV L0..L${LEN - 1}`);
  let minE = 1e9, maxE = 0, crossV = [];
  for (let t = 0; t <= TICKS; t++) {
    const e = energy();
    if (t > 2 && e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (t % 4 === 0 || (MODE === 'anti' && t >= 12 && t <= 22))
      console.log(`  ${String(t).padStart(3)} |  ${String(e).padStart(7)} | ${String(midV()).padStart(6)}  ${String(midF()).padStart(6)}  | ` +
        wire.map(c => { const v = q._moore26_fluxv_get(...c, 0); return String(v).padStart(6); }).join(''));
    if (t < TICKS) q._moore26_tick();
  }
  console.log(`  -> E range [${minE}, ${maxE}]`);
}
