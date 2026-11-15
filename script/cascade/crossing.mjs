/* crossing.mjs — do two packet streams interact at a shared cell?
 *
 *   rail A: ch6 (1,1,0)  source (10,10,16) -> crossing (16,16,16) -> det (19,19,16)
 *   rail B: ch8 (1,-1,0) source (10,22,16) -> crossing (16,16,16) -> det (19,13,16)
 *
 * All cells even-sublattice. Rails pre-worn (winding 128) so quanta
 * survive transit; qRailGate OFF (waveguide bypass would forbid
 * lateral interaction by construction).
 *
 * Arms: A alone / B alone / A+B same nu / A+B different nu.
 * Detector = arrivals at the cell 3 hops past the crossing.
 * Non-additivity at the crossing = beam-beam interaction (the
 * fm-scale "interference" observable: opacity between parton
 * streams, not amplitude fringes — packetNu is an energy tag,
 * the medium has no phase register).
 *
 * Run: node script/cascade/crossing.mjs
 */
import { loadM26 } from '../lib/m26.mjs';

const SIZE = 32, T = 120, WARM = 30;
const M = await loadM26();
let s = 4242;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const railA = [], railB = [];
for (let k = -6; k <= 6; k++) {
  railA.push([16 + k, 16 + k, 16]);
  railB.push([16 + k, 16 - k, 16]);
}
const DET_A = [19, 19, 16], DET_B = [19, 13, 16];
const SRC_A = [10, 10, 16], SRC_B = [10, 22, 16];

function run(feedA, feedB, nuA, nuB) {
  M._moore26_init(SIZE, SIZE, SIZE);
  M._moore26_wear_decay_set(0);
  for (const [x, y, z] of railA) M._moore26_winding_set(x, y, z, 6, 128);
  for (const [x, y, z] of railB) M._moore26_winding_set(x, y, z, 8, 128);
  let dA = 0, dB = 0;
  for (let t = 0; t < T; t++) {
    if (feedA && rnd() < 0.6) {
      M._moore26_packet_set(...SRC_A, 6, 2);
      M._moore26_packet_nu_set(...SRC_A, 6, nuA);
    }
    if (feedB && rnd() < 0.6) {
      M._moore26_packet_set(...SRC_B, 8, 2);
      M._moore26_packet_nu_set(...SRC_B, 8, nuB);
    }
    M._moore26_tick();
    if (t >= WARM) {
      dA += M._moore26_packet_get(...DET_A, 6);
      dB += M._moore26_packet_get(...DET_B, 8);
    }
  }
  return { dA, dB };
}

const aOnly = run(true, false, 32, 0);
const bOnly = run(false, true, 0, 32);
const same  = run(true, true, 32, 32);
const diff  = run(true, true, 32, 96);

console.log('beam-crossing interaction (det = arrivals past crossing, 90 tick window)');
console.log(`A alone:        dA=${aOnly.dA}`);
console.log(`B alone:        dB=${bOnly.dB}`);
console.log(`A+B same nu:    dA=${same.dA} dB=${same.dB}   (vs ${aOnly.dA}/${bOnly.dB} alone)`);
console.log(`A+B diff nu:    dA=${diff.dA} dB=${diff.dB}`);
const lossA = same.dA / (aOnly.dA || 1), lossB = same.dB / (bOnly.dB || 1);
console.log(`survival: A=${(lossA * 100).toFixed(0)}% B=${(lossB * 100).toFixed(0)}% of solo`);
