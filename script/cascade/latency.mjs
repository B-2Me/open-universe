// latency.mjs — is transaction latency the dilatable clock?
// The rail ring proved ballistic flight is absolute (period=3,
// bath-immune). The remaining candidate for emergent "slower time"
// is the negotiation layer: offer->incipient->confirm->ack RTT.
// The engine measures it directly — ackRtt[c] (round-trip hops),
// bondDist[e] (edge reach), incipBorn[c] (offer age in ticks).
//
// Protocol: warm the knot 600t fed, then for each BATH level run
// 256t and sample the RTT/bond/incip-age registers on the probe
// box. If mean RTT or incipient lifetime grows with ambient load,
// binding processes literally take longer in ticks — emergent
// time dilation for anything whose dynamics run through
// transactions (which is everything bound).
import { loadM26 } from '../lib/m26.mjs';

const BATHS = (process.argv.find(a => a.startsWith('--baths=')) || '--baths=0,0.05,0.2,0.5').split('=')[1].split(',').map(Number);
const PROBE = 256, WARM = 600;

const q = await loadM26();
const N = 32;

// NodeState offsets (same layout as fluxprobe.mjs)
const OFF = { incipBorn: 208, ack: 312, ackTtl: 338, ackRtt: 364, bondDist: 390 };
const nodeSize = q._moore26_node_size();
const idx = (x, y, z) => (z * N * N + y * N + x);
const heap = () => new Uint8Array(q.wasmMemory.buffer);

const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const spokes = [[6, -8, 0], [8, -8, 0], [10, 0, -8], [14, 0, -8]];
const feed = () => { for (const [c, ox, oz] of spokes) {
  let sx = 16 - ox - CV[c][0], sy = 16 - oz - CV[c][1], sz = 16 - CV[c][2];
  if ((sx + sy + sz) & 1) sz++;
  q._moore26_packet_set(sx, sy, sz, c, 2); q._moore26_packet_nu_set(sx, sy, sz, c, 96); } };

// probe box: even-parity sites in 13..19^3
const sites = [];
for (let x = 13; x <= 19; x++) for (let y = 13; y <= 19; y++) for (let z = 13; z <= 19; z++)
  if (((x + y + z) & 1) === 0) sites.push([x, y, z]);

let s = 999;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function sample() {
  let rttSum = 0, rttN = 0, bondSum = 0, bondN = 0, incipN = 0;
  const b0 = heap();
  for (const [x, y, z] of sites) {
    const i = idx(x, y, z) * nodeSize;
    for (let c = 6; c <= 17; c++) {
      const rtt = b0[i + OFF.ackRtt + c];
      if (rtt) { rttSum += rtt; rttN++; }
    }
    for (let e = 0; e < 13; e++) {
      const bd = b0[i + OFF.bondDist + e];
      if (bd) { bondSum += bd; bondN++; }
    }
    for (let c = 0; c < 26; c++) if (b0[i + 156 + c]) incipN++;
  }
  return { rtt: rttN ? +(rttSum / rttN).toFixed(2) : 0, rttN,
           bond: bondN ? +(bondSum / bondN).toFixed(2) : 0, bondN, incipN };
}

for (const BATH of BATHS) {
  q._moore26_init(N, N, N); q._moore26_evap_shift_set(4);
  s = 999;
  // reseed knot
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 6, 60);
    q._moore26_winding_set(16 + dx, 16 + dy, 16 + dz, 7, 60);
    q._moore26_mass_set(16 + dx, 16 + dy, 16 + dz, 10);
  }
  for (let t = 0; t < WARM; t++) { feed(); q._moore26_tick(); }
  const acc = [];
  for (let t = 0; t < PROBE; t++) {
    // bath drip: symmetric random single packets
    for (let k = 0; k < 8; k++) {
      const cc = [6, 8, 10, 12, 14, 16][(rnd() * 6) | 0];
      const x = (rnd() * N) | 0, y = (rnd() * N) | 0, z = (rnd() * N) | 0;
      if (((x + y + z) & 1) === 0 && rnd() < BATH * 8) {
        q._moore26_packet_set(x, y, z, cc, 1); q._moore26_packet_nu_set(x, y, z, cc, 64);
      }
    }
    feed(); q._moore26_tick();
    if (t % 16 === 15) acc.push(sample(BATH));
  }
  const avg = (k) => +(acc.reduce((a, r) => a + r[k], 0) / acc.length).toFixed(2);
  console.log(`bath=${BATH}: meanAckRtt=${avg('rtt')} (n=${avg('rttN')}) meanBondDist=${avg('bond')} meanIncips=${avg('incipN')}`);
}
