/* strain-wave — does stored strain PROPAGATE? The medium's sound.
 *
 * spring-probe stored momentum in a conduit's fluxV (paid strain).
 * The qVacPol layer runs a discrete wave equation over COMMITTED
 * even cells:
 *     fluxV[a] += (Σ_committed_nbrs flux[a] - deg*flux[a]) >> vs
 *     flux[a]  += fluxV[a]   (then ~1/64 resistive bleed)
 * fluxV is BOTH the battery's stored momentum AND the wave's
 * momentum register — so a charged wall should ring down a
 * committed wire. This measures it: a {1,1,0} chain of committed
 * conduits, a fluxV impulse injected at link 0, and the arrival
 * tick of the disturbance at each downstream link.
 *
 * Metrics: front position vs tick (wave speed in committed
 * links/tick), peak amplitude vs distance (damping), vs-dependence
 * (coupling strength sets slope, adjacency sets the front).
 * Control: --vs=0 leaves the battery charged and silent.
 *
 * Usage: node script/cascade/carve-lane.mjs... (no)
 *        node script/cascade/strain-wave.mjs
 *        [--vs=3] [--amp=2000] [--len=16] [--wear=64] [--ticks=40]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const VS = parseInt(arg('vs', '3'));
const AMP = parseInt(arg('amp', '2000'));
const LEN = parseInt(arg('len', '16'));
const WEAR = parseInt(arg('wear', '64'));
const TICKS = parseInt(arg('ticks', '40'));

/* committed wire along {1,1,0}: cells (8+i, 8+i, 16) — all even
 * parity (24+2i), each edge-adjacent to the next. Commit by
 * painting winding 6/7 >= qCommitMin on every link. */
const wire = [];
for (let i = 0; i < LEN; i++) wire.push([8 + i, 8 + i, 16]);

initM26(q, W, W, W);
q._moore26_vac_pol_set(VS);
for (const c of wire) {
  q._moore26_winding_set(...c, 6, WEAR);
  q._moore26_winding_set(...c, 7, WEAR);
}
/* the impulse: strain charge on link 0, x-axis component */
q._moore26_fluxv_set(...wire[0], 0, AMP);

const read = (c) => {
  const f = q._moore26_flux_get(...c, 0), v = q._moore26_fluxv_get(...c, 0);
  return { f, v };
};

console.log(`=== strain-wave: vs=${VS} amp=${AMP} len=${LEN} wear=${WEAR} ===`);
console.log(`   t |` + wire.map((_, i) => `  L${String(i).padStart(2)} `).join(''));

let firstHit = new Array(LEN).fill(-1);
for (let t = 0; t <= TICKS; t++) {
  const row = wire.map((c, i) => {
    const { f, v } = read(c);
    if (f !== 0 && firstHit[i] < 0) firstHit[i] = t;
    return { f, v };
  });
  if (t % 2 === 0 || t <= 8)
    console.log(`  ${String(t).padStart(3)} |` + row.map(r => `${String(r.f).padStart(5)} `).join(''));
  if (t < TICKS) q._moore26_tick();
}
console.log(`first nonzero flux at each link: ` + firstHit.map((h, i) => `L${i}=${h}`).join(' '));
