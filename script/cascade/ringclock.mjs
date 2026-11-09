// ringclock.mjs — the native clock control.
// A 3-node FCC triangle on the even sublattice:
//   A=(16,16,16) ->ch8-> B=(17,15,16) ->ch16-> C=(17,16,15) ->ch13-> A
// (CV[8]=[1,-1,0], CV[16]=[0,1,-1], CV[13]=[-1,0,1] — sum closes to 0)
//
// RAIL mode: each node carries a committed winding pair (min>=rail_gate)
// whose dominant member is the OUTGOING tangent channel. Phase-2 rail
// bypass re-channels arriving packets onto that member and Phase-1
// exempts them from decay — a loss-free waveguide. If packets hop
// 1 node/tick the circulation period is exactly 3 ticks: the
// substrate's absolute ballistic clock.
//
// BARE mode: same geometry, winding below rail_gate — packets must
// arm/confirm through the negotiation layer; the clock becomes
// stochastic and congestion-dependent (the dilatable candidate).
//
// Telemetry: packet (node,channel) occupancy per tick -> period,
// survival, and per-node incip/ack activity (transaction latency).
import { loadM26 } from '../lib/m26.mjs';

const MODE = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=rail').split('=')[1];
const TICKS = parseInt((process.argv.find(a => a.startsWith('--ticks=')) || '--ticks=200').split('=')[1]);
const BATH = parseFloat((process.argv.find(a => a.startsWith('--bath=')) || '--bath=0').split('=')[1]);

const q = await loadM26();
const N = 32;
q._moore26_init(N, N, N);
if (MODE === 'rail') q._moore26_rail_gate_set(64);
q._moore26_evap_shift_set(4);

const RING = [
  { p: [16, 16, 16], out: 8,  pair: [8, 9],  w: [200, 100] },   // A ->ch8-> B
  { p: [17, 15, 16], out: 16, pair: [16, 17], w: [200, 100] },   // B ->ch16-> C
  { p: [17, 16, 15], out: 13, pair: [12, 13], w: [100, 200] },   // C ->ch13-> A
];
// NOTE pair[] are the two channels of the outgoing edge pair; w[] sets
// the imbalance so the dominant member IS the outgoing channel.
for (const r of RING) {
  const [x, y, z] = r.p;
  q._moore26_winding_set(x, y, z, r.pair[0], r.w[0]);
  q._moore26_winding_set(x, y, z, r.pair[1], r.w[1]);
  q._moore26_mass_set(x, y, z, 10);
}
// seed one fat packet at A on its outgoing channel
q._moore26_packet_set(16, 16, 16, 8, 4);
q._moore26_packet_nu_set(16, 16, 16, 8, 200);

// ambient bath: symmetric packet drip on boundary shell (zero net momentum)
const CV = [,,,,,, [1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
let s = 12345;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const bath = () => {
  if (!BATH) return;
  for (const c of [6, 8, 10, 12, 14, 16]) {           // + dirs only, all axes
    const v = CV[c];
    for (let t = 0; t < 4; t++) {
      const x = (rnd() * N) | 0, y = (rnd() * N) | 0, z = (rnd() * N) | 0;
      // inject just outside the ring's neighborhood is complex; instead
      // drip uniformly — bath density is what matters, not placement
      if (((x + y + z) & 1) === 0 && rnd() < BATH) {
        q._moore26_packet_set(x, y, z, c, 1);
        q._moore26_packet_nu_set(x, y, z, c, 64);
      }
    }
  }
};

// occupancy scan: which (node,channel) holds packets on the ring
const pos = () => {
  const hits = [];
  for (const [i, r] of RING.entries()) {
    const [x, y, z] = r.p;
    for (let c = 6; c <= 17; c++) {
      const p = Number(q._moore26_packet_get(x, y, z, c));
      if (p) hits.push(`${'ABC'[i]}:ch${c}=${p}`);
    }
  }
  return hits;
};
console.log(`ringclock: mode=${MODE} ticks=${TICKS} bath=${BATH} rail_gate=${MODE === 'rail' ? 64 : 0}`);
const seen = [];
let lastSig = '';
for (let t = 0; t < TICKS; t++) {
  bath();
  q._moore26_tick();
  const h = pos().join(' ');
  if (h !== lastSig) { console.log(`t=${t} ${h || '(empty)'}`); lastSig = h; }
  seen.push(h);
}
// period estimate: find the packet's return signature cycle
console.log('done. final occupancy:', pos().join(' ') || 'none');
