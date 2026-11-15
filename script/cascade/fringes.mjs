/* fringes.mjs — path-difference interferometry with qMergeGate.
 *
 * Each packet carries a rotating phase op = nu*age mod 256. A mass-
 * bearing EVEN cell at a rail TERMINUS parks a standing cloud of
 * frozen arrival phases; qMergeGate admits new offers only within
 * qMergeGate of an armed phase — anti-phase offers decline to heat
 * (ev50) or reflect (ev53).
 *
 *   absorber  K = (18,18,16)  even cell, mass 512, terminus
 *   arm A     ch6 rail (14,14,16) -> K   path 4 hops  (dense)
 *   arm B     ch8 rail (10,26,16) -> K   path 8 hops  (probe, d=4)
 *
 * Phase difference = nu*d mod 256 with d=4 fixed. Sweeping nu scans
 * the phase at CONSTANT geometry — attenuation identical for all
 * points, so any modulation is phase, not path loss.
 * Prediction: nu=32 -> nu*d=128 (anti-phase, declines peak);
 *             nu=64 -> nu*d=0   (in-phase, declines floor).
 *
 * Run: node script/cascade/fringes.mjs [--gate=32]
 */
import { loadM26 } from '../lib/m26.mjs';

const argv = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  argv[k] = v === undefined ? true : v;
}
const SIZE = 40, T = 160, GATE = +(argv.gate ?? 32);
const K = [18, 18, 16];
const M = await loadM26();
let s = 9001;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ev = i => Number(M._moore26_events(i));
const kHeat = () => M._moore26_heat_get(...K);

function cloud() {
  let n = 0; const ops = [];
  for (let c = 0; c < 26; c++) {
    const i = M._moore26_incipient_get(...K, c);
    if (i) { n += i; ops.push(`ch${c}:op${M._moore26_incipop_get(...K, c)}x${i}`); }
  }
  return { n, ops: ops.join(' ') };
}

function run(nu, feedA, feedB, gate = GATE) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  M._moore26_merge_gate_set(gate);
  M._moore26_merge_min_set(256);
  M._moore26_incip_ttl_set(249);
  M._moore26_mass_set(...K, 512);
  for (let k = 0; k < 4; k++) M._moore26_winding_set(14 + k, 14 + k, 16, 6, 128);
  for (let k = 0; k < 8; k++) M._moore26_winding_set(10 + k, 26 - k, 16, 8, 128);
  const e50 = ev(50), e53 = ev(53);
  const h0 = kHeat();
  for (let t = 0; t < T; t++) {
    if (feedA && rnd() < 0.9) {
      M._moore26_packet_set(14, 14, 16, 6, 3);
      M._moore26_packet_nu_set(14, 14, 16, 6, nu);
    }
    if (feedB && rnd() < 0.9) {
      M._moore26_packet_set(10, 26, 16, 8, 3);
      M._moore26_packet_nu_set(10, 26, 16, 8, nu);
    }
    M._moore26_tick();
  }
  const c = cloud();
  return { heat: kHeat() - h0, armed: c.n, ops: c.ops,
           d50: ev(50) - e50, d53: ev(53) - e53 };
}

console.log(`fringes nu-sweep: gate=${GATE} d=4 absorber=mass512@even(18,18,16) T=${T}`);
console.log('phase diff = nu*4 mod 256; anti-phase at nu=32, in-phase at nu=64\n');

console.log('nu   nu*d%256  heat   armed  ev50  ev53   K-cloud');
for (const nu of [8, 16, 24, 32, 40, 48, 56, 64]) {
  const r = run(nu, true, true);
  const pd = (nu * 4) % 256;
  console.log(`${nu}   ${pd}  ${r.heat}  ${r.armed}  ${r.d50}  ${r.d53}   ${r.ops}`);
}

console.log('\n--- controls at nu=32 ---');
const a = run(32, true, false);
console.log(`A only (nu=32):  heat=${a.heat} armed=${a.armed} ev50=${a.d50} | ${a.ops}`);
const b = run(32, false, true);
console.log(`B only (nu=32):  heat=${b.heat} armed=${b.armed} ev50=${b.d50} | ${b.ops}`);
const g0 = run(32, true, true, 0);
console.log(`gate=0 (nu=32):  heat=${g0.heat} armed=${g0.armed} ev50=${g0.d50} | ${g0.ops}`);
