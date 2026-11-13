/* source-pull.mjs — does an absorbed packet pull the absorber
 * toward its source (upstream) or push it downstream?
 *
 * Code read (moore26.c): confirmed offer on channel c writes
 * momentum[c>>1] += (c&1)?+1:-1. Relay maps momentum[e]>0 -> even
 * channel (+v), <0 -> odd channel (-v). So a +x+y (ch6) absorption
 * decrements pair 3 -> drift -x-y: TOWARD THE SOURCE, not along
 * travel. If that read is right, every "radiation pressure" result
 * was actually attraction-to-source — the pull-model transaction
 * physically pulls the node toward what it transacts.
 *
 * Test: single emitter at B-(6,6,0) — its ch6 emissions reach B
 * traveling +x+y. Watch mom3 sign AND probe mass-centroid drift.
 *   mom3<0 + centroid -> emitter  => attraction-to-source CONFIRMED
 *   mom3>0 + centroid -> -x-y     => push (standard radiation)
 * Control arm: no emitter.
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE  = +(argv.size  ?? 32);
const TICKS = +(argv.ticks ?? 300);
const HEAT  = +(argv.heat  ?? 4000);
const FLOOR = +(argv.floor ?? 64);
const RATE  = +(argv.rate  ?? 4);

const M = await loadM26();
const BX = 17, BY = 16, BZ = 16;          // probe, odd parity
const EX = 10, EY = 10, EZ = 16;          // emitter on the EVEN
// graph — ch6 line runs (10,10)->(11,11)->...->(16,16): the last
// even conduit sits face-adjacent to the probe, and its kick
// broadcasts to the probe's momentum register.

function probeStats() {
  let m = 0, cx = 0, cy = 0;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = BX+dx, y = BY+dy, z = BZ+dz;
        const mm = M._moore26_mass_get(x, y, z);
        m += mm; cx += mm*x; cy += mm*y;
      }
  return { m, cx: m ? cx/m : 0, cy: m ? cy/m : 0,
           mom3: M._moore26_momentum_at_get(BX, BY, BZ, 3) || 0,
           cmom: M._moore26_momentum_at_get(16, 16, 16, 3) || 0 };
}

function run(emitter) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_vac_floor_set(FLOOR);
  M._moore26_vac_rate_set(RATE);
  M._moore26_mass_set(BX, BY, BZ, 256);
  const s0 = probeStats();
  for (let t = 0; t < TICKS; t++) {
    /* deterministic ch6 dribble at E: packets hop +x+y, 6 cells to B */
    if (emitter && t % 4 === 0) {
      M._moore26_packet_set(EX, EY, EZ, 6, 4);
      M._moore26_packet_nu_set(EX, EY, EZ, 6, 8);
    }
    M._moore26_tick();
    if (t % 50 === 0 || t === TICKS-1) {
      const s = probeStats();
      console.log(`  t=${t}  mom3=${s.mom3} cmom=${s.cmom}  m=${s.m} ` +
                  `cx=${s.cx.toFixed(2)} cy=${s.cy.toFixed(2)} ` +
                  `(emitter at ${EX},${EY})`);
    }
  }
  return probeStats();
}

for (const em of [1, 0]) {
  console.log(em ? 'arm EMITTER (ch6 source at -6,-6):' : 'arm CONTROL:');
  const r = run(em);
  console.log(`  => final cx=${r.cx.toFixed(2)} cy=${r.cy.toFixed(2)} m=${r.m}\n`);
}
