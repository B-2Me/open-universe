/* depletion-gravity.mjs — statistical gravity via channel depletion.
 *
 * Hypothesis: mass is a conducted-flux SINK. A deep knot eats the
 * ambient flux streaming through it, so a probe sitting in its
 * downstream channel cone sees an asymmetric kick ensemble:
 * depleted on the channels that pass through the absorber,
 * full on the mirror channels. If the mean kick tilts toward the
 * absorber, "gravity" is statistical — no force law, just a
 * persistent sink biasing the local flux ensemble.
 *
 * Design fixes vs the old shadow probes (each a measured null cause):
 *   - EXTERNAL RESERVOIR: only the boundary shell is heated; interior
 *     nodes stay cold so the gap cannot re-emit into itself
 *     (volumetric refill killed casimir.mjs).
 *   - DEEP ABSORBER: 4-cell 2048-mass knot — locks absorbed energy
 *     into structure instead of re-radiating (thin plates
 *     re-emitted isotropically and erased their own shadow).
 *   - ODD SUBLATTICE: probe + absorber on odd cells (the earlier
 *     probe sat on the transport sublattice and never relayed).
 *   - EXACT-NODE READS: momentum sampled at the probe node only
 *     (a drifting absorber once contaminated box reads).
 *
 * Geometry: B at origin-frame (25,24,32). A at B + k*(1,1,0) — so
 * flux arriving at B on channel 7 (-1,-1,0) has passed through A.
 * Pair 3 = channels 6 (+1,+1) vs 7 (-1,-1). Prediction: ch7 flux
 * depleted -> mean momentum[3] tilts +x+y (toward A, whichever sign
 * convention the data shows consistently across the mirror arm).
 *
 * Arms: control | A@+12 | A@+24 | A@-12 (mirror — must invert).
 * Usage: node script/cascade/depletion-gravity.mjs --ticks=1200
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 64);
const TICKS = +(argv.ticks ?? 1200);
const HEAT  = +(argv.heat  ?? 4000);
const FLOOR = +(argv.floor ?? 64);
const RATE  = +(argv.rate  ?? 8);
const TOPUP = +(argv.topup ?? 4);
const READ  = +(argv.read  ?? 50);
const BURN  = +(argv.burn  ?? 0.5);   // trailing fraction

const M = await loadM26();

const BX = 25, BY = 24, BZ = 32;            // probe (odd parity)
const AK = [[0,0,0],[12,12,0],[24,24,0],[-12,-12,0]];   // arms
const NAMES = ['control','A@+12','A@+24','A@-12'];

function seedBath() {
  for (let z = 0; z < SIZE; z++)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (x === 0 || y === 0 || z === 0 ||
            x === SIZE-1 || y === SIZE-1 || z === SIZE-1)
          M._moore26_heat_set(x, y, z, HEAT);
}
function seedAbsorber(ax, ay, az) {
  /* 4 odd-parity cells, 2x2 at fixed z — the deep knot that locks
   * absorbed energy into mass instead of re-radiating. */
  for (const [dx, dy] of [[0,0],[2,0],[0,2],[2,2]])
    M._moore26_mass_set(ax+dx, ay+dy, az, 2048);
}
function probeStats() {
  /* probe census: momentum pair 3 at B, mass total + centroid over
   * a 9x9x1 box (probe drifts — a wide box follows it), and the
   * upstream channel census: ch6 flux at B-(1,1,0), ch7 at B+(1,1,0). */
  let m = 0, cx = 0, cy = 0, mom = 0;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = BX+dx, y = BY+dy, z = BZ+dz;
        if (x < 0 || y < 0 || z < 0 || x >= SIZE || y >= SIZE || z >= SIZE) continue;
        const mm = M._moore26_mass_get(x, y, z);
        m += mm; cx += mm*x; cy += mm*y;
        mom += M._moore26_momentum_at_get(x, y, z, 3) || 0;
      }
  const f6 = M._moore26_packet_get(BX-1, BY-1, BZ, 6);
  const f7 = M._moore26_packet_get(BX+1, BY+1, BZ, 7);
  return { m, cx: m ? cx/m : 0, cy: m ? cy/m : 0,
           mom, f6, f7, heat: M._moore26_heat_get(BX, BY, BZ) };
}

function run(ai) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_vac_floor_set(FLOOR);
  M._moore26_vac_rate_set(RATE);
  M._moore26_mass_set(BX, BY, BZ, 256);
  const [ax, ay, az] = AK[ai];
  if (ax || ay || az) seedAbsorber(BX+ax, BY+ay, BZ+az);
  const t0 = Math.floor(TICKS*(1-BURN));
  let mom = 0, f6 = 0, f7 = 0, n = 0, mEnd = 0, heat = 0;
  const s0 = probeStats();
  for (let t = 0; t < TICKS; t++) {
    if (t % TOPUP === 0) seedBath();
    M._moore26_tick();
    if (t >= t0) {
      const s = probeStats();
      mom += s.mom; f6 += s.f6; f7 += s.f7; n++;
      mEnd = s.m; heat = s.heat;
      if (t % READ === 0 || t === TICKS-1)
        console.log(`    t=${t}  mom3=${s.mom}  f6=${s.f6} f7=${s.f7} ` +
                    `m=${s.m} cx=${s.cx.toFixed(1)} cy=${s.cy.toFixed(1)} heat=${s.heat}`);
    }
  }
  const s1 = probeStats();
  return { mom: mom/n, f6: f6/n, f7: f7/n, m0: s0.m, m1: mEnd,
           dx: s1.cx - s0.cx, dy: s1.cy - s0.cy, heat };
}

console.log(`depletion-gravity: bath HEAT=${HEAT} FLOOR=${FLOOR} RATE=${RATE} TOPUP=${TOPUP}, ${TICKS}t`);
for (let a = 0; a < AK.length; a++) {
  console.log(`arm ${NAMES[a]}:`);
  const r = run(a);
  console.log(`  => mean mom3=${r.mom.toFixed(2)}  f6=${r.f6.toFixed(2)} f7=${r.f7.toFixed(2)} ` +
              `(ratio ${r.f7 ? (r.f6/r.f7).toFixed(2) : 'inf'})  mass ${r.m0}->${r.m1} ` +
              `drift=(${r.dx.toFixed(2)},${r.dy.toFixed(2)}) heat=${r.heat}`);
}
