/* coherence.mjs — fringe visibility vs gate width + phase randomization
 *
 * Same fixture as fringes.mjs: absorber K=(18,18,16) even, m512, two
 * rail termini — arm A 4-hop ch6 (dense), arm B 8-hop ch8 (probe).
 * Phase diff = nu*d mod 256, d=4.
 *
 * A) gate sweep at fixed anti-phase (nu=32, diff=128): declines
 *    should hold until the gate reaches the distance — maps the
 *    acceptance window edge.
 * B) fringe at two gate widths (32 vs 8): width should track gate.
 * C) which-path/decoherence: B's nu randomized per packet
 *    (nu_B = 32 + spread*rnd) — phase coherence lost, declines
 *    should wash toward the geometric floor (~1 - gate/128).
 *
 * Run: node script/cascade/coherence.mjs
 */
import { loadM26 } from '../lib/m26.mjs';

const SIZE = 40, T = 160;
const K = [18, 18, 16];
const M = await loadM26();
let s = 9001;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ev = i => Number(M._moore26_events(i));
const kHeat = () => M._moore26_heat_get(...K);

function run(nuA, nuB, gate, spread = 0) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_merge_gate_set(gate);
  M._moore26_merge_min_set(256);
  M._moore26_incip_ttl_set(249);
  M._moore26_mass_set(...K, 512);
  for (let k = 0; k < 4; k++) M._moore26_winding_set(14 + k, 14 + k, 16, 6, 128);
  for (let k = 0; k < 8; k++) M._moore26_winding_set(10 + k, 26 - k, 16, 8, 128);
  const e50 = ev(50);
  const h0 = kHeat();
  for (let t = 0; t < T; t++) {
    if (rnd() < 0.9) {
      M._moore26_packet_set(14, 14, 16, 6, 3);
      M._moore26_packet_nu_set(14, 14, 16, 6, nuA);
    }
    if (rnd() < 0.9) {
      const nu = spread ? Math.max(1, nuB + ((rnd() * 2 - 1) * spread) | 0) : nuB;
      M._moore26_packet_set(10, 26, 16, 8, 3);
      M._moore26_packet_nu_set(10, 26, 16, 8, nu);
    }
    M._moore26_tick();
  }
  return { heat: kHeat() - h0, d50: ev(50) - e50 };
}

console.log('=== A) gate sweep at anti-phase (nu=32, diff=128) ===');
console.log('gate   ev50   heat');
for (const g of [0, 8, 16, 32, 64, 96, 127, 128]) {
  const r = run(32, 32, g);
  console.log(`${g}   ${r.d50}   ${r.heat}`);
}

console.log('\n=== B) fringe width: gate=8 vs gate=32 (nu sweep, d=4) ===');
console.log('nu   diff   g8.ev50   g32.ev50');
for (const nu of [8, 16, 24, 32, 40, 48, 56, 64]) {
  const r8 = run(nu, nu, 8), r32 = run(nu, nu, 32);
  console.log(`${nu}   ${(nu * 4) % 256}   ${r8.d50}   ${r32.d50}`);
}

console.log('\n=== C) decoherence: B nu-randomized (nuA=nuB=32, gate=32) ===');
console.log('spread   ev50   heat');
for (const sp of [0, 4, 8, 16, 32, 64]) {
  const r = run(32, 32, 32, sp);
  console.log(`±${sp}   ${r.d50}   ${r.heat}`);
}
