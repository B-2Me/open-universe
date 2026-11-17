/* strain-cherenkov — supersonic source on the membrane: does a
 * mover outrunning its own field disturbance leave a Mach cone?
 *
 * The membrane's wave travels ~0.43 committed-link/tick (vs=3).
 * Drive a point source that hops one lattice link per tick —
 * v_src = 1.0 > c = 0.43. Each hop's impulse spreads as an
 * expanding wavefront; the superposed envelope should form a V
 * wake trailing the mover with half-angle arcsin(c/v) ~ 25 deg —
 * Cherenkov radiation in the substrate. Guaranteed by linearity
 * (superposition proven) — but the CONE ANGLE is an independent
 * geometric measurement of the wave speed.
 *
 * Sheet: same (m,n) committed lattice as strain-membrane.
 * Mover: hops (k,0) at tick k, injecting fluxV=AMP each hop
 * (t=1..NHOP). Readout: flux map over the sheet at t=TICKS —
 * look for the V-shaped wake, measure the cone edge direction
 * by the |flux| centroid angle off the axis.
 *
 * Arms: --speed=1 (1 link/tick, supersonic) vs --speed=3
 * (one hop every 3 ticks — subsonic control: no cone, symmetric
 * expanding rings).
 *
 * Usage: node script/cascade/strain-cherenkov.mjs
 *        [--vs=3] [--amp=1500] [--speed=1] [--nhop=10] [--ticks=24]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '1500'));
const SPEED = parseInt(arg('speed', '1'));   /* ticks per hop (1 = 1 link/tick) */
const NHOP = parseInt(arg('nhop', '10'));
const TICKS = parseInt(arg('ticks', '24'));
const HALF = 16;
const CX = 24, CY = 40, CZ = 16;             /* 80 even parity; mover runs -y */

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
const pos = (m, n) => [CX + m + n, CY + m - n, CZ];
for (let m = -HALF; m <= HALF; m++)
  for (let n = -HALF; n <= HALF; n++) {
    const c = pos(m, n);
    q._moore26_winding_set(...c, 6, 64);
    q._moore26_winding_set(...c, 7, 64);
  }

console.log(`=== strain-cherenkov: vs=${VS} amp=${AMP} speed=${SPEED}t/hop nhop=${NHOP} ===`);
let hop = 0;
for (let t = 0; t <= TICKS; t++) {
  if (t > 0 && t % SPEED === 0 && hop < NHOP) {
    hop++;
    q._moore26_fluxv_set(...pos(hop, 0), 0, AMP);   /* pole the moving link */
  }
  if (t < TICKS) q._moore26_tick();
}

/* field map over the sheet in (m,n) coords — m = along-track,
 * n = cross-track. Print |flux| for n in [-6,6], m in [0,14]. */
console.log(`field |flux| at t=${TICKS}: rows = n (cross-track), cols = m (along-track)`);
const row = [];
for (let n = -6; n <= 6; n++) {
  let s = '';
  for (let m = -2; m <= 14; m++) {
    const f = Math.abs(q._moore26_flux_get(...pos(m, n), 0));
    s += f > 999 ? '#' : f > 99 ? '+' : f > 9 ? '.' : ' ';
  }
  console.log(`  n=${String(n).padStart(3)} |${s}|`);
}
console.log(`        m= -2..14, mover ended at (${hop},0)`);
/* crude cone-edge measurement: for each m, find outermost |n| with flux>50 */
console.log(`\nwake half-width vs distance behind mover (cells at |flux|>50):`);
for (let m = 0; m <= 14; m++) {
  let w = 0;
  for (let n = -HALF; n <= HALF; n++)
    if (Math.abs(q._moore26_flux_get(...pos(m, n), 0)) > 50 && Math.abs(n) > w) w = Math.abs(n);
  const behind = hop - m;   /* links behind the mover */
  if (behind >= 0)
    console.log(`  m=${String(m).padStart(2)} (${String(behind).padStart(2)} behind): half-width=${w}  tan=${behind > 0 ? (w / behind).toFixed(2) : '-'}`);
}
