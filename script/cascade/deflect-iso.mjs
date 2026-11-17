/* deflect-iso — the corner-jet regression test.
 *
 * Cartan's Cascade 'meson' showed sporadic particles streaming to
 * the SAME top corner — not random. Cause: the DECLINE deflection
 * scanned channels 6..17 first-tie-wins; on equally-free channels
 * every decline landed on ch6 (+1,+1,0) — a collimated jet.
 * Fix: rotate the scan by site hash (same lattice-wind precedent
 * as the over-pressure shunt).
 *
 * This harness reproduces it: a massive saturating cell (incip
 * pre-armed past cap so every offer declines) bombarded on ALL
 * 12 edge channels; histogram which channel each declined
 * packet departs on (packet[] readback after a tick — the
 * deflected packet sits on its deflect channel until transport).
 * Expectation after fix: ~uniform over the 12 edges, not all ch6.
 *
 * Usage: node script/cascade/deflect-iso.mjs [--ticks=60]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();
const W = 64, TICKS = parseInt(arg('ticks', '60'));

initM26(q, W, W, W);
const C = [32, 32, 32];          /* even parity — conduit site */
q._moore26_mass_set(...C, 512);
/* saturate: arm 13 incipients (the cap) so every new offer declines */
for (let c = 0; c < 26; c++) q._moore26_incipient_set(...C, c, 1, 1);

/* bombard from a ring of sources on all 12 edge channels, 1/tick */
const hits = new Array(18).fill(0);
const R = 10;
for (let t = 0; t <= TICKS; t++) {
  /* keep the knot saturated — incipients have ~6t TTL so re-arm
   * every tick or the node drains and starts accepting */
  for (let c = 0; c < 26; c++) q._moore26_incipient_set(...C, c, 2, 1);
  if (t > 0 && t % 2 === 0) {
    for (let c = 6; c < 18; c++) {
      const vx = q._moore26_cvc(c, 0), vy = q._moore26_cvc(c, 1), vz = q._moore26_cvc(c, 2);
      const s = [C[0] - R * vx, C[1] - R * vy, C[2] - R * vz];
      q._moore26_packet_set(...s, c, 4);
      q._moore26_packet_nu_set(...s, c, 128);
    }
  }
  if (t < TICKS) q._moore26_tick();
}
/* where did declined packets pile? sample a shell at distance 6
 * from C — the deflected packets stream out along their deflect
 * channel; count packets per channel-direction position. */
let tot = 0;
const dirCount = new Array(18).fill(0);
for (let c = 6; c < 18; c++) {
  const vx = q._moore26_cvc(c, 0), vy = q._moore26_cvc(c, 1), vz = q._moore26_cvc(c, 2);
  /* packets that deflected toward v(c) sit on c near the boundary
   * of the outgoing cone — read the cell a few steps along v(c) */
  let s = 0;
  for (let d = 2; d <= 8; d++) {
    const x = C[0] + d * vx, y = C[1] + d * vy, z = C[2] + d * vz;
    s += q._moore26_packet_get(x, y, z, c);
  }
  dirCount[c] = s; tot += s;
}
console.log(`deflect-iso: packets found per outgoing channel-direction (d=2..8):`);
for (let c = 6; c < 18; c++) {
  const v = [q._moore26_cvc(c, 0), q._moore26_cvc(c, 1), q._moore26_cvc(c, 2)];
  console.log(`  ch${String(c).padStart(2)} (${v.join(',')})`.padEnd(16) + `: ${dirCount[c]}`);
}
const max = Math.max(...dirCount.slice(6)), sum = dirCount.slice(6).reduce((a, b) => a + b, 0);
console.log(`\nmax-share=${sum ? (max / sum * 100).toFixed(1) : 0}% on ch${dirCount.indexOf(max)} ` +
  `(100% = corner jet BUG, ~8.3% = isotropic FIXED)  ev30(declines)=${q._moore26_events(30)}`);
