/* carve-lane — the qCarveLoad response curve: lane history vs
 * matter throughput when a dense slug squeezes into occupied space.
 *
 * One odd source cell (mass SRC) with momentum on pair 3 hops
 * through a conduit held at incipient load LOAD into a destination
 * pre-filled to DST (room = 65535-DST). The hop tears k off the
 * source: k = mass>>shift where shift=3 (edge shed). Carve law:
 * load>=qCarveLoad drops shift one step -> 2x tear. Stall law:
 * load>=qStallLoad denies the hop entirely (congestion wait).
 *
 * Sweep LOAD through the three regimes:
 *   load < carve(16)      : tear = src>>3
 *   carve <= load < stall : tear = src>>2   (2x — congestion relief)
 *   load >= stall(32)     : tear = 0, creep++
 *
 * Metric: single-tick mass moved src->dest per load level.
 * Control: --carve=0 collapses the middle regime to the baseline
 * tear (proves the delta is the carve law, not incipient presence).
 *
 * Usage: node script/cascade/carve-lane.mjs
 *        [--carve=16|0] [--loads=0,8,16,24,32,48] [--src=60000]
 *        [--dest=40000] [--p=4000]
 */
import { loadM26, initM26 } from '../lib/m26.mjs';
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : d; };
const q = await loadM26();

const W = 64;
const CARVE = parseInt(arg('carve', '16'));
const LOADS = arg('loads', '0,8,16,24,32,48').split(',').map(Number);
const SRC_M = parseInt(arg('src', '60000'));
const DST_M = parseInt(arg('dest', '40000'));
const P = parseInt(arg('p', '4000'));

/* odd source (11,16,20) -> conduit (12,16,20) -> odd dest (12,17,20)
 * on pair-3/ch6 {1,1,0}. */
const SV = [11, 16, 20], CV = [12, 16, 20], DV = [12, 17, 20];

console.log(`=== carve-lane: carve=${CARVE} src=${SRC_M} dest=${DST_M} p=${P} ===`);
console.log(` load |  src0->src1   dst0->dst1   moved  creep  verdict`);

for (const LOAD of LOADS) {
  initM26(q, W, W, W);
  q._moore26_carve_load_set(CARVE);
  q._moore26_stall_load_set(32);
  q._moore26_mass_set(...SV, SRC_M);
  q._moore26_momentum_at_set(...SV, 3, P);
  q._moore26_momentum_set(255);
  q._moore26_mass_set(...DV, DST_M);
  const creep0 = q._moore26_creep_get ? 0 : 0;
  q._moore26_incipient_set(...CV, 6, LOAD);
  q._moore26_tick();
  const s1 = q._moore26_mass_get(...SV), d1 = q._moore26_mass_get(...DV);
  const moved = d1 - DST_M;
  let verdict = moved === 0 ? 'DENIED (stall)' :
    moved > (SRC_M >> 3) ? `CARVED ${(moved / (SRC_M >> 3)).toFixed(1)}x` : 'baseline tear';
  console.log(`  ${String(LOAD).padStart(3)} |  ${SRC_M}->${String(s1).padStart(5)}   ${DST_M}->${String(d1).padStart(5)}   ${String(moved).padStart(6)}   ${verdict}`);
}
